// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import express from "express";
import helmet from "helmet";
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
    const preHandlers: express.Handler[] = [];
    const postHandlers: express.Handler[] = [];

    const router = await new Router(this.#api).init(preHandlers, postHandlers);

    return router;
  }

  async init() {
    this.client.use(express.json());
    this.client.use(express.urlencoded({ extended: true }));
    this.client.use(helmet());
    this.client.use("/", await this.createRouter());
    this.client.listen(this.#api.mode.config.port, "0.0.0.0");
  }
}
