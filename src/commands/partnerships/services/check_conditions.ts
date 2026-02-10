import { Client, Invite, Message } from "discord.js";
import { botConfig } from "../../../bot_config.js";
import { BotCache, ConfigEnv, getDate, MSK } from "../../../corelib.js";
import { getBlacklistData } from "../models/blacklist.js";
import { getServerData } from "../models/server.js";
import { wait } from "@eds-fw/framework";


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
  justGetInvite?: boolean,
  checkCooldown: boolean = true
): Promise<ConditionErrno | Invite> {
  if (message.channelId != ConfigEnv.PARTNERSHIPS_CHANNEL_ID) return 0;
  if (message.author.bot) return 0;
  if (message.system) return 0;
  if (message.content.startsWith(botConfig.prefix!)) return 0;
  const inviteMatches = extractInviteCodes(message.content);
  if (!inviteMatches?.length) return ConditionErrno.no_invite;

  const fetchedInvite = await fetchInvite(inviteMatches, message.client);
  if (typeof fetchedInvite == "number") return fetchedInvite;
  if (!fetchedInvite.guild) return ConditionErrno.unfetched_invite;
  if (fetchedInvite.guild.id == message.guildId) return ConditionErrno.this_server;
  if (justGetInvite) return fetchedInvite;

  const date = getDate(MSK(message.createdTimestamp));
  const serverData = await getServerData(fetchedInvite.guild.id);
  const blacklistData = await getBlacklistData(fetchedInvite.guild.id);
  if (blacklistData) return ConditionErrno.blacklist;
  if (ConfigEnv.REQUIREMENT_ONCE_PER_DAY && checkCooldown && getDate(MSK(serverData?.timestamp ?? 1)) == date)
    return ConditionErrno.cooldown;

  return fetchedInvite;
}

/** Возвращает коды приглашений */
export function extractInviteCodes(wholeText: string): string[] {
  const inviteParts = wholeText.matchAll(/(https:\/\/|)(discord.gg|discord.com\/invite)\/([a-zA-Z0-9-_]+)/);
  const inviteCodes = inviteParts.map(M => M[2]);
  return inviteCodes.toArray();
}

export async function fetchInvite(inviteCodes: string[], client: Client): Promise<ConditionErrno | Invite> {
  const rawFetchResults: (Invite | ConditionErrno)[] = [];
  for (const iCode of inviteCodes) {
    const maybeCached = BotCache.get<Invite | null>(`invite_by_code $$ ${iCode}`);
    if (maybeCached) rawFetchResults.push(maybeCached);
    else if (maybeCached === null) rawFetchResults.push(ConditionErrno.unfetched_invite);
    else rawFetchResults.push(await Promise.race([
      client.fetchInvite(iCode).catch(() => (BotCache.set(`invite_by_code $$ ${iCode}`, null), ConditionErrno.unfetched_invite)),
      wait(5_000).then(() => ConditionErrno.rate_limit),
    ]));
  }
  const cleanFetchResults = rawFetchResults.filter((it) => typeof it != "number");
  if (cleanFetchResults.length == 0) return rawFetchResults.find((it) => typeof it == "number")
    ?? ConditionErrno.unfetched_invite;
  
  const invitesFetched = rawFetchResults as Invite[];
  invitesFetched.forEach(invite => BotCache.set(`invite_by_code $$ ${invite.code}`, invite));
  if (
    invitesFetched.filter(
      (x, i) => x?.guild?.id != invitesFetched.at(i - 1)?.guild?.id
    ).length > 0
  ) {
    return ConditionErrno.many_invites;
  }
  return invitesFetched[0]!;
}
