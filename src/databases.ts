import * as nedb from "@seald-io/nedb";
import { Collection } from "discord.js";
import NodeCache from "node-cache";
import type { AsceticInvite, DelegateStats, PartnerData, ServerBlacklistData, ServerData } from "#core_functional";
const Datastore = nedb.default as unknown as typeof nedb.default.default;
const AUTO_COMP_INTERVAL = 1 * 60 * 60 * 1000; //1 час

export interface MiscDbData {
  _id: "1";
  /** `{channelID => messageID}` */
  last_scanned_message: Record<string, string>;
  /** `[channelID, messageID]` */
  last_general_scan_message?: [string, string];
  is_general_scan_complete?: boolean;
  /** delegates with mandatory `total_partnerships` */
  no_total_delegates: string[];
}

export const DB_DelegationStats = new Datastore<DelegateStats>({
  filename: "./database/delegation_stats.db",
  inMemoryOnly: false,
  autoload: true,
});
DB_DelegationStats.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const DB_ServersData = new Datastore<ServerData>({
  filename: "./database/servers_data.db",
  inMemoryOnly: false,
  autoload: true,
});
DB_ServersData.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const DB_PartnersData = new Datastore<PartnerData>({
  filename: "./database/partners_data.db",
  inMemoryOnly: false,
  autoload: true,
});
DB_PartnersData.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const DB_ServersBlacklist = new Datastore<ServerBlacklistData>({
  filename: "./database/servers_blacklist.db",
  inMemoryOnly: false,
  autoload: true,
});
DB_ServersBlacklist.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const DB_Misc = new Datastore<MiscDbData>({
  filename: "./database/misc.db",
  inMemoryOnly: false,
  autoload: true,
});
DB_Misc.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const DB_InvitesCache = new Datastore<AsceticInvite | {}>({
  filename: "./database/invites_cache.db",
  inMemoryOnly: false,
  autoload: true,
});
DB_InvitesCache.setAutocompactionInterval(AUTO_COMP_INTERVAL);

DB_Misc.find({ _id: "1" }, {}, (err, data) => {
  if (err) console.error(err);
  if (!data?.length) {
    BotCache.set("bot_firstStart", true);
    DB_Misc.insert({
      _id: "1",
      no_total_delegates: [],
      last_scanned_message: {},
    });
    DB_Misc.compactDatafile();
  }
});

export const BotCache = new NodeCache({ stdTTL: 3 * 24 * 60 * 60 });
export const MessageInvites = new Collection<string, string>();

export type OmitId<T> = Omit<T, "_id">;

BotCache.set("bot_startedAt", Date.now());

//cSpell:words seald
