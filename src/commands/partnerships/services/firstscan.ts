import { Client, FetchMessagesOptions, GuildTextBasedChannel } from "discord.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";
import { ConfigEnv, DateRecord, DB_Misc, getDate, MSK } from "../../../corelib.js";
import { eds } from "@eds-fw/framework";
import { _updateDelegateStats, bulkUpdateDgStats } from "../models/delegate_stats.js";


const kStopOnError = Symbol();
const kStopOnComplete = Symbol();

type StatsChangesMap = Map<string, DateRecord<number>>;
type ResultState = { lastMessage: string | undefined; stats: StatsChangesMap };

let FirstScanProcess: Promise<void> | undefined;

export async function runFirstScan(client: Client) {
  if (FirstScanProcess) return;
  const isCompleted = (await DB_Misc.findOneAsync({ _id: "1" })).is_firstscan_complete === true;
  if (isCompleted) return;
  FirstScanProcess = performFirstScan(client);
}

async function performFirstScan(client: Client) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  const channel = await eds.sfChannel(guild?.channels, ConfigEnv.PARTNERSHIPS_CHANNEL_ID);
  if (!channel?.isTextBased()) return;

  let result, lastMessage, alreadyHaveError = false;
  while (true) {
    result = await scanChannel(channel, lastMessage);
    if (result === kStopOnError) {
      if (alreadyHaveError) break;
      alreadyHaveError = true;
      await eds.wait(60_000);
      continue;
    }
    else if (result === kStopOnComplete) break;

    lastMessage = result.lastMessage;
    await dbApply(result);
    await eds.wait(5_000); //между fetch'ами сообщений
  }

  if (result === kStopOnComplete)
    await DB_Misc.updateAsync({ _id: "1" }, { $set: { is_firstscan_complete: true } });
}

async function scanChannel(
  channel: GuildTextBasedChannel, lastScannedMsg?: string
): Promise<ResultState | typeof kStopOnError | typeof kStopOnComplete> {
  const changesMap: StatsChangesMap = new Map();
  const fetchOptions: FetchMessagesOptions = { limit: 100, cache: false };
  if (lastScannedMsg) fetchOptions.before = lastScannedMsg;

  const messages = await channel.messages.fetch(fetchOptions).catch(() => null);
  if (messages === null) return kStopOnError;
  if (messages.size === 0) return kStopOnComplete;
  messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp); //Начинаем с новых

  for (const msg of messages.values()) {
    const invite = await validateConditions(msg, true, false);
    if (invite === ConditionErrno.just_return
      || invite === ConditionErrno.no_invite
      || invite === ConditionErrno.this_server
      || (ConfigEnv.FIRSTSCAN_DELETE_UNFETCHED && invite === ConditionErrno.unfetched_invite)
    ) {
      await msg.delete().catch(() => {});
      continue;
    }
    const date = getDate(MSK(msg.createdTimestamp));
    if (!changesMap.has(msg.author.id)) changesMap.set(msg.author.id, {});
    const userChanges = changesMap.get(msg.author.id)!;
    userChanges[date] = (userChanges[date] ?? 0) + 1;
    lastScannedMsg = msg.id;
  }
  return { lastMessage: lastScannedMsg, stats: changesMap };
}

async function dbApply(updated: ResultState) {
  const updatePromises: Promise<unknown>[] = [];
  if (updated.lastMessage)
    updatePromises.push(DB_Misc.updateAsync({ _id: "1" }, { $set: { last_firstscan_message: updated.lastMessage } }));
  for (const [id, dateRec] of updated.stats.entries())
    updatePromises.push(bulkUpdateDgStats(id, dateRec));
  await Promise.all(updatePromises);
}
