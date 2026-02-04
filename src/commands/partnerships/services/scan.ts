import eds from "@eds-fw/framework";
import { Client, Invite, Message } from "discord.js";
import { ConfigEnv, logger, MSK, resources } from "../../../corelib.js";
import { DB_Misc, MessageInvites } from "../../../databases.js";
import { incrementDelegateStats } from "../models/delegate_stats.js";
import { getServerData, initServerData_byInvite, markAsLatest, updateServerData_byInvite } from "../models/server.js";
import { DelegateAlerts } from "./alerts.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";
import { runFirstScan } from "./firstscan.js";


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
  if (!lastScannedMessageId && !lastScanTimestamp) return;

  const performScan = async function() {
    const messages = await channel.messages.fetch({ limit: 100, cache: false, after: lastScannedMessageId }).catch(() => {});
    if (!messages?.size) return false;
    messages.sort((A, B) => B.createdTimestamp - A.createdTimestamp); //Начинаем с новых

    //Коллекция начинается с самых новых сообщений
    for (const msg of messages.values()) {
      if (msg.author.bot) {
        await msg.delete().catch(() => {});
        continue;
      }
      if (msg.id == lastScannedMessageId) return false;
      const invite = await validateConditions(msg, false, false);

      if (invite === ConditionErrno.just_return) continue;
      else if (typeof invite === "number") {
        await msg.delete().catch(() => {});
        if (scannedBefore && MSK(msg.createdTimestamp).isAfter(notificationWatermark))
          DelegateAlerts.deletePartnership(msg, invite, true);
        continue;
      }
      else if (invite instanceof Invite && invite.guild) {
        if (CheckedGuilds.has(invite.guild.id)) {
          await msg.delete().catch(() => {});
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
      }
    }
    return true;
  }

  let toContinue = true;
  while (toContinue) {
    toContinue = await performScan();
    await eds.wait(3_000);
  }

  if (lastScannedMessageId) markAsLatest(lastScannedMessageId);
  runFirstScan(client);
}

function deferReaction(message: Message) {
  ReactionsQueue.push(async () => {
    await message.react(resources.button_icons.yes).catch(console.error);
  });
}
