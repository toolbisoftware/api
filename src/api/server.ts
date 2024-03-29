// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import express from "express";
import helmet from "helmet";
import { checkIpAddress } from "../middleware/checkIpAddress.js";
import { checkRoute } from "../middleware/checkRoute.js";
import { errorHandler } from "../middleware/errorHandler.js";
import Router from "../utils/router.js";
import API from "./index.js";

export default class Server {
  readonly #api: API;
  readonly client: express.Express;

  constructor(api: API) {
    this.#api = api;
    this.client = express();
  }

  private async createRouter(): Promise<express.Router> {
    const useCheckIpAddress = checkIpAddress;

    const preHandlers: express.Handler[] = [useCheckIpAddress];
    const postHandlers: express.Handler[] = [];

    const router = await new Router(this.#api).init(preHandlers, postHandlers);

    return router;
  }

  async init() {
    this.client.use(express.json());
    this.client.use(express.urlencoded({ extended: true }));
    this.client.use(helmet());
    this.client.use(checkRoute(this.#api));
    this.client.use("/", await this.createRouter());
    this.client.use(errorHandler(this.#api));
    this.client.listen(this.#api.mode.config.port, "0.0.0.0");

    this.#api.logger.log(
      "info",
      `Listening on port '${this.#api.mode.config.port}'.`,
      {
        category: "server"
      }
    );
  }
}
