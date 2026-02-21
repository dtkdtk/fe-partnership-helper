import { AsceticInvite, getBlacklistData, getServerData, InvitesCache } from "#core_functional";
import { ConfigEnv, getDate, MSK } from "#corelib";
import { wait } from "@eds-fw/framework";
import { Client, Message } from "discord.js";
import { botConfig } from "../../bot_config.js";


export enum ConditionErrno {
  just_return,
  no_invite,
  many_invites,
  unfetched_invite,
  cooldown,
  blacklist,
  this_server,
  rate_limit,
}
export const ConditionErrNames: Record<ConditionErrno, string> = {
  [ConditionErrno.just_return]: "*just*",
  [ConditionErrno.no_invite]: `**Ссылка-приглашение не обнаружена.**\nНапоминание: приглашение может быть только прямым, т.е. под доменом \`discord.gg\` или \`discord.com/invite\`. Сторонние сервисы не считаются за приглашение`,
  [ConditionErrno.many_invites]: `**В тексте несколько приглашений на разные сервера.** Какое из них настоящее? Как определить: с каким именно сервером мы заключаем партнёрство?!`,
  [ConditionErrno.unfetched_invite]: `**Приглашение не распознано.** Увы и ах, не удаётся "вытянуть" данные из ссылки.`,
  [ConditionErrno.cooldown]: `**Кулдаун.** Каждый сервер можно публиковать только \`1 раз\` в день. Данный сервер уже публиковался сегодня`,
  [ConditionErrno.blacklist]: `**О НЕЕЕТ! Данный сервер в Чёрном списке (ЧС).**`,
  [ConditionErrno.this_server]: `**Не балуйтесь!** Вы публикуете текст этого же сервера.`,
  [ConditionErrno.rate_limit]: `**ОШИБКА ОШИБКА ОШИБКА ОШИБКА**\n**Бот улетел в рейт-лимит!** И временно не может обработать данный запрос.\nПодождите несколько минут.`,
};

export async function validateConditions(
  message: Message,
  options?: {
    justGetInvite?: boolean,
    checkCooldown?: boolean,
    forceCacheRefresh?: boolean,
  }
): Promise<ConditionErrno | AsceticInvite> {
  if (!ConfigEnv.PARTNERSHIP_CHANNELS_ID.includes(message.channelId)) return 0;
  if (message.author.bot) return 0;
  if (message.system) return 0;
  if (message.content.startsWith(botConfig.prefix!)) return 0;
  const inviteMatches = extractInviteCodes(message.content);
  if (!inviteMatches?.length) return ConditionErrno.no_invite;

  const fetchedInvite = await fetchInvite(inviteMatches, message.client, options?.forceCacheRefresh);
  if (typeof fetchedInvite == "number") return fetchedInvite;
  if (!fetchedInvite.guild) return ConditionErrno.unfetched_invite;
  if (fetchedInvite.guild.id == message.guildId) return ConditionErrno.this_server;
  if (options?.justGetInvite) return fetchedInvite;

  const date = getDate(MSK(message.createdTimestamp));
  const serverData = await getServerData(fetchedInvite.guild.id);
  const blacklistData = await getBlacklistData(fetchedInvite.guild.id);
  if (blacklistData) return ConditionErrno.blacklist;
  if (ConfigEnv.REQUIREMENT_ONCE_PER_DAY
    && (options?.checkCooldown ?? true)
    && getDate(MSK(serverData?.timestamp ?? 1)) == date
  ) {
    return ConditionErrno.cooldown;
  }

  return fetchedInvite;
}

/** Возвращает коды приглашений */
export function extractInviteCodes(wholeText: string): string[] {
  const inviteParts = wholeText.matchAll(/(https:\/\/|)(discord.gg|discord.com\/invite)\/([a-zA-Z0-9-_]+)/g);
  const inviteCodes = Array.from(inviteParts).map(M => M[3]);
  return inviteCodes;
}

export async function fetchInvite(
  inviteCodes: string[], client: Client, forceCacheRefresh?: boolean
): Promise<ConditionErrno | AsceticInvite> {
  const rawFetchResults: (AsceticInvite | ConditionErrno)[] = [];
  for (const iCode of inviteCodes) {
    const maybeCached = await InvitesCache.get(iCode);
    const needToRefresh = forceCacheRefresh
      && maybeCached && typeof maybeCached == "object"
      && Date.now() - maybeCached.lastUpdateTimestamp > InvitesCache.ExpiryDuration;
    if (needToRefresh || maybeCached === null)
      rawFetchResults.push(await Promise.race([
        client.fetchInvite(iCode)
          .then(invite => invite.guild ? AsceticInvite.from(invite) : ConditionErrno.unfetched_invite)
          .catch(() => (InvitesCache.setUnfetched(iCode), ConditionErrno.unfetched_invite)),
        wait(5_000).then(() => ConditionErrno.rate_limit),
      ]));
    else if (maybeCached === InvitesCache.Unfetched)
      rawFetchResults.push(ConditionErrno.unfetched_invite);
    else
      rawFetchResults.push(maybeCached);
  }
  const cleanFetchResults = rawFetchResults.filter((it) => typeof it != "number" && !!it.guild);
  if (cleanFetchResults.length == 0) return rawFetchResults.find((it) => typeof it == "number")
    ?? ConditionErrno.unfetched_invite;
  
  const invitesFetched = (cleanFetchResults as AsceticInvite[]);
  invitesFetched.forEach(InvitesCache.set);
  if (
    invitesFetched.filter(
      (x, i) => x.guild.id != invitesFetched.at(i - 1)?.guild.id
    ).length > 0
  ) {
    return ConditionErrno.many_invites;
  }
  return invitesFetched[0]!;
}
