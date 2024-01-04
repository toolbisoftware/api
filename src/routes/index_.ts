// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import API from "../api/index.js";
import type { RouteMethods, RouteOptions } from "../types.js";

export class Route {
  readonly api: API;
  readonly enabled: boolean;
  readonly methods: RouteMethods;

  constructor(api: API, options: RouteOptions, methods: RouteMethods) {
    this.api = api;
    this.enabled = options.enabled;
    this.methods = methods;
  }
}
