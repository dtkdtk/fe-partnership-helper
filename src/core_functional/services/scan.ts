import { deletePartnership, getServerData, incrementDelegateStats, initServerData_byInvite, markAsLatest, updateServerData_byInvite } from "#core_functional";
import { ConfigEnv, DB_Misc, MessageInvites, MSK, resources } from "#corelib";
import eds from "@eds-fw/framework";
import { Client, FetchMessagesOptions, GuildTextBasedChannel, Message } from "discord.js";
import { DelegateAlerts } from "./alerts.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";
import { runGeneralScan } from "./general_scan.js";
import { Log } from "./log.js";


const ReactionsQueue = new eds.ActionQueue(3_000);
const CheckedGuilds = new Set<string>();

export async function performPartnershipsScan(client: Client) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  if (!guild) return;
  
  for (const channelId of ConfigEnv.PARTNERSHIP_CHANNELS_ID) {
    const channel = await eds.sfChannel(guild?.channels, channelId);
    if (!channel?.isSendable()) continue;
    await scanPartnershipChannel(client, channel);
    CheckedGuilds.clear();
  }
}

async function scanPartnershipChannel(client: Client, channel: GuildTextBasedChannel) {
  const _miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
  let lastScannedMessageId: string | undefined = _miscDbData.last_scanned_message[channel.id];
  let lastScanTimestamp = lastScannedMessageId ?
    (await eds.sfMessage(channel.messages, lastScannedMessageId))?.createdTimestamp ?? 0 : 0;
  const silentMode = !lastScannedMessageId && !lastScanTimestamp;
  const notificationWatermark = MSK().date(-3); //за последние 3 дня

  const performScan = async function() {
    const fetchOptions: FetchMessagesOptions = { limit: 100, cache: false };
    if (!silentMode) fetchOptions.after = lastScannedMessageId;
    const messages = await channel.messages.fetch(fetchOptions).catch(() => {});
    if (!messages?.size) return false;
    messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp); //Начинаем с новых

    //Коллекция начинается с самых новых сообщений
    for (const msg of messages.values()) {
      const invite = await validateConditions(msg, { checkCooldown: false });
      if (invite === ConditionErrno.just_return) {
        await deletePartnership(msg);
        continue;
      }
      if (msg.id == lastScannedMessageId) return false;

      else if (typeof invite === "number") {
        const needAlert = !silentMode && MSK(msg.createdTimestamp).isAfter(notificationWatermark);
        await deletePartnership(msg);
        if (needAlert) DelegateAlerts.deletePartnership(msg, invite, true);
        Log.Scan.messageWrong(msg.id, msg.author.id, invite, needAlert);
        continue;
      }
      else if (invite.guild) {
        if (CheckedGuilds.has(invite.guild.id) && ConfigEnv.DELETE_OLD_TEXTS) {
          await deletePartnership(msg);
          Log.Scan.messageDuplicate(msg.id, msg.author.id);
          continue;
        }
        MessageInvites.set(msg.id, invite.guild.id);
        CheckedGuilds.add(invite.guild.id);
        const serverData = await getServerData(invite.guild.id)
          ?? await initServerData_byInvite(invite);

        updateServerData_byInvite(
          serverData!,
          invite,
          msg.author.id,
          msg.createdTimestamp
        );
        if (msg.createdTimestamp > lastScanTimestamp) {
          lastScannedMessageId = msg.id;
          lastScanTimestamp = msg.createdTimestamp;
        }
        if (!silentMode) {
          deferReaction(msg);
          incrementDelegateStats(msg.author.id, msg.createdTimestamp);
        }
        Log.Scan.messageOk(msg.id, msg.author.id, silentMode);
      }
    }
    return !silentMode ? true : false;
  }

  if (!lastScannedMessageId && !lastScanTimestamp) Log.Scan.silentMode();
  Log.Scan.start();
  let toContinue = true;
  while (toContinue) {
    toContinue = await performScan();
    await eds.wait(3_000);
  }
  Log.Scan.end();

  if (lastScannedMessageId) markAsLatest(channel.id, lastScannedMessageId);
  runGeneralScan(client);
}

function deferReaction(message: Message) {
  ReactionsQueue.push(async () => {
    await message.react(resources.button_icons.yes).catch(() => {});
  });
}
