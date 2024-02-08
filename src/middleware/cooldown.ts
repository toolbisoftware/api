// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { jsonStrToObj, sar, timeToMs } from "commonlib-js";
import express from "express";
import API from "../api/index.js";
import { Route } from "../routes/index_.js";
import type {
  CooldownData,
  CooldownGroups,
  CooldownMethods
} from "../types.js";

export default class Cooldown {
  readonly #api: API;

  constructor(api: API) {
    this.#api = api;
  }

  // TODO Make a function to scan an object and convert the Date entries to number and viceversa.

  private convertMethodToKey(
    method: CooldownMethods
  ): "ip_address" | "account_id" {
    switch (method) {
      case "ip": {
        return "ip_address";
      }
      case "account": {
        return "account_id";
      }
    }
  }

  private async get(
    method: CooldownMethods,
    value: string | number,
    group: CooldownGroups
  ): Promise<CooldownData | null> {
    const methodKey = this.convertMethodToKey(method);

    const fromKeystore = async (): Promise<CooldownData | null> => {
      const key = `cache:cooldown:${method}:${value}:${group}`;
      const query = await this.#api.keystore.client.get(key);

      if (query) {
        const rawData = jsonStrToObj(query) as unknown as any;
        if (rawData) {
          const data: CooldownData = {
            method,
            value: rawData[methodKey],
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
        `SELECT * FROM ${method}_cooldown WHERE ${methodKey} = $1 AND group_name = $2`,
        [value, group]
      );

      if (query.rows.length === 1) {
        const data: CooldownData = {
          method,
          value: query.rows[0][methodKey],
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
    method: CooldownMethods,
    value: string | number,
    group: CooldownGroups,
    requests: number,
    creationDate: number
  ): Promise<CooldownData | Error> {
    const methodKey = this.convertMethodToKey(method);

    let data: any = {};
    data[methodKey] = value;
    data = {
      ...data,
      group_name: group,
      requests,
      creation_date: new Date(creationDate)
    };

    const keystore = async (): Promise<void | Error> => {
      const key = `cache:cooldown:${method}:${value}:${group}`;

      let modifiedData: any = {};
      modifiedData[methodKey] = value;
      modifiedData = {
        ...modifiedData,
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
        const values: [number, string | number, CooldownGroups, Date?] = [
          requests,
          value,
          group
        ];
        if (updateCreationDate) {
          values.push(new Date(creationDate));
        }

        await this.#api.database.client.query(
          `
          UPDATE ${method}_cooldown
          SET
            requests = $1${
              updateCreationDate
                ? `,
            creation_date = $4`
                : ""
            }
          WHERE
            ${methodKey} = $2 AND
            group_name = $3
          `,
          values
        );
      } else {
        await this.#api.database.client.query(
          `
          INSERT INTO ${method}_cooldown (
            ${methodKey},
            group_name,
            requests,
            creation_date
          ) VALUES (
            $1, $2, $3, $4
          )
          `,
          [value, group, requests, new Date()]
        );
      }
    };

    const saveOnKeystore = await keystore();
    if (saveOnKeystore instanceof Error) {
      return saveOnKeystore;
    }

    database();

    const cooldownData: CooldownData = {
      method,
      value,
      group,
      requests,
      creationDate: new Date(creationDate)
    };

    return cooldownData;
  }

  private async reset(
    method: CooldownMethods,
    value: string | number,
    group: CooldownGroups,
    timeframe: number | string,
    data: CooldownData
  ): Promise<CooldownData | Error> {
    if (Date.now() >= data.creationDate.getTime() + timeToMs(timeframe)) {
      const set = await this.set(
        true,
        true,
        method,
        value,
        group,
        1,
        Date.now()
      );

      return set;
    }

    return data;
  }

  private async updater(
    groups: {
      method: CooldownMethods;
      value: string | number;
      group: CooldownGroups;
    }[]
  ): Promise<{
    run: typeof run;
  }> {
    const run = async (
      entries: { method: CooldownMethods; group: CooldownGroups }[]
    ) => {
      const usedGroups: typeof groups = [];
      for (const group of entries) {
        const get = groups.find(
          (x) => group.method === x.method && group.group === x.group
        );
        if (get) {
          usedGroups.push(get);
        } else {
          continue;
        }
      }

      const mapRun = usedGroups.map(async (group) => {
        const data = await this.get(group.method, group.value, group.group);
        if (data) {
          const set = await this.set(
            true,
            false,
            group.method,
            group.value,
            group.group,
            data.requests + 1,
            data.creationDate.getTime()
          );
          if (set instanceof Error) {
            throw set;
          }

          return set;
        } else {
          const set = await this.set(
            false,
            false,
            group.method,
            group.value,
            group.group,
            1,
            Date.now()
          );
          if (set instanceof Error) {
            throw set;
          }

          return set;
        }
      });

      await Promise.all(mapRun);

      return;
    };

    return {
      run
    };
  }

  private async run(
    method: CooldownMethods,
    value: string | number,
    group: CooldownGroups,
    timeframe: number | string,
    requests: number,
    enabled: boolean,
    use: boolean
  ): Promise<{ group: string; expirationDate: number } | null | Error> {
    if (!enabled) {
      return null;
    }

    let data = await this.get(method, value, group);

    if (data) {
      const reset = await this.reset(method, value, group, timeframe, data);
      if (reset instanceof Error) {
        return reset;
      }

      data = reset;

      if (use) {
        if (data.requests > requests) {
          return {
            group,
            expirationDate: data.creationDate.getTime() + timeToMs(timeframe)
          };
        } else {
          return null;
        }
      }
    }

    return null;
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
      if (!routeFile.cooldown.enabled) {
        return next();
      }

      const cooldowns: {
        method: CooldownMethods;
        value: string | number;
        group: CooldownGroups;
        timeframe: number | string;
        requests: number;
        enabled: boolean;
        use: boolean;
      }[] = [];

      for (const group of routeFile.cooldown.ip) {
        const config = this.#api.mode.config.cooldownGroups[group.name].ip;

        cooldowns.push({
          method: "ip",
          value: req.ip as string,
          group: group.name,
          timeframe: config.timeframe,
          requests: config.requests,
          enabled: config.enabled,
          use: group.use
        });
      }

      if (req.account) {
        for (const group of routeFile.cooldown.account) {
          const config =
            this.#api.mode.config.cooldownGroups[group.name].account;

          cooldowns.push({
            method: "account",
            value: req.account.id,
            group: group.name,
            timeframe: config.timeframe,
            requests: config.requests,
            enabled: config.enabled,
            use: group.use
          });
        }
      }

      const mapRun = cooldowns.map(async (cooldown) => {
        const run = await this.run(
          cooldown.method,
          cooldown.value,
          cooldown.group,
          cooldown.timeframe,
          cooldown.requests,
          cooldown.enabled,
          cooldown.use
        );
        if (run instanceof Error) {
          throw run;
        }

        return run;
      });

      const run = await Promise.all(mapRun);

      const findErrors = run.filter(
        (x) => x instanceof Error
      ) as unknown as Error[];
      if (findErrors.length) {
        // TODO Maybe stack the errors and show all.
        return next(findErrors[0]);
      }

      const triggered = run.filter(
        (x) => typeof x === "object" && x !== null
      ) as unknown as { group: CooldownGroups; expirationDate: number }[];
      if (triggered.length) {
        const longestTime = triggered.reduce((max, x) => {
          return x.expirationDate > max ? x.expirationDate : max;
        }, triggered[0].expirationDate);

        return sar(res, 429, {
          code: 230005,
          messageId: "cooldown",
          message: "Too many requests.",
          content: {
            expirationDate: longestTime
          }
        });
      }

      const setupUpdater = await this.updater(
        cooldowns
          .filter((cooldown) => cooldown.enabled)
          .map((cooldown) => {
            return {
              method: cooldown.method,
              value: cooldown.value,
              group: cooldown.group
            };
          })
      );

      req.cooldown = {
        update: setupUpdater.run
      };

      return next();
    };
  }
}
