// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { jsonStrToObj, sar, timeToMs } from "commonlib-js";
import express from "express";
import API from "../api/index.js";
import { Route } from "../routes/index_.js";
import type {
  ConfigCooldownGroup,
  CooldownData,
  CooldownGroups
} from "../types.js";

export default class Cooldown {
  readonly #api: API;

  constructor(api: API) {
    this.#api = api;
  }

  private async get(
    accountId: number,
    group: CooldownGroups
  ): Promise<CooldownData | null> {
    const fromKeystore = async (): Promise<CooldownData | null> => {
      const key = `cache:cooldown:${accountId}:${group}`;
      const query = await this.#api.keystore.client.get(key);

      if (query) {
        const rawData = jsonStrToObj(query) as unknown as any;
        if (rawData) {
          const data: CooldownData = {
            accountId: rawData.account_id,
            group: rawData.group_name,
            requests: rawData.requests,
            creationDate: new Date(rawData.creation_date)
          };

          return data;
        }
      }

      return null;
    };

    const fromDatabase = async (): Promise<CooldownData | null> => {
      const query = await this.#api.database.client.query(
        `SELECT * FROM account_cooldown WHERE account_id = $1 AND group_name = $2`,
        [accountId, group]
      );

      if (query.rows.length === 1) {
        const data: CooldownData = {
          accountId: query.rows[0].account_id,
          group: query.rows[0].group_name,
          requests: query.rows[0].requests,
          creationDate: query.rows[0].creation_date
        };

        return data;
      }

      return null;
    };

    const keystore = await fromKeystore();
    if (keystore) {
      return keystore;
    } else {
      const database = await fromDatabase();
      if (database) {
        return database;
      } else {
        return null;
      }
    }
  }

  private async set(
    isUpdate: boolean,
    updateCreationDate: boolean,
    accountId: number,
    group: CooldownGroups,
    requests: number,
    creationDate: number
  ): Promise<CooldownData | Error> {
    const data = {
      account_id: accountId,
      group_name: group,
      requests,
      creation_date: new Date(creationDate)
    };

    const keystore = async (): Promise<void | Error> => {
      const key = `cache:cooldown:${accountId}:${group}`;
      const modifiedData = {
        account_id: accountId,
        group_name: group,
        requests,
        creation_date: creationDate
      };
      const query = await this.#api.keystore.client.setex(
        key,
        this.#api.mode.config.cooldownCacheLifespan,
        JSON.stringify(modifiedData)
      );

      if (query !== "OK") {
        return new Error("Unexpected keystore error.");
      }
    };

    const database = async (): Promise<void> => {
      if (isUpdate) {
        const values: [number, number, CooldownGroups, Date?] = [
          requests,
          accountId,
          group
        ];
        if (updateCreationDate) {
          values.push(new Date(creationDate));
        }
        this.#api.database.client.query(
          `
          UPDATE account_cooldown
          SET
            requests = $1${
              updateCreationDate
                ? `,
            creation_date = $4`
                : ""
            }
          WHERE
            account_id = $2 AND
            group_name = $3
          `,
          values
        );
      } else {
        this.#api.database.client.query(
          `
          INSERT INTO account_cooldown (
            account_id,
            group_name,
            requests,
            creation_date
          ) VALUES (
            $1, $2, $3, $4
          )
          `,
          [accountId, group, requests, new Date()]
        );
      }
    };

    const saveOnKeystore = await keystore();
    if (saveOnKeystore instanceof Error) {
      return saveOnKeystore;
    }

    database();

    const cooldownData: CooldownData = {
      accountId: data.account_id,
      group: data.group_name,
      requests: data.requests,
      creationDate: data.creation_date
    };

    return cooldownData;
  }

  private async update(
    add: boolean,
    accountId: number,
    groupName: CooldownGroups,
    data: CooldownData | null
  ): Promise<CooldownData | Error> {
    if (data) {
      if (!add) return data;

      const set = await this.set(
        true,
        false,
        accountId,
        groupName,
        data.requests + 1,
        data.creationDate.getTime()
      );
      return set;
    } else {
      const set = await this.set(
        false,
        false,
        accountId,
        groupName,
        1,
        Date.now()
      );
      return set;
    }
  }

  private async reset(
    accountId: number,
    groupName: CooldownGroups,
    groupConfig: ConfigCooldownGroup,
    data: CooldownData
  ): Promise<[CooldownData | Error, boolean]> {
    if (
      Date.now() >=
      data.creationDate.getTime() + timeToMs(groupConfig.timeframe)
    ) {
      const set = await this.set(
        true,
        true,
        accountId,
        groupName,
        1,
        Date.now()
      );
      return [set, true];
    }

    return [data, false];
  }

  async use(
    routeFile: Route
  ): Promise<
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => Promise<void>
  > {
    return async (req, res, next) => {
      if (!routeFile.cooldown.enabled || !req.account) {
        return next();
      }

      const cooldown: {
        triggered: boolean;
        expireDate: number;
        groupName: CooldownGroups;
      } = {
        triggered: false,
        expireDate: 0,
        groupName: null as unknown as CooldownGroups
      };

      // TODO Maybe map the groups and run them in parallel
      for (const group of routeFile.cooldown.groups) {
        const config = this.#api.mode.config.cooldownGroups[group.name];
        let data = await this.get(req.account.id, group.name);
        let hasReseted = false;

        if (data) {
          const [reset, reseted] = await this.reset(
            req.account.id,
            group.name,
            config,
            data
          );
          if (reset instanceof Error) {
            return next(reset);
          }

          data = reset;
          hasReseted = reseted;
        }

        if (group.use) {
          if (data) {
            if (data.requests >= config.requests) {
              const lifespan =
                data.creationDate.getTime() + timeToMs(config.timeframe);
              cooldown.triggered = true;
              if (lifespan > cooldown.expireDate) {
                cooldown.expireDate = lifespan;
                cooldown.groupName = data.group;
              }
            } else {
              if (!hasReseted) {
                const update = await this.update(
                  group.add,
                  req.account.id,
                  group.name,
                  data
                );
                if (update instanceof Error) {
                  return next(update);
                }
              }
            }
          } else {
            const set = await this.set(
              false,
              false,
              req.account.id,
              group.name,
              1,
              Date.now()
            );
            if (set instanceof Error) {
              return next(set);
            }
          }
        }
      }

      if (cooldown.triggered) {
        return sar(res, 429, {
          code: 230005,
          messageId: "cooldown",
          message: "Too many requests.",
          content: {
            expireDate: cooldown.expireDate
          }
        });
      }

      return next();
    };
  }
}
