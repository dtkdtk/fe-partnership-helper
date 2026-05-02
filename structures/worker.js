import { Worker } from "worker_threads";
import { FEWatchdog } from "./watchdog.js";

const MAX_FAILS = 6;

class LocalFEWorker {
  /** @type {Worker} */
  worker;
  /** @type {FEWatchdog} */
  watchdog;
  fails = 0;
  ConfigEnv;

  setup(ConfigEnv) {
    this.ConfigEnv = ConfigEnv;
    if (ConfigEnv.WATCHDOG_BOT_ENABLED) {
      this.watchdog = new FEWatchdog(ConfigEnv);
      this.watchdog.start();
    }
    this.createWorker();
  }
  createWorker() {
    this.worker = new Worker("./dist/index.js");
    if (!this.ConfigEnv.ENABLE_DEBUG)
      this.worker.on("error", (error) => {
        this.fails++;
        if (this.watchdog) this.watchdog.report(error);
        if (this.fails == MAX_FAILS) return;
        setTimeout(() => this.createWorker(), 10_000);
      });
  }
}
export const FEWorker = new LocalFEWorker();
