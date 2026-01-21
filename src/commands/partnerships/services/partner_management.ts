import eds from "@eds-fw/framework";
import { GuildMember, MessageCreateOptions, PartialGuildMember, UserSelectMenuInteraction } from "discord.js";
import { ConfigEnv, lastDatedVal, resources, softError, tReply, updateDatedVal } from "../../../corelib.js";
import { getPartnerData, initPartnerData, isActualPartner, updatePartnerData } from "../models/partner.js";
import { getServerData } from "../models/server.js";
import { ServerData } from "../types.js";
import { PartnerAlerts } from "./alerts.js";


export async function registerPartner(
  partnerId: string,
  partnerUsername: string,
  delegateId: string,
  serverData: ServerData
) {
  const partnerData = await getPartnerData(partnerId)
    ?? (await initPartnerData(partnerId, partnerUsername))!;
  updateDatedVal(partnerData.delegates, delegateId);
  updateDatedVal(partnerData.server_ids, serverData._id);
  updateDatedVal(serverData.partners, partnerId);
  await updatePartnerData(partnerData, partnerUsername, delegateId, serverData._id);
}

export async function handlePartnerLeave(
  partner: GuildMember | PartialGuildMember
) {
  const isActual = await isActualPartner(partner.id);
  if (!isActual) return;
  const staffChannel = await eds.sfChannel(
    partner.guild.channels, ConfigEnv.STAFF_CHANNEL_ID
  );
  if (!staffChannel?.isTextBased()) return softError(new Error("Канал, указанный в STAFF_CHANNEL_ID, не найден / не текстовый."));
  const partnerData = await getPartnerData(partner.id);
  const avatar = eds.getAvatar(partner);
  const previousDelegateId = lastDatedVal(
    partnerData?.delegates ?? {}
  );

  const msg: MessageCreateOptions = {
      embeds: [
        {
          author: {
            name: "Партнёр сбежал с сервера!!! Верните его домой!",
          },
          color: resources.colors.delegation,
          title: partner.user.displayName,
          description: `Партнёр: \`${partner.user.username}\`\nID: \`${partner.id}\``,
          thumbnail: {
            url: avatar,
          },
        },
      ],
  };

  if (partnerData) msg.content = `${resources.emoji.briefcase} <@${previousDelegateId}>`;

  staffChannel.send(msg).catch(() => {});
}


export async function partnerMenuSource(
  ctx: eds.InteractionContext<UserSelectMenuInteraction>,
  targetGuildId: string,
  targetGuildName?: string,
) {
  const delegate = await eds.sfMember(ctx, ctx.user.id);
  if (!delegate) return;
  const serverData = await getServerData(targetGuildId);
  if (!serverData)
    return tReply.error(ctx, "ERRNO_404", "Данные о партнёрстве не найдены.");
  const partnerRaw = ctx.members.at(0);
  const partner = await eds.sfMember(ctx, partnerRaw && "id" in partnerRaw
      ? partnerRaw.id : partnerRaw?.user.id);
  if (!partner) return;

  ctx.quickReply(
    true,
    `${partner.displayName}\n[${partner.user.username}]\n[${partner.id}]`,
    `${resources.emoji.briefcase} **Теперь является партнёром сервера:**\n> \`${targetGuildName ?? "<неизвестно>"}\``,
    undefined,
    undefined,
    { thumbnail: { url: eds.getAvatar(partner) } }
  );
  
  _resolvePartner(partner, delegate, serverData);
}

async function _resolvePartner(
  partner: GuildMember, delegate: GuildMember, serverData: ServerData
) {
  let isAlreadyPartner = false;
  if (ConfigEnv.PARTNER_ROLE_ID) {
    if (!eds.hasRole(partner)(ConfigEnv.PARTNER_ROLE_ID))
      partner.roles.add(ConfigEnv.PARTNER_ROLE_ID).catch(console.error);
    else
      isAlreadyPartner = true;
  }
  else {
    isAlreadyPartner = await isActualPartner(partner.id);
  }

  const prevPartnerID = lastDatedVal(serverData.partners);
  registerPartner(partner.id, partner.user.username, delegate.id, serverData);
  
  if (!isAlreadyPartner) PartnerAlerts.NewPartnership.queueAlert(
    partner.user, delegate, serverData.last_name
  );

  if (prevPartnerID) {
    const isActual = await isActualPartner(prevPartnerID);
    if (!isActual && ConfigEnv.PARTNER_ROLE_ID) {
      const member = await eds.sfMember(delegate.guild.members, prevPartnerID);
      if (member)
        member.roles.remove(ConfigEnv.PARTNER_ROLE_ID).catch(() => {});
    }
  }
}
