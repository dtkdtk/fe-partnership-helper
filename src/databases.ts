import type { AsceticInvite, AsceticMaybeMember, DelegateStats, PartnerData, ServerBlacklistData, ServerData } from "#core_functional";
import * as nedb from "@seald-io/nedb";
import { Collection } from "discord.js";
import NodeCache from "node-cache";
import { join as joinPath } from "path";
const Datastore = nedb.default as unknown as typeof nedb.default.default;
const AUTO_COMP_INTERVAL = 1 * 60 * 60 * 1000; //1 час

export interface MiscDbData {
  _id: "1";
  /** `{channelID => messageID}` */
  last_scanned_message: Record<string, string>;
  /** `{channelID => messageID}` */
  last_general_scan_message: Record<string, string>;
  last_general_scan_channel?: string;
  is_general_scan_complete?: boolean;
  /** delegates with mandatory `total_partnerships` */
  no_total_delegates: string[];
}

export const CommonDatabaseDir = "database";

export const DelegationStats_DBFile = "delegation_stats.db";
export const DB_DelegationStats = new Datastore<DelegateStats>({
  filename: joinPath(".", CommonDatabaseDir, DelegationStats_DBFile),
  inMemoryOnly: false,
  autoload: true,
});
DB_DelegationStats.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const ServersData_DBFile = "servers_data.db";
export const DB_ServersData = new Datastore<ServerData>({
  filename: joinPath(".", CommonDatabaseDir, ServersData_DBFile),
  inMemoryOnly: false,
  autoload: true,
});
DB_ServersData.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const PartnersData_DBFile = "partners_data.db";
export const DB_PartnersData = new Datastore<PartnerData>({
  filename: joinPath(".", CommonDatabaseDir, PartnersData_DBFile),
  inMemoryOnly: false,
  autoload: true,
});
DB_PartnersData.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const ServersBlacklist_DBFile = "servers_blacklist.db";
export const DB_ServersBlacklist = new Datastore<ServerBlacklistData>({
  filename: joinPath(".", CommonDatabaseDir, ServersBlacklist_DBFile),
  inMemoryOnly: false,
  autoload: true,
});
DB_ServersBlacklist.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const Misc_DBFile = "misc.db";
export const DB_Misc = new Datastore<MiscDbData>({
  filename: joinPath(".", CommonDatabaseDir, Misc_DBFile),
  inMemoryOnly: false,
  autoload: true,
});
DB_Misc.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const InvitesCache_DBFile = "invites_cache.db";
export const DB_InvitesCache = new Datastore<AsceticInvite | {}>({
  filename: joinPath(".", CommonDatabaseDir, InvitesCache_DBFile),
  inMemoryOnly: false,
  autoload: true,
});
DB_InvitesCache.setAutocompactionInterval(AUTO_COMP_INTERVAL);

export const StaffCache_DBFile = "staff_cache.db";
export const DB_StaffCache = new Datastore<AsceticMaybeMember>({
  filename: joinPath(".", CommonDatabaseDir, StaffCache_DBFile),
  inMemoryOnly: false,
  autoload: true, 
});
DB_StaffCache.setAutocompactionInterval(AUTO_COMP_INTERVAL);

DB_Misc.find({ _id: "1" }, {}, (err, data) => {
  if (err) console.error(err);
  if (!data?.length) {
    BotCache.set("bot_firstStart", true);
    DB_Misc.insert({
      _id: "1",
      no_total_delegates: [],
      last_scanned_message: {},
      last_general_scan_message: {},
    });
    DB_Misc.compactDatafile();
  }
});

export const BotCache = new NodeCache({ stdTTL: 3 * 24 * 60 * 60 });
export const MessageInvites = new Collection<string, string>();

export type OmitId<T> = Omit<T, "_id">;

BotCache.set("bot_startedAt", Date.now());

//cSpell:words seald
