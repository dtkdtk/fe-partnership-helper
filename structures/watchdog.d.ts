import { Client } from "discord.js";

export class FEWatchdog {
  constructor(ConfigEnv: object);
  client: Client;
  start(): void;
  report(error: Error): Promise<void>;
}
