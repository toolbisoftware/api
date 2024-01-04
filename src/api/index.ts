// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { Logger, stopwatch } from "commonlib-js";
import config from "../config.js";
import type {
  Config,
  ConfigMode,
  LoggerLogCategories,
  Modes
} from "../types.js";
import { getMode } from "../utils/getMode.js";
import Server from "./server.js";

export default class API {
  readonly logger: Logger<LoggerLogCategories>;
  readonly mode: {
    current: Modes;
    config: ConfigMode;
  };
  readonly config: Config;
  readonly server: Server;

  constructor() {
    const useStopwatch = stopwatch();

    this.logger = new Logger<LoggerLogCategories>({
      categories: [
        { name: "api", text: "API" },
        { name: "router", text: "ROUTER" }
      ]
    });
    this.logger.log("info", "Initializing.", { category: "api" });

    const currentMode = getMode(this);

    this.config = config;
    this.mode = {
      current: currentMode,
      config: config[currentMode]
    };
    this.server = new Server(this);

    this.logger.log("info", "Initialized.", {
      category: "api",
      stopwatch: useStopwatch
    });
  }

  async start() {
    const useStopwatch = stopwatch();

    this.logger.log("info", "Starting.", { category: "api" });

    await this.server.init();

    this.logger.log("done", "Started.", {
      category: "api",
      stopwatch: useStopwatch
    });
  }
}
