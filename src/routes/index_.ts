// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import API from "../api/index.js";
import type {
  RouteMethods,
  RouteOptions,
  RouteOptionsCooldown,
  RouteOptionsRatelimit
} from "../types.js";

export class Route {
  readonly api: API;
  readonly enabled: boolean;
  readonly ratelimit: RouteOptionsRatelimit;
  readonly cooldown: RouteOptionsCooldown;
  readonly methods: RouteMethods;

  constructor(api: API, options: RouteOptions, methods: RouteMethods) {
    this.api = api;
    this.enabled = options.enabled;
    this.ratelimit = options.ratelimit;
    this.cooldown = options.cooldown;
    this.methods = methods;
  }
}
