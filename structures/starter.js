import "dotenv/config";
import { ConfigEnv } from "../dist/lib/getconfig.js";
(await import("./worker.js")).FEWorker.setup(ConfigEnv);
