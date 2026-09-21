import { rateLimitSafe, tReply } from "#corelib";
import { Client } from "discord.js";
import { InvitesCache } from "../models/invite_cache.js";
import { getServerData, updateServerData_byInvite } from "../models/server.js";
import { AsceticInvite, ServerData } from "../types.js";
import { ConditionErrno } from "./check_conditions.js";


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
      && (Date.now() - maybeCached.lastUpdateTimestamp > InvitesCache.ExpiryDuration
        || maybeCached.temporary);
    if (needToRefresh || maybeCached === null)
      rawFetchResults.push(
        await rateLimitSafe(client.fetchInvite(iCode)
          .then(invite => invite.guild ? AsceticInvite.from(invite) : ConditionErrno.unfetched_invite)
          .catch(() => (InvitesCache.setUnfetched(iCode), ConditionErrno.unfetched_invite)))
        .catch(() => ConditionErrno.rate_limit)
      );
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


export async function extractFromInviteOrId(client: Client, input: string):
  Promise<{ data?: ServerData; invite?: AsceticInvite } | null>
{
  const isGuildId = /^\d+$/.test(input);
  let targetGuildId: string;
  let partnershipDbData: ServerData | null;
  let maybeInvite: AsceticInvite | undefined;
  if (!isGuildId) {
    const invite = await fetchInvite(extractInviteCodes(input), client);
    if (typeof invite == "number" || !invite?.guild)
      return null;
    else {
      targetGuildId = invite.guild.id;
      partnershipDbData = await getServerData(targetGuildId);
      maybeInvite = invite as AsceticInvite;
      if (partnershipDbData)
        updateServerData_byInvite(partnershipDbData, invite);
    }
  }
  else {
    targetGuildId = input;
    partnershipDbData = await getServerData(targetGuildId);
  }
  if (!targetGuildId) return null;
  return {
    data: partnershipDbData ?? undefined,
    invite: maybeInvite,
  };
}
