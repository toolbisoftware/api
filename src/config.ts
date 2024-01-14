// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import * as developmentSecrets from "./secrets/development.js";
import * as productionSecrets from "./secrets/production.js";
import type { Config, ConfigMode, ConfigShared } from "./types.js";

const development: ConfigMode = {
  host: developmentSecrets.HOST,
  port: developmentSecrets.PORT,
  url: developmentSecrets.URL,
  databaseHost: developmentSecrets.DATABASE_HOST,
  databasePort: developmentSecrets.DATABASE_PORT || 5432,
  databaseUser: developmentSecrets.DATABASE_USER || "postgres",
  databasePassword: developmentSecrets.DATABASE_PASSWORD,
  databaseDatabase: developmentSecrets.DATABASE_DATABASE,
  keystoreHost: developmentSecrets.KEYSTORE_HOST,
  keystorePort: developmentSecrets.KEYSTORE_PORT || 6379,
  keystoreUser: developmentSecrets.KEYSTORE_USER || "default",
  keystorePassword: developmentSecrets.KEYSTORE_PASSWORD,
  keystoreDatabase: developmentSecrets.KEYSTORE_DATABASE,
  ratelimitGroups: {
    global: {
      ip: {
        enabled: true,
        timeframe: "1m",
        requests: 60
      },
      account: {
        enabled: true,
        timeframe: "1m",
        requests: 30
      }
    }
  },
  cooldownCacheLifespan: 900, // 15 min -> 900 sec
  cooldownGroups: {
    test: {
      enabled: false,
      timeframe: 0,
      requests: 0
    }
  }
};

const production: ConfigMode = {
  host: productionSecrets.HOST,
  port: productionSecrets.PORT,
  url: productionSecrets.URL,
  databaseHost: productionSecrets.DATABASE_HOST,
  databasePort: productionSecrets.DATABASE_PORT || 5432,
  databaseUser: productionSecrets.DATABASE_USER || "postgres",
  databasePassword: productionSecrets.DATABASE_PASSWORD,
  databaseDatabase: productionSecrets.DATABASE_DATABASE,
  keystoreHost: productionSecrets.KEYSTORE_HOST,
  keystorePort: productionSecrets.KEYSTORE_PORT || 6379,
  keystoreUser: productionSecrets.KEYSTORE_USER || "default",
  keystorePassword: productionSecrets.KEYSTORE_PASSWORD,
  keystoreDatabase: productionSecrets.KEYSTORE_DATABASE,
  ratelimitGroups: {
    global: {
      ip: {
        enabled: true,
        timeframe: "1m",
        requests: 60
      },
      account: {
        enabled: true,
        timeframe: "1m",
        requests: 30
      }
    }
  },
  cooldownCacheLifespan: 900, // 15 min -> 900 sec
  cooldownGroups: {
    test: {
      enabled: false,
      timeframe: 0,
      requests: 0
    }
  }
};

const shared: ConfigShared = {
  databaseConnectionAttempts: 10,
  databaseConnectionAttemptWait: 5000,
  keystoreConnectionAttempts: 10,
  keystoreConnectionAttemptWait: 5000
};

export default {
  development,
  production,
  shared
} as Config;
