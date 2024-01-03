// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

export type LoggerLogCategories = "api";

//

export type Modes = "development" | "production";

//

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

export interface ConfigShared {}

export type Config = {
  [K in Modes as K]: ConfigMode;
} & {
  shared: ConfigShared;
};
