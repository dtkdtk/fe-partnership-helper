import { eds } from "@eds-fw/framework";
import { Client, FetchMessagesOptions, GuildTextBasedChannel } from "discord.js";
import { ConfigEnv, DateRecord, DB_DelegationStats, DB_Misc, DB_ServersData, getDate, MiscDbData, MSK } from "../../../corelib.js";
import { bulkUpdateDgStats } from "../models/delegate_stats.js";
import { initServerData_byInvite } from "../models/server.js";
import { ConditionErrno, extractInviteCodes, validateConditions } from "./check_conditions.js";
import { Log } from "./log.js";


const kStopOnRatelimit = Symbol();
const kStopOnComplete = Symbol();
const WAIT_AFTER_RATELIMIT = 10 * 60 * 1000; //10 минут

type StatsChangesMap = Map<string, DateRecord<number>>;
export type ResultState = { lastMessage: string | undefined; stats: StatsChangesMap };

let GeneralScanProcess: Promise<void> | undefined;

export async function runGeneralScan(client: Client) {
  if (GeneralScanProcess) return;
  const miscDbRecord = await DB_Misc.findOneAsync({ _id: "1" });
  const isCompleted = miscDbRecord.is_general_scan_complete === true;
  if (isCompleted) {
    Log.GeneralScan.skipCuzCompleted();
    return;
  }
  GeneralScanProcess = performGeneralScan(client, miscDbRecord);
}

async function performGeneralScan(client: Client, miscDbRecord: MiscDbData) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  const channel = await eds.sfChannel(guild?.channels, ConfigEnv.PARTNERSHIPS_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  Log.GeneralScan.begin();
  let result, lastMessage = miscDbRecord.last_general_scan_message, alreadyRatelimited = false;
  while (true) {
    result = await scanChannel(channel, lastMessage);
    if (result === kStopOnRatelimit) {
      Log.GeneralScan.stopOnRatelimit(alreadyRatelimited ? WAIT_AFTER_RATELIMIT : null);
      alreadyRatelimited = true;
      if (alreadyRatelimited) await eds.wait(WAIT_AFTER_RATELIMIT);
      continue;
    }
    else if (result === kStopOnComplete) {
      Log.GeneralScan.stopOnComplete();
      break;
    }

    lastMessage = result.lastMessage;
    Log.GeneralScan.applyChanges(result);
    await dbApply(result);
  }

  if (result === kStopOnComplete)
    await DB_Misc.updateAsync({ _id: "1" }, { $set: { is_general_scan_complete: true } });
}

async function scanChannel(
  channel: GuildTextBasedChannel, lastScannedMsg?: string
): Promise<ResultState | typeof kStopOnRatelimit | typeof kStopOnComplete> {
  const changesMap: StatsChangesMap = new Map();
  const fetchOptions: FetchMessagesOptions = { limit: 100, cache: false };
  if (lastScannedMsg) fetchOptions.before = lastScannedMsg;

  const messages = await Promise.race([
    channel.messages.fetch(fetchOptions).catch(() => null),
    eds.wait(3_000).then(() => null)
  ]);
  if (messages === null) return kStopOnRatelimit;
  if (messages.size === 0) return kStopOnComplete;
  messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp); //Начинаем с новых

  for (const msg of messages.values()) {
    const inviteCode = extractInviteCodes(msg.content)[0];
    const invite = await validateConditions(msg, true, false);
    const date = getDate(MSK(msg.createdTimestamp));
    if (invite === ConditionErrno.rate_limit) {
      return kStopOnRatelimit;
    }
    else if (invite === ConditionErrno.just_return
      || invite === ConditionErrno.no_invite
      || invite === ConditionErrno.this_server
    ) {
      Log.GeneralScan.messageDelete(msg.id, msg.author.id, invite, inviteCode);
      await msg.delete().catch(() => {});
      continue;
    }
    else if (invite === ConditionErrno.unfetched_invite) {
      if (ConfigEnv.GENERAL_SCAN_UNFETCHED_STRATEGY == "DELETE") {
        Log.GeneralScan.messageDelete(msg.id, msg.author.id, invite, inviteCode);
        await msg.delete().catch(() => {});
        continue;
      }
      else if (ConfigEnv.GENERAL_SCAN_UNFETCHED_STRATEGY == "IGNORE") {
        Log.GeneralScan.ignoreUnfetched(msg.id, msg.author.id, inviteCode);
        continue;
      }
      //Если COUNT, то мы просто продолжаем без изменений логики
    }
    else if (typeof invite != "number") {
      await initServerData_byInvite(invite, {
        delegates: { [date]: msg.author.id },
        message_id: msg.id,
      });
    }
    if (!changesMap.has(msg.author.id)) changesMap.set(msg.author.id, {});
    const userChanges = changesMap.get(msg.author.id)!;
    userChanges[date] = (userChanges[date] ?? 0) + 1;
    changesMap.set(msg.author.id, userChanges);
    lastScannedMsg = msg.id;
    Log.GeneralScan.messageOk(msg.id, msg.author.id, inviteCode);
    await eds.wait(1000);
  }
  return { lastMessage: lastScannedMsg, stats: changesMap };
}

async function dbApply(updated: ResultState) {
  const updatePromises: Promise<unknown>[] = [];
  if (updated.lastMessage)
    updatePromises.push(DB_Misc.updateAsync({ _id: "1" }, { $set: { last_general_scan_message: updated.lastMessage } }));
  for (const [id, dateRec] of updated.stats.entries())
    updatePromises.push(bulkUpdateDgStats(id, dateRec));
  await Promise.all(updatePromises);
  DB_ServersData.compactDatafile();
  DB_DelegationStats.compactDatafile();
}
