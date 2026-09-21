import {
  addToBlacklist,
  extractFromInviteOrId,
  getBlacklistData,
  getPartnerData,
  Log,
  partnerMenuSource,
  removeFromBlacklist,
  ServerData
} from "#core_functional";
import {
  BotCache,
  checkPermission, DgPermissions,
  emoji,
  lastDatedVal,
  resources,
  tReply
} from "#corelib";
import eds from "@eds-fw/framework";
import { BaseMessageOptions, ButtonStyle, ComponentType, MessageActionRowComponentData, MessageFlags, SelectMenuDefaultValueType, TextInputStyle } from "discord.js";
import { CoreLog } from "../../logging.js";


export default {
  async run(ctx) {
    const rawTarget = ctx.options.getString("target")!.trim();
    const extractedData = await extractFromInviteOrId(ctx.client, rawTarget);

    if (extractedData == null)
      return tReply.error(ctx, "Ошибка 404", "Сервер не распознан / не найден.");

    let warnings = "";
    const { data, invite } = extractedData;
    const targetId = data?._id ?? invite?._id!;

    if (!extractedData.data)
      warnings +=
        `\n## ${resources.emoji.warning} **Сервер не найден в базе. Скорее всего, партнёрство с ним не заключалось**`;
    else
      warnings +=
        `\nДата последнего партнёрства: <t:${Math.floor((extractedData.data.timestamp ?? 0) / 1000)}>`;

    const alwaysServerData: Partial<ServerData> = {
      _id: targetId,
      last_members_count: data?.last_members_count ?? invite?.memberCount,
      last_name: data?.last_name ?? invite?.guild.name,
    };

    const partnerIDs = data?.partners
      ? Object.values(data.partners) : [];
    const delegateIDs = data?.delegates
      ? Object.values(data.delegates) : [];
    const partners = partnerIDs.length
      ? (await Promise.all(partnerIDs.map(getPartnerData)))
        .filter(x => x != null)
      : [];
    const delegates = delegateIDs.length
      ? (await Promise.all(delegateIDs.map(id => eds.sfUser(ctx, id))))
        .filter(x => x != null)
      : [];
    const prevPartnerID = data
      ? lastDatedVal(data.partners) : undefined;
    const previousPartner = prevPartnerID
      ? await eds.sfMember(ctx, prevPartnerID) : undefined;

    const mbBlacklistData = await getBlacklistData(targetId);
    const mbBlacklistAdmin = await eds.sfUser(ctx, mbBlacklistData?.admin_id);
    const displayBlacklist = mbBlacklistData
      ? `\n# В ЧЁРНОМ СПИСКЕ\n**Причина:** ${mbBlacklistData.reason}\n**Админ:** \`${mbBlacklistAdmin?.username ?? mbBlacklistData.admin_id}\`\n**Дата:** <t:${Math.floor(mbBlacklistData.timestamp / 1000)}:d>`
      : "";
    
    const displayPartners = partners.length
      ? "\n" + partners.map(it => `- \`${it?.username}\``).join("\n")
      : "*<нет>*";
    const displayDelegates = delegates.length
      ? "\n" + delegates.map(it => `- \`${it?.username}\``).join("\n")
      : "*<нет>*";

    const components = [{
      type: ComponentType.ActionRow,
      components: [{
        type: ComponentType.UserSelect,
        customId: "edit-server.set-partner",
        placeholder: "Назначить партнёра",
        disabled: !data,
        ...(previousPartner ? {
          defaultValues: prevPartnerID
          ? [{
              type: SelectMenuDefaultValueType.User,
              id: prevPartnerID,
            }]
          : undefined,
        } : {})
      }] as MessageActionRowComponentData[]
    }] satisfies BaseMessageOptions["components"];

    if (checkPermission(ctx.member, DgPermissions.manageBlacklist))
      if (mbBlacklistData)
        components.push({
          type: ComponentType.ActionRow,
          components: [{
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            customId: "edit-server.blacklist.remove",
            label: "Убрать из ЧС",
            emoji: emoji(resources.button_icons.yes),
          }]
        });
      else
        components.push({
          type: ComponentType.ActionRow,
          components: [{
            type: ComponentType.Button,
            style: ButtonStyle.Danger,
            customId: "edit-server.blacklist.add",
            label: "Занести в ЧС",
            emoji: emoji(resources.button_icons.warning),
          }]
        });

    const reply = await ctx
      .reply({
        flags: [MessageFlags.Ephemeral],
        withResponse: true,

        embeds: [
          {
            color: resources.colors.gray,
            author: {
              name: "Информация о сервере",
              icon_url: resources.images.info,
            },
            title: `${alwaysServerData.last_name ?? "<неизвестный>"}\n[${targetId}]`,
            description:
              `Участников: \`${alwaysServerData.last_members_count}\`\nПартнёры: ${displayPartners}\nДелегаты: ${displayDelegates}\n`
              + displayBlacklist
              + warnings,
          },
        ],
        components,
      })
      .catch(CoreLog.unexpectedError);
    if (!reply) return;
    const msgId = reply.interaction.responseMessageId;

    BotCache.set(`message $$ ${msgId} $$ target_guild`, targetId);
    BotCache.set(`message $$ ${msgId} $$ target_guild_name`, alwaysServerData.last_name);
  },

  info: {
    name: "редактировать-партнёрство",
    type: "slash",
    desc: "Редактировать данные о партнёрстве",
  },
} satisfies eds.CommandFile<"slash">;


eds.createMenu(
  {
    custom_id: "edit-server.set-partner",
    type: "user",
  },
  async (ctx) => {
    const targetGuildId = BotCache.get(
      `message $$ ${ctx.message.id} $$ target_guild`
    ) as string;
    const targetGuildName = BotCache.get(
      `message $$ ${ctx.message.id} $$ target_guild_name`
    ) as string;
    
    await partnerMenuSource(ctx, targetGuildId, targetGuildName);
  }
);



eds.createButton(
  {
    custom_id: "edit-server.blacklist.add",
  },
  async (ctx) => {
    ctx
      .update({
        embeds: [
          {
            color: resources.colors.gray,
            description:
              resources.emoji.warning + " **Вы уверены что хотите занести данный сервер в ЧС?**",
          },
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: "edit-server.blacklist.add:cancel",
                label: "Отмена",
                emoji: emoji(resources.button_icons.no),
              },
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                customId: "edit-server.blacklist.add:confirm",
                label: "Занести в ЧС",
                emoji: emoji(resources.button_icons.yes),
              },
            ],
          },
        ],
      })
      .catch(CoreLog.unexpectedError);
  }
);
eds.createButton(
  {
    custom_id: "edit-server.blacklist.add:cancel",
  },
  async (ctx) => {
    ctx
      .update({
        content: '*На "нет" и суда нет...*',
        embeds: [],
        components: [],
      })
      .catch(CoreLog.unexpectedError);
  }
);
eds.createButton(
  {
    custom_id: "edit-server.blacklist.add:confirm",
  },
  async (ctx) => {
    ctx
      .showModal({
        customId: "edit-server.blacklist.add:confirm.modal",
        title: "Занести в ЧС",
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.TextInput,
                customId: "reason",
                label: "Укажите причину",
                style: TextInputStyle.Short,
                minLength: 1,
                maxLength: 256,
              },
            ],
          },
        ],
      })
      .catch(CoreLog.unexpectedError);
  }
);
eds.createModal(
  {
    custom_id: "edit-server.blacklist.add:confirm.modal",
  },
  async (ctx) => {
    if (!ctx.message) return;
    const targetGuildId = BotCache.get(
      `message $$ ${ctx.message.id} $$ target_guild`
    ) as string;

    const reason = ctx.fields.getTextInputValue("reason");

    if ("update" in ctx)
      ctx
        .update({
          embeds: [
            {
              color: resources.colors.gray,
              title: "Сервер занесён в ЧС.",
              description: `**Причина:** \`\`\`\n${reason}\`\`\``,
            },
          ],
          components: [],
        })
        .catch(CoreLog.unexpectedError);

    await addToBlacklist(targetGuildId, reason, ctx.user.id);
    Log.EditServer.addBlacklist(targetGuildId, ctx.user.id, reason);
  }
);



eds.createButton(
  {
    custom_id: "edit-server.blacklist.remove",
  },
  async (ctx) => {
    ctx
      .update({
        embeds: [
          {
            color: resources.colors.gray,
            description:
              resources.emoji.warning + " **Вы уверены что хотите удалить данный сервер из ЧС?**",
          },
        ],
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: "edit-server.blacklist.remove:cancel",
                label: "Отмена",
                emoji: emoji(resources.button_icons.no),
              },
            ],
          },
          {
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                customId: "edit-server.blacklist.remove:confirm",
                label: "Удалить из ЧС",
                emoji: emoji(resources.button_icons.yes),
              },
            ],
          },
        ],
      })
      .catch(CoreLog.unexpectedError);
  }
);
eds.createButton(
  {
    custom_id: "edit-server.blacklist.remove:cancel",
  },
  async (ctx) => {
    ctx
      .update({
        content: '*На "нет" и суда нет...*',
        embeds: [],
        components: [],
      })
      .catch(CoreLog.unexpectedError);
  }
);
eds.createButton(
  {
    custom_id: "edit-server.blacklist.remove:confirm",
  },
  async (ctx) => {
    if (!ctx.message) return;
    const targetGuildId = BotCache.get(
      `message $$ ${ctx.message.id} $$ target_guild`
    ) as string;

    ctx
      .update({
        embeds: [
          {
            color: resources.colors.gray,
            title: "Сервер удалён из ЧС.",
          },
        ],
        components: [],
      })
      .catch(CoreLog.unexpectedError);

    await removeFromBlacklist(targetGuildId);
    Log.EditServer.removeBlacklist(targetGuildId, ctx.user.id);
  }
);
