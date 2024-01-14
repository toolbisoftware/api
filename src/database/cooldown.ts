// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import API from "../api/index.js";
import { CooldownGroups } from "../types.js";

export default class Cooldown {
  readonly #api: API;

  constructor(api: API) {
    this.#api = api;
  }

  private async createGroup(name: string): Promise<void> {
    try {
      const exists = await this.#api.database.client.query(
        `SELECT 1 FROM account_cooldown_group WHERE name = $1`,
        [name]
      );
      if (exists.rows.length === 0) {
        const create = await this.#api.database.client.query(
          `INSERT INTO account_cooldown_group (name) VALUES ($1)`,
          [name]
        );
        if (create.rowCount !== 1) {
          throw new Error();
        }
      }
    } catch (err) {
      this.#api.logger.log("error", "Database query error:", {
        category: "database",
        error: err instanceof Error ? err.stack : undefined
      });

      throw err;
    }
  }

  async setupTables(): Promise<void> {
    const groups = Object.keys(
      this.#api.mode.config.cooldownGroups
    ) as CooldownGroups[];

    try {
      await Promise.all([
        this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS account_cooldown (
          account_id INTEGER REFERENCES account(id) ON DELETE CASCADE NOT NULL,
          group_name VARCHAR(30) REFERENCES account_cooldown_group(name) ON DELETE CASCADE NOT NULL,
          requests INTEGER NOT NULL,
          creation_date TIMESTAMP
        )`),
        this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_cooldown_group" (
          "name" VARCHAR(30) PRIMARY KEY NOT NULL
        )`)
      ]);

      await Promise.all(
        groups.map(async (group) => {
          await this.createGroup(group);
        })
      );
    } catch (err) {
      this.#api.logger.log("error", "Couldn't setup the tables.", {
        category: "database",
        error: err instanceof Error ? err.stack : undefined
      });

      throw err;
    }
  }
}
