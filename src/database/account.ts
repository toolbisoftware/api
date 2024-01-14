// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { ReturnHandlerObject, returnHandler } from "commonlib-js";
import joi from "joi";
import API from "../api/index.js";

export default class Account {
  readonly #api: API;

  constructor(api: API) {
    this.#api = api;
  }

  async createTables(): Promise<void> {
    try {
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account" (
          "id" SERIAL PRIMARY KEY,
          "name" VARCHAR(30) NOT NULL,
          "birth_date" DATE NOT NULL,
          "username" VARCHAR(30) NOT NULL,
          "email_address" VARCHAR(320) NOT NULL,
          "password" VARCHAR(256) NOT NULL,
          "creation_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "deletion_date" TIMESTAMP
        )`);
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_role" (
          "id" SERIAL PRIMARY KEY,
          "name" VARCHAR(100) NOT NULL,
          "creation_date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "deletion_date" TIMESTAMP
        )`);
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_log" (
          "id" UUID DEFAULT gen_random_uuid(),
          "date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "account_id" INTEGER REFERENCES account(id) ON DELETE CASCADE NOT NULL,
          "type" VARCHAR(30) NOT NULL,
          "content" VARCHAR(512) NOT NULL
        )`);
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_roles" (
          "account_id" INTEGER REFERENCES account(id) ON DELETE CASCADE NOT NULL,
          "role_id" INTEGER REFERENCES account_role(id) ON DELETE CASCADE NOT NULL,
          PRIMARY KEY (account_id, role_id)
        )`);
    } catch (err) {
      this.#api.logger.log("error", "Couldn't create the tables.", {
        category: "database",
        error: err instanceof Error ? err.stack : undefined
      });

      throw err;
    }
  }

