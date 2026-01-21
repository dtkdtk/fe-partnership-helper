import { Worker } from "worker_threads";
import { FEInspector } from "./inspector.js";

const MAX_FAILS = 6;

class LocalFEWorker {
  /** @type {Worker} */
  worker;
  /** @type {FEInspector} */
  inspector;
  fails = 0;
  ConfigEnv;

  setup(ConfigEnv) {
    this.ConfigEnv = ConfigEnv;
    this.inspector = new FEInspector(ConfigEnv);
    this.inspector.start();
    this.createWorker();
  }
  createWorker() {
    this.worker = new Worker("./dist/index.js");
    if (!this.ConfigEnv.ENABLE_DEBUG)
      this.worker.on("error", (error) => {
        this.fails++;
        this.inspector.report(error);
        if (this.fails == MAX_FAILS) return;
        setTimeout(() => this.createWorker(), 10_000);
      });
  }
}
export const FEWorker = new LocalFEWorker();
