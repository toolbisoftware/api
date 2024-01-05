// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { stopwatch } from "commonlib-js";
import redis from "ioredis";
import API from "../api/index.js";

export default class Keystore {
  readonly #api: API;
  readonly #config: redis.RedisOptions;
  #initialConnection: boolean;
  #connecting: boolean;
  connected: boolean;
  ping: number;
  client: redis.Redis;

  constructor(api: API) {
    this.#api = api;
    this.#config = {
      host: this.#api.mode.config.keystoreHost,
      port: this.#api.mode.config.keystorePort,
      username: this.#api.mode.config.keystoreUser,
      password: this.#api.mode.config.keystorePassword,
      db: this.#api.mode.config.keystoreDatabase,
      tls: undefined, // TODO Implement TLS
      connectionName: "Toolbi API",
      lazyConnect: true,
      connectTimeout: 5000,
      keepAlive: 1,
      disconnectTimeout: undefined, // ?
      commandTimeout: 10000,
      retryStrategy: () => {
        return;
      }
    };
    this.#initialConnection = true;
    this.#connecting = false;
    this.connected = false;
    this.ping = NaN;
    this.client = this.createClient();

    this.updatePing();
  }

  private createClient(): redis.Redis {
    const client = new redis.Redis(this.#config)
      .on("error", (err) => {
        switch (err.message) {
          case `connect ECONNREFUSED ${this.#api.mode.config.keystoreHost}:${
            this.#api.mode.config.keystorePort
          }`: {
            return;
          }
          default: {
            this.#api.logger.log("error", "Unhandled client error.", {
              category: "keystore",
              error: err.stack
            });
          }
        }
      })
      .on("close", async () => {
        if (!this.#initialConnection && !this.#connecting) {
          this.connected = false;

          this.#api.logger.log("warn", "Disconnected from the keystore.", {
            category: "keystore"
          });
          this.#api.logger.log("info", "Trying to reconnect to the keystore.", {
            category: "keystore"
          });

          await this.connect_();
        }
      });

    return client;
  }

  private async connect_(maxAttempts?: number): Promise<void> {
    this.#connecting = true;

    const useStopwatch = stopwatch();
    const run = async (attempt?: number): Promise<boolean> => {
      try {
        this.#api.logger.log(
          "info",
          `Connecting to the keystore.${
            maxAttempts && attempt ? ` Attempt ${attempt}/${maxAttempts}.` : ""
          }`,
          { category: "keystore" }
        );

        await this.client.connect();

        this.#api.logger.log("done", "Connected to the keystore.", {
          category: "keystore",
          stopwatch: useStopwatch
        });

        return true;
      } catch (err) {
        if (maxAttempts && attempt) {
          if (attempt >= maxAttempts) {
            this.#api.logger.log(
              "fatal",
              "Couldn't connect to the keystore. Maximum number of attempts exceeded.",
              { category: "keystore" }
            );

            throw err;
          }
        }

        this.#api.logger.log(
          "error",
          `Couldn't connect to the keystore. Retrying in ${Math.floor(
            this.#api.config.shared.keystoreConnectionAttemptWait / 1000
          )} seconds.`,
          {
            category: "keystore",
            error: err instanceof Error ? err.stack : undefined
          }
        );

        await new Promise((resolve) => {
          setTimeout(
            resolve,
            this.#api.config.shared.keystoreConnectionAttemptWait
          );
        });

        return false;
      }
    };

    if (this.#initialConnection) {
      if (!maxAttempts) {
        const message =
          "The parameter 'maxAttempts' must be of type 'number' on the initial connection.";
        this.#api.logger.log("error", message, {
          category: "keystore"
        });
        throw new Error(message);
      }

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        if (await run(attempt)) {
          break;
        }
      }

      this.#initialConnection = false;

      return;
    } else {
      while (true) {
        if (await run()) {
          break;
        }
      }
    }

    this.#connecting = false;
    this.connected = true;
  }

  private updatePing(): void {
    try {
      const run = async (): Promise<void> => {
        if (this.connected) {
          const useStopwatch = stopwatch();
          await this.client.ping();

          this.ping = Math.floor(useStopwatch.getTime());
        } else {
          this.ping = NaN;
        }
      };

      run();

      setInterval(async () => {
        run();
      }, 5000);
    } catch (err) {
      console.log(err);
    }
  }

  async connect(): Promise<void> {
    await this.connect_(this.#api.config.shared.keystoreConnectionAttempts);
  }
}
