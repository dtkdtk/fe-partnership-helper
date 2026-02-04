import pino from "pino";
import { ConfigEnv } from "./corelib.js";

export const logger = pino({
  level: ConfigEnv.ENABLE_DEBUG ? "trace" : "info",
  formatters: {
    bindings(_) { return {} },
  },
  base: undefined,
  transport: {
    targets: [{
      target: "pino-rotate",
      options: {
        file: "./logs/%YYYY-MM-DD%.log",
        limit: "14d",
      },
    }]
  },
});
