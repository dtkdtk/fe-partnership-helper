import { bulkUpdateDgStats, initServerData_byInvite, InvitesCache } from "#core_functional";
import { ConfigEnv, DateRecord, DB_Misc, getDate, MiscDbData, MSK, rateLimitSafe } from "#corelib";
import { eds } from "@eds-fw/framework";
import { Client, Collection, FetchMessagesOptions, GuildTextBasedChannel, Message } from "discord.js";
import { ConditionErrno, extractInviteCodes, validateConditions } from "./check_conditions.js";
import { Log } from "./log.js";


const WAIT_AFTER_RATELIMIT = 10 * 60 * 1000; //10 min
const MINIMAL_INTERVAL = 5_000; //5 sec; минимальный интервал между партиями
const FETCH_SINGLE_INTERVAL = 5_000; //5 sec; интервал между каждыми фетчами ссылок
//Динамический интервал между каждыми партиями фетчей ссылок, для каждой ссылки.
//Позволяет не достигать дневного лимита фетчей.
const FETCH_SERIES_INTERVAL = Math.round((24 * 60 * 60 * 1000) / ConfigEnv.GENERAL_SCAN_DAILY_LIMIT) - FETCH_SINGLE_INTERVAL;

type StatsChangesMap = Map<string, DateRecord<number>>;
export interface ResultState {
  lastMessage: string | undefined;
  changesMap: StatsChangesMap | undefined;
  invitesFetched: number;
  rateLimited?: boolean;
  scanFullyCompleted?: boolean;
};

let GeneralScanProcessStarted = false;
let GeneralScanPaused = false;
let FetchTimer: NodeJS.Timeout | null = null;

let MessageQueue: Collection<string, Message> | undefined = undefined;
let MessageIndex = 0;

let Channels: GuildTextBasedChannel[] = [];
let ChannelIndex = 0;

export function pauseGeneralScan(adminId?: string) {
  if (FetchTimer) {
    clearTimeout(FetchTimer);
    FetchTimer = null;
  }
  GeneralScanPaused = true;
  Log.GeneralScan.mandatoryPause(adminId ?? null);
}

export async function resumeGeneralScan(adminId?: string) {
  GeneralScanPaused = false;
  const miscDbRecord = await DB_Misc.findOneAsync({ _id: "1" });
  performGeneralScan(eds.runtimeStorage.client, miscDbRecord);
  Log.GeneralScan.mandatoryResume(adminId ?? null);
}

export async function runGeneralScan(client: Client) {
  if (GeneralScanProcessStarted) return;
  const miscDbRecord = await DB_Misc.findOneAsync({ _id: "1" });
  const isCompleted = miscDbRecord.is_general_scan_complete === true;
  if (isCompleted) {
    Log.GeneralScan.skipCuzCompleted();
    return;
  }
  GeneralScanProcessStarted = true;
  performGeneralScan(client, miscDbRecord);
}

async function performGeneralScan(client: Client, miscDbRecord: MiscDbData) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  for (const channelId of ConfigEnv.PARTNERSHIP_CHANNELS_ID) {
    const channel = await eds.sfChannel(guild?.channels, channelId);
    if (!channel?.isTextBased()) continue;
    Channels.push(channel);
  }
  Log.GeneralScan.begin();
  ChannelIndex = miscDbRecord.last_general_scan_channel
    ? Channels.findIndex(it => it.id == miscDbRecord.last_general_scan_channel) : 0;
  if (ChannelIndex < 0) ChannelIndex = 0;
  let lastMessage: string | undefined;

  const delayedExecutor = async (): Promise<void> => {
    if (GeneralScanPaused) return;
    const channel = Channels[ChannelIndex++];
    ChannelIndex %= Channels.length;
    lastMessage ??= miscDbRecord.last_general_scan_message[channel.id];
    const result = await scanChannel(channel, lastMessage);
console.log(lastMessage, ChannelIndex, result, MessageQueue?.size, MessageIndex)
    lastMessage = result.lastMessage;
    await dbApply(result, channel.id);
    if (result.rateLimited) {
      Log.GeneralScan.stopOnRatelimit(WAIT_AFTER_RATELIMIT);
      await eds.wait(WAIT_AFTER_RATELIMIT);
      return delayedExecutor();
    }
    else if (result.scanFullyCompleted) {
      Log.GeneralScan.stopOnComplete();
      await DB_Misc.updateAsync({ _id: "1" }, { $set: { is_general_scan_complete: true } });
      return;
    }

    const timeoutMs = Math.max(FETCH_SERIES_INTERVAL * result.invitesFetched, MINIMAL_INTERVAL);
    if (FetchTimer) clearTimeout(FetchTimer);
    FetchTimer = setTimeout(delayedExecutor, 4444);
    Log.GeneralScan.timeout(timeoutMs, result.invitesFetched);
  };
  delayedExecutor();
}

async function scanChannel(channel: GuildTextBasedChannel, lastMessage?: string): Promise<ResultState> {
  let invitesFetched = 0;
  const changesMap: StatsChangesMap = new Map();
  const fetchOptions: FetchMessagesOptions = { limit: 100, cache: false };
  if (lastMessage) fetchOptions.before = lastMessage;

  if (!MessageQueue || MessageIndex >= MessageQueue.size) {
    MessageQueue = undefined;
    MessageIndex = 0;
    const _messages = await rateLimitSafe(channel.messages.fetch(fetchOptions))
      .catch(() => null);
    if (_messages === null)
      return {
        rateLimited: true,
        invitesFetched,
        lastMessage,
        changesMap: undefined,
      };
    if (_messages.size === 0)
      return {
        scanFullyCompleted: true,
        invitesFetched,
        lastMessage,
        changesMap: undefined,
      };
    _messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp);
    MessageQueue = _messages;
  }

  for (; MessageIndex < MessageQueue.size;) {
    if (GeneralScanPaused)
      return {
        scanFullyCompleted: true,
        invitesFetched, lastMessage, changesMap,
      };
    const msg = MessageQueue.at(MessageIndex)!;
    MessageIndex++;
    
    const inviteCode = extractInviteCodes(msg.content)[0];
    const isCached = inviteCode ? (await InvitesCache.get(inviteCode)) !== null : null;

    const invite = await validateConditions(msg, { justGetInvite: true, checkCooldown: false });
    const date = getDate(MSK(msg.createdTimestamp));
    if (invite === ConditionErrno.rate_limit)
      return {
        rateLimited: true,
        invitesFetched, lastMessage, changesMap,
      };
    else if (invite === ConditionErrno.just_return
      || invite === ConditionErrno.no_invite
      || invite === ConditionErrno.this_server
    ) {
      Log.GeneralScan.messageDelete(msg.id, msg.author.id, invite, inviteCode, isCached);
      await msg.delete().catch(() => {});
      continue;
    }
    else if (invite === ConditionErrno.unfetched_invite) {
      if (ConfigEnv.GENERAL_SCAN_UNFETCHED_STRATEGY == "DELETE") {
        Log.GeneralScan.messageDelete(msg.id, msg.author.id, invite, inviteCode, isCached);
        await msg.delete().catch(() => {});
        continue;
      }
      else if (ConfigEnv.GENERAL_SCAN_UNFETCHED_STRATEGY == "IGNORE") {
        Log.GeneralScan.ignoreUnfetched(msg.id, msg.author.id, inviteCode, isCached);
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
    lastMessage = msg.id;
    Log.GeneralScan.messageOk(msg.id, msg.author.id, inviteCode, isCached);
    if (!isCached) {
      invitesFetched++;
      await eds.wait(FETCH_SINGLE_INTERVAL);
    }
  }
  return {
    invitesFetched, lastMessage, changesMap,
  };
}

let PreviousData: ResultState | undefined;

async function dbApply(updated: ResultState, channelId: string) {
  if (!updated.changesMap?.size && (!PreviousData || updated.lastMessage == PreviousData?.lastMessage)) return;
  if (updated.lastMessage)
    await DB_Misc.updateAsync({ _id: "1" },
      { $set: { [`last_general_scan_message.${channelId}`]: updated.lastMessage } });
  if (updated.changesMap)
    for (const [id, dateRec] of updated.changesMap.entries())
      await bulkUpdateDgStats(id, dateRec);
  PreviousData = updated;
  Log.GeneralScan.applyChanges(updated);
}
