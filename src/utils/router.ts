// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { getPaths, itemToArr, mergePaths, stopwatch } from "commonlib-js";
import express from "express";
import path from "node:path";
import url from "url";
import API from "../api/index.js";
import type {
  RouteConstructor,
  RouteRequestMethods,
  RouterFileInfo,
  RouterRoute
} from "../types.js";

export default class Router {
  readonly #api: API;

  constructor(api: API) {
    this.#api = api;
  }

  private isFileExcluded(file: path.ParsedPath): boolean {
    const includedExtensions = [".ts", ".js"];
    const excludedPrefixes: string[] = [];
    const excludedSuffixes = ["_"];

    if (!includedExtensions.includes(file.ext.toLowerCase())) {
      return true;
    }

    if (excludedPrefixes.some((x) => file.name.toLowerCase().startsWith(x))) {
      return true;
    }

    if (excludedSuffixes.some((x) => file.name.toLowerCase().endsWith(x))) {
      return true;
    }

    return false;
  }

  private convertPath(filePath: string): string {
    const bracketsRegex = /\[([^}]*)\]/g;
    const subPaths = [];
    for (const subPath of filePath.split("/")) {
      subPaths.push(
        bracketsRegex.test(subPath)
          ? subPath.replace(bracketsRegex, (_, s) => `:${s}`)
          : subPath
      );
    }

    filePath = mergePaths(...subPaths);
    filePath = filePath.replace(/:\.\.\.\w+/g, "*");

    return filePath;
  }

  private calculatePriority(routePath: string): number {
    if (routePath.match(/\/\*/g)?.length) {
      return Infinity;
    }

    const depth = routePath.match(/\/.+?/g)?.length || 0;
    const specifity = routePath.match(/\/:.+?/g)?.length || 0;

    return depth + specifity;
  }

  private async generateRoutes(
    files: RouterFileInfo[]
  ): Promise<RouterRoute[]> {
    const routes: RouterRoute[] = [];

    const run = files.map(async (file) => {
      const useStopwatch = stopwatch();
      const parseFile = path.parse(file.relPath);

      if (this.isFileExcluded(parseFile)) {
        return;
      }

      const fileDirectory =
        parseFile.dir === parseFile.root ? "" : parseFile.dir;
      const fileName =
        parseFile.name === "index"
          ? parseFile.name.replace("index", "")
          : `/${parseFile.name}`;
      const routePath = this.convertPath(fileDirectory + fileName);
      const routePriority = this.calculatePriority(routePath);

      const importFile = await import(
        path.join(url.pathToFileURL(file.path).toString(), file.name)
      );
      const readFile: RouteConstructor = importFile.default;

      if (!readFile) {
        this.#api.logger.log(
          "warn",
          `The route '${routePath}' doesn't have a default export. Skipping it.`,
          {
            category: "router"
          }
        );
        return;
      }

      const createFile = new readFile(this.#api);

      if (!Object.entries(createFile.methods).length) {
        this.#api.logger.log(
          "warn",
          `The route '${routePath}' doesn't have any exported methods. Skipping it.`,
          {
            category: "router"
          }
        );
        return;
      }

      routes.push({
        path: routePath,
        methods: createFile.methods,
        file: createFile,
        priority: routePriority
      });

      const getMethodsKeys = (() => {
        const keys = [];
        const entries = Object.entries(createFile.methods);
        for (const entry of entries) {
          keys.push(entry[0].toUpperCase());
        }

        return keys;
      })();

      this.#api.logger.log(
        "done",
        `Loaded route '${routePath}' (${getMethodsKeys.join(" ")}).`,
        {
          category: "router",
          stopwatch: useStopwatch
        }
      );
    });

    await Promise.all(run);
    const sortRoutes = routes.sort((a, b) => a.priority - b.priority);

    return sortRoutes;
  }

  async init(
    preHandlers: express.Handler[],
    postHandlers: express.Handler[]
  ): Promise<express.Router> {
    const useStopwatch = stopwatch();

    this.#api.logger.log("info", "Initializing the router.", {
      category: "router"
    });

    const eRouter = express.Router();
    const getFilesPaths = await getPaths(
      path.join(
        url.fileURLToPath(new URL(".", import.meta.url)),
        "../",
        "routes"
      )
    );

    const generateRoutes = await this.generateRoutes(getFilesPaths);
    for (const { path, methods, file } of generateRoutes) {
      if (!file.enabled) {
        continue;
      }

      for (const [method, handler] of Object.entries(methods)) {
        const routeMethod = method as RouteRequestMethods;
        const handlers = itemToArr(handler);

        const useRatelimit = await this.#api.ratelimit.use(file);
        const useCooldown = await this.#api.cooldown.use(file);

        eRouter[routeMethod](
          path,
          ...[
            useRatelimit,
            useCooldown,
            ...preHandlers,
            ...handlers,
            ...postHandlers
          ]
        );
      }
    }

    this.#api.logger.log("done", "Router initialized.", {
      category: "router",
      stopwatch: useStopwatch
    });

    return eRouter;
  }
}
