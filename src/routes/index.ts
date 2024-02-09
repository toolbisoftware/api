// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { sar } from "commonlib-js";
import API from "../api/index.js";
import { Route } from "./index_.js";

export default class extends Route {
  constructor(api: API) {
    super(
      api,
      {
        enabled: true,
        ratelimit: {
          enabled: true,
          ip: {
            local: { enabled: false, timeframe: 0, requests: 0 },
            groups: [{ name: "global", use: true, add: true }]
          },
          account: {
            local: { enabled: false, timeframe: 0, requests: 0 },
            groups: [{ name: "global", use: true, add: true }]
          }
        },
        cooldown: {
          enabled: false,
          ip: [],
          account: []
        }
      },
      {
        get: (_req, res) => {
          return sar(res, 200, {
            code: 100000,
            messageId: "welcome",
            message: "Welcome to the Toolbi API."
          });
        }
      }
    );
  }
}
