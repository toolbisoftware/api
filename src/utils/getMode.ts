// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import API from "../api/index.js";
import type { Modes } from "../types.js";

export function getMode(api: API): Modes {
  if (process.argv.includes("-dev")) {
    api.logger.log("warn", "Running on development mode.", { category: "api" });
    return "development";
  } else {
    return "production";
  }
}
