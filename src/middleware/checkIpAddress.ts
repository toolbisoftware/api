// Copyright (c) Toolbi Software. All rights reserved.
// Check the README file in the project root for more information.

import { sar } from "commonlib-js";
import express from "express";

export const checkIpAddress = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  if (!req.ip) {
    return sar(res, 400, {
      code: 230003,
      messageId: "invalid_ip_address",
      message: "The IP address of the request is not valid."
    });
  }

  return next();
};
