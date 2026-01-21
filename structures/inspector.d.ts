import { Client } from "discord.js";

export class FEInspector {
  constructor(ConfigEnv: object);
  client: Client;
  start(): void;
  report(error: Error): Promise<void>;
}
