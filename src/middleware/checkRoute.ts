// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { sar } from "commonlib-js";
import express from "express";
import ele from "express-list-endpoints";
import API from "../api/index.js";

export function checkRoute(api: API): express.RequestHandler {
  return (req, res, next): void => {
    const getEndpoints = ele(api.server.client);
    const findEndpoint = getEndpoints.find((x) => {
      const replace = x.path.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${replace}$`);

      return regex.test(req.path);
    });

    if (!findEndpoint) {
      return sar(res, 404, {
        code: 230001,
        messageId: "endpoint_not_found",
        message: "Endpoint not found."
      });
    }

    const method = req.method.toUpperCase();
    if (!findEndpoint.methods.includes(method)) {
      return sar(res, 404, {
        code: 230002,
        messageId: "endpoint_method_not_found",
        message: "Method not found for the current endpoint."
      });
    }

    return next();
  };
}
