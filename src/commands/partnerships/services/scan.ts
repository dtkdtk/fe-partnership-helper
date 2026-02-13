import eds from "@eds-fw/framework";
import { Client, Message } from "discord.js";
import { ConfigEnv, CoreLog, MSK, resources } from "../../../corelib.js";
import { DB_Misc, MessageInvites } from "../../../databases.js";
import { incrementDelegateStats } from "../models/delegate_stats.js";
import { getServerData, initServerData_byInvite, markAsLatest, updateServerData_byInvite } from "../models/server.js";
import { DelegateAlerts } from "./alerts.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";
import { runGeneralScan } from "./general_scan.js";
import { Log } from "./log.js";


const ReactionsQueue = new eds.ActionQueue(3_000);
const CheckedGuilds = new Set<string>();
export async function scanPartnershipChannel(client: Client) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  const channel = await eds.sfChannel(
    guild?.channels,
    ConfigEnv.PARTNERSHIPS_CHANNEL_ID
  );
  if (!channel?.isTextBased()) return;

  const _miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
  let lastScannedMessageId = _miscDbData.last_scanned_message;
  let lastScanTimestamp = (await eds.sfMessage(channel.messages, lastScannedMessageId))?.createdTimestamp ?? 0;
  const scannedBefore = !!lastScannedMessageId && !!lastScanTimestamp;
  const notificationWatermark = MSK().date(-3); //за последние 3 дня

  const performScan = async function() {
    const messages = await channel.messages.fetch({ limit: 100, cache: false, after: lastScannedMessageId }).catch(() => {});
    if (!messages?.size) return false;
    messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp); //Начинаем с новых

    //Коллекция начинается с самых новых сообщений
    for (const msg of messages.values()) {
      const invite = await validateConditions(msg, { checkCooldown: false });
      if (invite === ConditionErrno.just_return) {
        await msg.delete().catch(() => CoreLog.missingPermission("MANAGE_MESSAGES", { channelId: msg.channelId }));
        continue;
      }
      if (msg.id == lastScannedMessageId) return false;

      else if (typeof invite === "number") {
        const needAlert = scannedBefore && MSK(msg.createdTimestamp).isAfter(notificationWatermark);
        await msg.delete().catch(() => {});
        if (needAlert) DelegateAlerts.deletePartnership(msg, invite, true);
        Log.Scan.messageWrong(msg.id, msg.author.id, invite, needAlert);
        continue;
      }
      else if (invite.guild) {
        if (CheckedGuilds.has(invite.guild.id)) {
          await msg.delete().catch(() => CoreLog.missingPermission("MANAGE_MESSAGES", { channelId: msg.channelId }));
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
        deferReaction(msg);
        incrementDelegateStats(msg.author.id, msg.createdTimestamp);
        Log.Scan.messageOk(msg.id, msg.author.id);
      }
    }
    return true;
  }

  if (!lastScannedMessageId && !lastScanTimestamp) {
    Log.Scan.skipScan();
  }
  else {
    Log.Scan.start();
    let toContinue = true;
    while (toContinue) {
      toContinue = await performScan();
      await eds.wait(3_000);
    }
    Log.Scan.end();
  }

  if (lastScannedMessageId) markAsLatest(lastScannedMessageId);
  runGeneralScan(client);
}

function deferReaction(message: Message) {
  ReactionsQueue.push(async () => {
    await message.react(resources.button_icons.yes).catch(() => {});
  });
}
