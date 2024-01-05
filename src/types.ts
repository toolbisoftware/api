// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { GetPathsPath } from "commonlib-js";
import express from "express";
import API from "./api/index.js";
import { Route } from "./routes/index_.js";

export type LoggerLogCategories = "api" | "router" | "request";

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

export interface RouteOptions {
  enabled: boolean;
}

export interface RouteConstructor extends Route {
  new (api: API): Route;
}
