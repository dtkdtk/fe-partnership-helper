import * as nedb from "@seald-io/nedb";
import { Collection } from "discord.js";
import NodeCache from "node-cache";
import { DelegateStats, PartnerData, ServerBlacklistData, ServerData } from "./commands/partnerships/types.js";
const Datastore = nedb.default as unknown as typeof nedb.default.default;

interface MiscDbData {
  _id: "1";
  last_scanned_message?: string;
}

export const DB_DelegationStats = new Datastore<DelegateStats>({
  filename: "./database/delegation_stats.db",
  inMemoryOnly: false,
  autoload: true,
});
export const DB_ServersData = new Datastore<ServerData>({
  filename: "./database/servers_data.db",
  inMemoryOnly: false,
  autoload: true,
});
export const DB_PartnersData = new Datastore<PartnerData>({
  filename: "./database/partners_data.db",
  inMemoryOnly: false,
  autoload: true,
});
export const DB_ServersBlacklist = new Datastore<ServerBlacklistData>({
  filename: "./database/servers_blacklist.db",
  inMemoryOnly: false,
  autoload: true,
});
export const DB_Misc = new Datastore<MiscDbData>({
  filename: "./database/misc.db",
  inMemoryOnly: false,
  autoload: true,
});

DB_Misc.find({ _id: "1" }, {}, (err, data) => {
  if (err) console.error(err);
  if (!data?.length) DB_Misc.insert({ _id: "1" });
});

export const BotCache = new NodeCache({ stdTTL: 3 * 24 * 60 * 60 });
export const MessageInvites = new Collection<string, string>();

BotCache.set("bot_startedAt", Date.now());
