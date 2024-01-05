// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { sar } from "commonlib-js";
import express from "express";
import API from "../api/index.js";

export function errorHandler(api: API): express.ErrorRequestHandler {
  return (err: Error, _req, res): void => {
    api.logger.log(
      "error",
      "An error occurred while trying to process a request.",
      {
        category: "request",
        error: err.stack
      }
    );

    return sar(res, 500, {
      code: 230000,
      messageId: "error",
      message: "An error occurred while trying to process the request."
    });
  };
}
