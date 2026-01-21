import { FEInspector } from "./inspector";

export declare const FEWorker: {
  worker: Worker;
  inspector: FEInspector;
  createWorker(): void;
  setup(ConfigEnv: object): void;
};
