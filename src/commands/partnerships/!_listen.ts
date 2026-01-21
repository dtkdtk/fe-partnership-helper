import eds from "@eds-fw/framework";
import { ComponentType, SelectMenuDefaultValueType } from "discord.js";
import { BotCache, checkPermission, ConfigEnv, DgPermissions, getDate, lastDatedVal, MessageInvites, MSK, noAccess, resources } from "../../corelib.js";
import { getDelegateStats, incrementDelegateStats, initDelegateStats } from "./models/delegate_stats.js";
import { getServerData, initServerData_byInvite, updateServerData_byInvite } from "./models/server.js";
import { DelegateAlerts } from "./services/alerts.js";
import { ConditionErrNames, ConditionErrno, validateConditions } from "./services/check_conditions.js";
import { clearOldPartnerships } from "./services/handle_delete.js";
import { partnerMenuSource } from "./services/partner_management.js";


export default {
  async run(ctx) {
    if (!ctx.inGuild() || ctx.guildId != ConfigEnv.GUILD_ID) return;
    const warnings = [];
    const minimalMembers = ConfigEnv.REQUIREMENT_MINIMAL_MEMBERS;
    const invite = await validateConditions(ctx);
    if (invite === 0) return;
    if (typeof invite == "number")
      return _sendError(ctx, invite);
    if (!invite.guild) return;

    if (invite.temporary || invite.expiresTimestamp)
      warnings.push(`## ${resources.emoji.warning} **ВНИМАНИЕ! Ссылка временная. Попросите партнёра заменить её.**`);
    if (minimalMembers && invite.memberCount && invite.memberCount < minimalMembers)
      warnings.push(`## ${resources.emoji.warning} **ВНИМАНИЕ! На сервере нет [${minimalMembers}] участников.**`);

    clearOldPartnerships(ctx, invite);
    MessageInvites.set(ctx.id, invite.guild.id);

    let isNewPartnership = false;
    const serverData = await getServerData(invite.guild.id)
      ?? (isNewPartnership = true, await initServerData_byInvite(invite))!;

    serverData.message_id = ctx.id;
    const prevDelegateID = lastDatedVal(serverData.delegates)
        , prevPartnerID = lastDatedVal(serverData.partners);
    const previousDelegate = prevDelegateID
            ? (await eds.sfMember(ctx, prevDelegateID) ?? null) : null
        , previousPartner = prevPartnerID
            ? (await eds.sfMember(ctx, prevPartnerID) ?? null) : null;
    updateServerData_byInvite(serverData, invite, ctx.user.id, ctx.createdTimestamp);
    const delegateStats = (
      await getDelegateStats(ctx.user.id) ?? await initDelegateStats(ctx.user.id),
      await incrementDelegateStats(ctx.user.id, +MSK())
    );

    const todayDate = getDate(MSK());
    const todayPartnerships = delegateStats?.activity[todayDate] ?? 0
        , totalPartnerships = delegateStats?.total_partnerships ?? 0
        , displayWarnings = warnings.length ? ("\n" + warnings.join("\n")) : ""
        , displayMembers = eds.formatNumber(invite.memberCount ?? 0)
        , displayPrevDelegate = previousDelegate
            ? `\nПредыдущий делегат:\n> ${resources.emoji.system}\`${previousDelegate.user.username}\`` : ""
        , displayPrevPartner = previousPartner
            ? `\nПредыдущий партнёр:\n> ${resources.emoji.member}\`${previousPartner.user.username}\`` : ""

    const reply = await ctx
      .reply({
        embeds: [
          {
            color: resources.colors.gray,
            author: {
              name: `${todayPartnerships}-е за день`,
              icon_url: isNewPartnership
                ? resources.images.briefcase : resources.images.time,
            },
            description: `
### Партнёрство ${isNewPartnership ? "ЗАКЛЮЧЕНО" : "ОБНОВЛЕНО"}.
Количество партнёрств:
> За сегодня: \`${todayPartnerships}\`
> За всё время: \`${totalPartnerships}\`
Сервер: \`${invite.guild.name}\`
ID: \`${invite.guild.id}\`
Участников: \`${displayMembers}\`${resources.emoji.member}${displayPrevDelegate}${displayPrevPartner}${displayWarnings}`,
            thumbnail: {
              url: invite.guild.iconURL() ?? resources.images.briefcase,
            },
            footer: {
              text: resources.default_footer.delete1h,
              icon_url: resources.images.time,
            },
          },
        ],
        allowedMentions: { repliedUser: false },
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.UserSelect,
                custom_id: "partnership.set-partner",
                placeholder: "Назначить партнёра",
                ...(prevPartnerID
                  ? { default_values: [{
                      type: SelectMenuDefaultValueType.User,
                      id: prevPartnerID,
                    }] }
                  : {}
                )
              },
            ],
          },
        ],
      })
      .catch(console.error);
    ctx.react(resources.button_icons.yes).catch(console.error);
    if (!reply) return;

    setTimeout(() => reply.delete().catch(console.error), 60 * 60 * 1000); //час
  },

  info: {
    name: "handle-partnership-texts",
    type: "text",
    nonPrefixed: true,
    hidden: true,
  },
} satisfies eds.CommandFile<"text">;


eds.createMenu(
  {
    custom_id: "partnership.set-partner",
    type: "user",
  },
  async (ctx) => {
    const delegate = await eds.sfMember(ctx, ctx.user.id);
    if (!delegate) return;
    const refMessage = ctx.message.reference;
    const partnershipMsg = await eds.sfMessage(
      ctx.channel?.messages,
      refMessage?.messageId
    );
    if (!partnershipMsg)
      return ctx.quickReply(
        true,
        "ERRNO_404",
        "Сообщение с партнёрством не найдено."
      );
    if (
      !checkPermission(delegate, DgPermissions.postPartnerships) &&
      !checkPermission(delegate, DgPermissions.managePartnerships) &&
      ctx.user.id != partnershipMsg.author.id
    ) return noAccess(ctx);
  
    const invite = await validateConditions(partnershipMsg, true);
    if (typeof invite === "number" || !invite.guild)
      return ctx.quickReply(true, "ERRNO_419", "Приглашение недействительно / не распознано.");

    await partnerMenuSource(ctx, invite.guild.id, invite.guild.name);

    ctx.message
      .edit({ embeds: ctx.message.embeds, components: [] })
      .catch(() => {});
  }
);

async function _sendError(ctx: eds.CommandContext<"text">, errno: ConditionErrno) {
  if (!ctx.inGuild()) return;
  const text = ConditionErrNames[errno];
  BotCache.set(`partnership $$ ${ctx.id} $$ sudo_deleted`, true);
  const reply = await ctx
    .reply({
      embeds: [
        {
          color: resources.colors.error,
          title: "Что-то тут нечисто",
          description:
            `${text}\n\n${resources.emoji.warning} **Удалите сообщение с партнёрством.\n...иначе, __он удалится сам__**`,
          thumbnail: {
            url: resources.images.no,
          },
          footer: {
            text: resources.default_footer.deleteP1m,
            icon_url: resources.images.time,
          },
        },
      ],
    })
    .catch(() => {});
  await eds.wait(60 * 1000);

  await reply?.delete().catch(() => {});
  const deleteResult = await ctx.delete().catch(() => null);

  if (deleteResult != null) DelegateAlerts.deletePartnership(ctx, errno);
}
