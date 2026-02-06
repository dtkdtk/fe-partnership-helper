import pino from "pino";
import { ConfigEnv } from "./corelib.js";

export const logger = pino({
  level: ConfigEnv.LOG_LEVEL,
  formatters: {
    bindings(_) { return {} },
  },
  base: {
    pid: false,
    hostname: false,
  },
  transport: {
    targets: [{
      target: "pino-rotate",
      options: {
        file: "./logs/%YYYY-MM-DD%.log",
        limit: "14d",
        json: true,
      },
    }]
  },
});
