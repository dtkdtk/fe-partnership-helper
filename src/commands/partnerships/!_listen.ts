import {
  clearOldPartnerships,
  ConditionErrNames, ConditionErrno,
  DelegateAlerts,
  deletePartnership,
  getDelegateStats,
  getServerData,
  incrementDelegateStats, initDelegateStats,
  initServerData_byInvite,
  Log,
  markAsLatest,
  partnerMenuSource,
  updateServerData_byInvite,
  validateConditions
} from "#core_functional";
import {
  BotCache, checkPermission, ConfigEnv, DgPermissions,
  getDate, lastDatedVal, MessageInvites, MSK, noAccess, resources
} from "#corelib";
import eds, { CommandContext } from "@eds-fw/framework";
import { ComponentType, SelectMenuDefaultValueType } from "discord.js";
import { CoreLog } from "../../logging.js";


export default {
  async run(ctx) {
    if (!ctx.inGuild() || ctx.guildId != ConfigEnv.GUILD_ID) return;
    if (ConfigEnv.PARTNERSHIP_CHANNELS_ID.includes(ctx.channelId)
      && ctx.author.bot
      && ctx.author.id != ctx.client.user.id
    ) {
      ctx.delete().catch(() => {});
      return;
    }

    const warnings = [];
    const minimalMembers = ConfigEnv.REQUIREMENT_MINIMAL_MEMBERS;
    const invite = await validateConditions(ctx, { forceCacheRefresh: true });
    if (invite === 0) return;
    if (typeof invite == "number")
      return _sendError(ctx, invite);
    if (!invite.guild) return;

    if (invite.temporary)
      warnings.push(`## ${resources.emoji.warning} **ВНИМАНИЕ! Ссылка временная. Попросите партнёра заменить её.**`);
    if (minimalMembers && invite.memberCount && invite.memberCount < minimalMembers)
      warnings.push(`## ${resources.emoji.warning} **ВНИМАНИЕ! На сервере нет [${minimalMembers}] участников.**`);

    if (ConfigEnv.DELETE_OLD_TEXTS) clearOldPartnerships(ctx, invite);
    MessageInvites.set(ctx.id, invite.guild.id);

    let isNewPartnership = false;
    const serverData = await getServerData(invite.guild.id)
      ?? (isNewPartnership = true, await initServerData_byInvite(invite))!;

    //Более точечный/гарантированный вариант в сравнении с clearOldPartnerships().
    if (!isNewPartnership && serverData.message_id && ConfigEnv.DELETE_OLD_TEXTS)
      deletePreviousText(ctx, serverData.message_id);

    serverData.message_id = ctx.id;
    const prevPartnerID = lastDatedVal(serverData.partners);
    updateServerData_byInvite(serverData, invite, ctx.user.id, ctx.createdTimestamp);
    markAsLatest(ctx.id, ctx.channelId);
    const delegateStats = (
      await getDelegateStats(ctx.user.id) ?? await initDelegateStats(ctx.user.id),
      await incrementDelegateStats(ctx.user.id, +MSK())
    );

    const todayDate = getDate(MSK());
    const todayPartnerships = delegateStats?.activity[todayDate] ?? 0
        , totalPartnerships = delegateStats?.total_partnerships ?? 0
        , displayWarnings = warnings.length ? ("\n" + warnings.join("\n")) : ""
        , displayMembers = eds.formatNumber(invite.memberCount ?? 0)

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
- За сегодня: **${todayPartnerships}**
- За всё время: **${totalPartnerships}**

Сервер: \`${invite.guild.name}\`
ID: \`${invite.guild.id}\`
Участников: \`${displayMembers}\`${resources.emoji.member}${displayWarnings}`,
            thumbnail: {
              url: invite.guild.iconURL ?? resources.images.briefcase,
            },
            footer: {
              text: resources.default_footer.delete1h,
              icon_url: resources.images.time,
            },
          },
        ],
        allowedMentions: { repliedUser: warnings.length ? true : false },
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.UserSelect,
                custom_id: "partnership.set-partner",
                placeholder: "Назначить партнёра (если с ВЗ)",
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
      .catch(() => CoreLog.missingPermission("SEND_MESSAGES", { channelId: ctx.channelId }));
    Log.Listen.messageOk(ctx.id, ctx.author.id);
    ctx.react(resources.button_icons.yes).catch(() => {});
    if (!reply) return;

    setTimeout(() => reply.delete().catch(() => {}), 60 * 60 * 1000); //час
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
      ctx.user.id != partnershipMsg.author.id
      && !checkPermission(delegate, DgPermissions.managePartnerships)
    ) return noAccess(ctx);
  
    const invite = await validateConditions(partnershipMsg, { justGetInvite: true });
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
  Log.Listen.messageWrong(ctx.id, ctx.author.id, errno);
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

async function deletePreviousText(ctx: CommandContext<"text">, messageId: string) {
  const message = await eds.sfMessage(ctx, messageId);
  if (!message) return;
  deletePartnership(message);
  Log.Listen.messageOld(messageId, ctx.id);
}
