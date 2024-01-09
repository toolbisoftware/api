// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { stopwatch } from "commonlib-js";
import pg from "pg";
import API from "../api/index.js";

export default class Database {
  readonly #api: API;
  readonly #config: pg.PoolConfig;
  connected: boolean;
  ping: number;
  readonly #pool: pg.Pool;
  #client: pg.PoolClient | null;

  constructor(api: API) {
    this.#api = api;
    this.#config = {
      host: this.#api.mode.config.databaseHost,
      port: this.#api.mode.config.databasePort,
      user: this.#api.mode.config.databaseUser,
      password: this.#api.mode.config.databasePassword,
      database: this.#api.mode.config.databaseDatabase,
      ssl: undefined, // TODO Implement SSL,
      application_name: "Toolbi API",
      max: 1,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true, // ?
      idleTimeoutMillis: 0,
      idle_in_transaction_session_timeout: undefined,
      statement_timeout: undefined, // ?
      query_timeout: 10000
    };
    this.connected = false;
    this.ping = NaN;
    this.#pool = this.createPool();
    this.#client = null;

    this.updatePing();
  }

  get client(): pg.PoolClient {
    if (!this.#client) {
      const message = "The client doesn't exist yet.";
      this.#api.logger.log("error", message, {
        category: "database"
      });
      throw new Error(message);
    }

    return this.#client;
  }

  private createPool(): pg.Pool {
    const pool = new pg.Pool(this.#config).on("error", (err) => {
      this.#api.logger.log("error", "Unhandled pool error.", {
        category: "database",
        error: err.stack
      });
    });

    return pool;
  }

  private async connect_(
    initial: boolean,
    maxAttempts?: number
  ): Promise<void> {
    const useStopwatch = stopwatch();

    const run = async (attempt?: number): Promise<boolean> => {
      try {
        this.#api.logger.log(
          "info",
          `Connecting to the database.${
            maxAttempts && attempt ? ` Attempt ${attempt}/${maxAttempts}.` : ""
          }`,
          {
            category: "database"
          }
        );

        const client = (await this.#pool.connect()).on("error", async (err) => {
          switch (err.message) {
            case "terminating connection due to administrator command":
            case "Connection terminated unexpectedly": {
              this.#api.logger.log("error", "Disconnected from the database.", {
                category: "database"
              });
              this.#api.logger.log(
                "info",
                "Trying to reconnect to the database.",
                { category: "database" }
              );

              this.connected = false;
              this.#client?.release();

              while (true) {
                if (await run()) {
                  break;
                }
              }

              break;
            }
            default: {
              this.#api.logger.log("error", "Unhandled client error.", {
                category: "database",
                error: err.stack
              });
            }
          }
        });

        this.#client = client;
        this.connected = true;
        this.#api.logger.log("done", "Connected to the database.", {
          category: "database",
          stopwatch: useStopwatch
        });

        return true;
      } catch (err) {
        if (maxAttempts && attempt) {
          if (attempt >= maxAttempts) {
            this.#api.logger.log(
              "fatal",
              "Couldn't connect to the database. Maximum number of attempts exceeded.",
              { category: "database" }
            );

            throw err;
          }
        }

        this.#api.logger.log(
          "error",
          `Couldn't connect to the database. Retrying in ${Math.floor(
            this.#api.config.shared.databaseConnectionAttemptWait / 1000
          )} seconds.`,
          {
            category: "database",
            error: err instanceof Error ? err.stack : undefined
          }
        );

        await new Promise((resolve) => {
          setTimeout(
            resolve,
            this.#api.config.shared.databaseConnectionAttemptWait
          );
        });

        return false;
      }
    };

    if (initial) {
      if (!maxAttempts) {
        const message =
          "The parameter 'maxAttempts' must be of type 'number' on the initial connection.";
        this.#api.logger.log("error", message, {
          category: "database"
        });
        throw new Error(message);
      }

      for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        if (await run(attempt)) {
          break;
        }
      }

      return;
    } else {
      while (true) {
        if (await run()) {
          break;
        }
      }
    }
  }

  private updatePing(): void {
    try {
      const run = async (): Promise<void> => {
        if (this.connected) {
          const useStopwatch = stopwatch();
          await this.client.query("SELECT 1");

          this.ping = Math.floor(useStopwatch.getTime());
        } else {
          this.ping = NaN;
        }
      };

      run();

      setInterval(async () => {
        run();
      }, 5000);
    } catch (err) {}
  }

  async connect(): Promise<void> {
    await this.connect_(
      true,
      this.#api.config.shared.databaseConnectionAttempts
    );

    await this.#api.account.createTables();
  }
}
