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
          "information_name" VARCHAR(30) NOT NULL,
          "information_birthDate" DATE NOT NULL,
          "information_username" VARCHAR(30) NOT NULL,
          "security_emailAddress" VARCHAR(320) NOT NULL,
          "security_password" VARCHAR(256) NOT NULL,
          "timestamp_creation" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "timestamp_deletion" TIMESTAMP
        )`);
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_role" (
          "id" SERIAL PRIMARY KEY,
          "name" VARCHAR(100) NOT NULL,
          "timestamp_creation" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "timestamp_deletion" TIMESTAMP
        )`);
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_log" (
          "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          "date" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "account_id" INTEGER REFERENCES account(id) ON DELETE CASCADE NOT NULL,
          "type" VARCHAR(30) NOT NULL,
          "content" VARCHAR(512) NOT NULL
        )`);
      await this.#api.database.client.query(`
        CREATE TABLE IF NOT EXISTS "account_role_data" (
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

