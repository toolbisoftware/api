// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { GetPathsPath } from "commonlib-js";
import express from "express";
import API from "./api/index.js";
import { Route } from "./routes/index_.js";

export type LoggerLogCategories = "api" | "router" | "request" | "server";

//
//

export type HttpMethods =
  | "connect"
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put"
  | "trace";

//
//

export type Modes = "development" | "production";

export interface ConfigRatelimitGroup {
  ip: {
    enabled: boolean;
    timeframe: number | string;
    requests: number;
  };
  account: {
    enabled: boolean;
    timeframe: number | string;
    requests: number;
  };
}

export interface ConfigCooldownGroup {
  ip: { enabled: boolean; timeframe: number | string; requests: number };
  account: { enabled: boolean; timeframe: number | string; requests: number };
}

export interface ConfigMode {
  host: string;
  port: number;
  url: string;
  databaseHost: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
  databaseDatabase: string;
  keystoreHost: string;
  keystorePort: number;
  keystoreUser: string;
  keystorePassword: string;
  keystoreDatabase: number;
  ratelimitGroups: {
    [K in RatelimitGroups as K]: ConfigRatelimitGroup;
  };
  cooldownCacheLifespan: number;
  cooldownGroups: {
    [K in CooldownGroups as K]: ConfigCooldownGroup;
  };
}

export interface ConfigShared {
  databaseConnectionAttempts: number;
  databaseConnectionAttemptWait: number;
  keystoreConnectionAttempts: number;
  keystoreConnectionAttemptWait: number;
}

export type Config = {
  [K in Modes as K]: ConfigMode;
} & {
  shared: ConfigShared;
};

//
//

export type RouterFileInfo = GetPathsPath;

export type RouteRequestMethods = HttpMethods;

export type RouteMethods = {
  [K in RouteRequestMethods as K]?: express.Handler;
};

export type RouterRoute = {
  path: string;
  methods: RouteMethods;
  file: Route;
  priority: number;
};

export interface RouteRatelimitGroup {
  name: RatelimitGroups;
  use: boolean;
  add: boolean;
}

export interface RouteOptionsRatelimit {
  enabled: boolean;
  ip: {
    local: {
      enabled: boolean;
      timeframe: number | string;
      requests: number;
    };
    groups: RouteRatelimitGroup[];
  };
  account: {
    local: {
      enabled: boolean;
      timeframe: number | string;
      requests: number;
    };
    groups: RouteRatelimitGroup[];
  };
}

export interface RouteCooldownGroup {
  name: CooldownGroups;
  use: boolean;
}

export interface RouteOptionsCooldown {
  enabled: boolean;
  ip: RouteCooldownGroup[];
  account: RouteCooldownGroup[];
}

export interface RouteOptions {
  enabled: boolean;
  ratelimit: RouteOptionsRatelimit;
  cooldown: RouteOptionsCooldown;
}

export interface RouteConstructor extends Route {
  new (api: API): Route;
}

//
//

export type RatelimitMethods = "ip" | "account";

export type RatelimitGroups = "global";

export interface RatelimitData {
  requests: number;
  expirationDate: number;
}

export type CooldownMethods = "ip" | "account";

export type CooldownGroups = "test";

export interface CooldownData {
  method: CooldownMethods;
  value: string | number;
  group: CooldownGroups;
  requests: number;
  creationDate: Date;
}

//
//

export interface Account {
  id: number;
}

//
//

declare module "express-serve-static-core" {
  interface Request {
    account?: Account;
    cooldown: {
      update: (
        entries: {
          method: CooldownMethods;
          group: CooldownGroups;
        }[]
      ) => Promise<void>;
    };
  }
}
