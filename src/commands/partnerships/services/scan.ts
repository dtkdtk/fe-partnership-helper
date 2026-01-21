import eds from "@eds-fw/framework";
import { Client, Invite, Message } from "discord.js";
import { ConfigEnv, resources } from "../../../corelib.js";
import { DB_Misc, MessageInvites } from "../../../databases.js";
import { incrementDelegateStats } from "../models/delegate_stats.js";
import { getServerData, initServerData_byInvite, updateServerData_byInvite } from "../models/server.js";
import { DelegateAlerts } from "./alerts.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";


const ReactionsQueue = new eds.ActionQueue(3_000);
const CheckedGuilds = new Set<string>();
export async function scanPartnershipChannel(client: Client) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  const channel = await eds.sfChannel(
    guild?.channels,
    ConfigEnv.PARTNERSHIPS_CHANNEL_ID
  );
  if (!channel?.isTextBased()) return;

  let lastScannedMessageId = (await DB_Misc.findOneAsync({ _id: "1" })).last_scanned_message;
  let lastScanTimestamp = (await eds.sfMessage(channel.messages, lastScannedMessageId))?.createdTimestamp ?? 0;
  let scanningOld = false;

  const messages = await channel.messages.fetch({ limit: 100, cache: false }).catch(() => {});
  if (!messages?.size) return;

  for (const message of messages.values()) {
    if (message.author.bot) {
      await message.delete().catch(() => {});
      continue;
    }
    if (message.id == lastScannedMessageId) scanningOld = true;
    const invite = await validateConditions(message, false, false);

    if (invite === ConditionErrno.just_return) continue;
    else if (typeof invite === "number") {
      await message.delete().catch(() => {});
      if (!scanningOld)
        DelegateAlerts.deletePartnership(message, invite, true);
      continue;
    }
    else if (invite instanceof Invite && invite.guild) {
      if (CheckedGuilds.has(invite.guild.id)) {
        await message.delete().catch(() => {});
        continue;
      }
      MessageInvites.set(message.id, invite.guild.id);
      CheckedGuilds.add(invite.guild.id);
      const serverData = await getServerData(invite.guild.id)
        ?? await initServerData_byInvite(invite);
      
      updateServerData_byInvite(
        serverData!,
        invite,
        message.author.id,
        message.createdTimestamp
      );
      if (message.createdTimestamp > lastScanTimestamp) {
        lastScannedMessageId = message.id;
        lastScanTimestamp = message.createdTimestamp;
      }
      deferReaction(message);
      incrementDelegateStats(message.author.id, message.createdTimestamp);
    }
  }

  await DB_Misc.updateAsync({ _id: "1" }, { $set: { last_scanned_message: lastScannedMessageId } })
}

function deferReaction(message: Message) {
  ReactionsQueue.push(async () => {
    await message.react(resources.button_icons.yes);
  });
}
