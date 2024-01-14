// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { sar, timeToMs } from "commonlib-js";
import express from "express";
import API from "../api/index.js";
import { Route } from "../routes/index_.js";
import { RatelimitData, RatelimitMethods } from "../types.js";

// TODO Handle errors and prevent the app from crashing or at least from showing the logs

export default class Ratelimit {
  readonly #api: API;

  constructor(api: API) {
    this.#api = api;
  }

  private async get(
    method: RatelimitMethods,
    value: string | number,
    group: string
  ): Promise<RatelimitData | null> {
    const key = `ratelimit:${method}:${value}:${group}`;
    const query = await this.#api.keystore.client.hmget(
      key,
      "requests",
      "expiration_date"
    );

    if (query[0] && query[1]) {
      const data: RatelimitData = {
        requests: parseInt(query[0]),
        expirationDate: parseInt(query[1])
      };

      return data;
    }

    return null;
  }

  private async run(
    method: RatelimitMethods,
    value: string | number,
    group: string,
    timeframe: number | string,
    requests: number,
    use: boolean,
    add: boolean
  ): Promise<
    | {
        group: string;
        expirationDate: number;
      }
    | null
    | Error
  > {
    const get = await this.get(method, value, group);

    if (get) {
      if (use) {
        if (get.requests >= requests) {
          return {
            group,
            expirationDate: get.expirationDate
          };
        }
      }
    }

    if (add) {
      const update = await this.update(method, value, group, timeframe, get);
      if (update instanceof Error) {
        return update;
      }
    }

    return null;
  }

  private async update(
    method: RatelimitMethods,
    value: string | number,
    group: string,
    timeframe: number | string,
    data: RatelimitData | null
  ): Promise<RatelimitData | Error> {
    const key = `ratelimit:${method}:${value}:${group}`;

    if (data) {
      data.requests = data.requests + 1;
      const query = await this.#api.keystore.client.hset(
        key,
        "requests",
        data.requests
      );

      if (query !== 0) {
        // ?!
        return new Error("Unexpected keystore error.");
      }

      return data;
    } else {
      const convertTimeframe = timeToMs(timeframe);
      const data: RatelimitData = {
        requests: 1,
        expirationDate: Date.now() + convertTimeframe
      };
      const query = await this.#api.keystore.client
        .multi()
        .hmset(key, {
          requests: data.requests,
          expiration_date: data.expirationDate
        })
        .expire(key, convertTimeframe / 1000)
        .exec();

      if (query === null) {
        return new Error("Unexpected keystore error.");
      }

      return data;
    }
  }

  async use(
    routeFile: Route
  ): Promise<
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => Promise<void>
  > {
    return async (req, res, next) => {
      if (!routeFile.ratelimit.enabled) {
        return next();
      }

      const ratelimits: {
        method: RatelimitMethods;
        value: string | number;
        group: string;
        timeframe: number | string;
        requests: number;
        use: boolean;
        add: boolean;
      }[] = [];

      if (routeFile.ratelimit.ip.local.enabled) {
        ratelimits.push({
          method: "ip",
          value: req.ip as string,
          group: req.path,
          timeframe: routeFile.ratelimit.ip.local.timeframe,
          requests: routeFile.ratelimit.ip.local.requests,
          use: true,
          add: true
        });
      }

      for (const group of routeFile.ratelimit.ip.groups) {
        const config = this.#api.mode.config.ratelimitGroups[group.name];

        ratelimits.push({
          method: "ip",
          value: req.ip as string,
          group: group.name,
          timeframe: config.ip.timeframe,
          requests: config.ip.requests,
          use: group.use,
          add: group.add
        });
      }

      if (req.account) {
        if (routeFile.ratelimit.account.local.enabled) {
          ratelimits.push({
            method: "account",
            value: req.account.id,
            group: req.path,
            timeframe: routeFile.ratelimit.account.local.timeframe,
            requests: routeFile.ratelimit.account.local.requests,
            use: true,
            add: true
          });
        }

        for (const group of routeFile.ratelimit.account.groups) {
          const config = this.#api.mode.config.ratelimitGroups[group.name];

          ratelimits.push({
            method: "account",
            value: req.account.id,
            group: group.name,
            timeframe: config.account.timeframe,
            requests: config.account.requests,
            use: group.use,
            add: group.add
          });
        }
      }

      const mapRun = ratelimits.map(async (ratelimit) => {
        const run = await this.run(
          ratelimit.method,
          ratelimit.value,
          ratelimit.group,
          ratelimit.timeframe,
          ratelimit.requests,
          ratelimit.use,
          ratelimit.add
        );

        return run;
      });

      const run = await Promise.all(mapRun);

      const findErrors = run.filter(
        (x) => x instanceof Error
      ) as unknown as Error[];
      if (findErrors.length) {
        return next(findErrors[0]);
      }

      const triggered = run.filter(
        (x) => typeof x === "object" && x !== null
      ) as unknown as {
        group: string;
        expirationDate: number;
      }[];
      if (triggered.length) {
        const longestTime = triggered.reduce((max, x) => {
          return x.expirationDate > max ? x.expirationDate : max;
        }, triggered[0].expirationDate);

        return sar(res, 429, {
          code: 230004,
          messageId: "ratelimit",
          message: "Too many requests.",
          content: {
            expirationDate: longestTime
          }
        });
      }

      return next();
    };
  }
}
