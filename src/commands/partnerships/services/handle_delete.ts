import { eds } from "@eds-fw/framework";
import { Invite, Message } from "discord.js";
import { BotCache, ConfigEnv, MessageInvites } from "../../../corelib.js";
import { decrementDelegateStats, getDelegateStats } from "../models/delegate_stats.js";
import { getServerData, updateServerData_byInvite } from "../models/server.js";
import { validateConditions } from "./check_conditions.js";


export async function clearOldPartnerships(
  thisMsg: Message, invite: Invite
) {
  const guild = await eds.sfGuild(invite.client.guilds, ConfigEnv.GUILD_ID);
  const channel = await eds.sfChannel(
    guild?.channels,
    ConfigEnv.PARTNERSHIPS_CHANNEL_ID
  );
  if (!channel?.isTextBased()) return;

  const filtered = MessageInvites.filter(
    (v, k) => v == invite.guild!.id && k != thisMsg.id
  );
  if (!filtered?.size) return;

  filtered.forEach((v, k) =>
    BotCache.set(`partnership $$ ${k} $$ sudo_deleted`, true)
  );
  filtered.forEach(async (v, k) =>
    (await eds.sfMessage(channel.messages, k))?.delete().catch(() => {})
  );
}

export async function onPartnershipDelete(message: Message<true>) {
  if (BotCache.get(`partnership $$ ${message.id} $$ sudo_deleted`)) {
    BotCache.del(`partnership $$ ${message.id} $$ sudo_deleted`);
    return;
  }
  if (message.channel.id != ConfigEnv.PARTNERSHIPS_CHANNEL_ID) return;
  if (message.author.bot) return;

  const invite = await validateConditions(message, true);
  if (typeof invite === "number" || !invite.guild) return;

  const serverData = await getServerData(invite.guild.id);
  if (serverData) {
    await updateServerData_byInvite(serverData, invite, message.author.id, 0);
  }
  const delegateStats = await getDelegateStats(message.author.id);
  if (delegateStats) {
    await decrementDelegateStats(message.author.id, message.createdTimestamp);
  }
}
