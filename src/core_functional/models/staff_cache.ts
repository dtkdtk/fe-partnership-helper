import { DB_StaffCache } from "#corelib";
import { type AnyContext, sfMember } from "@eds-fw/framework";
import type { GuildMember } from "discord.js";
import { type AsceticMaybeMember, AsceticMember } from "../types.js";


export namespace StaffCache {
  export const ExpiryDuration = 3 * 24 * 60 * 60 * 1000; //3 дня
  const resolve = (M: GuildMember | AsceticMaybeMember) =>
    "_id" in M ? M : AsceticMember.from(M);

  export async function get(id: string): Promise<AsceticMember | null> {
    const data = await DB_StaffCache.findOneAsync({ _id: id })
      .catch(() => null);
    if (data === null || !("username" in data)) return null
    else return data;
  }
  export async function update(member: GuildMember | AsceticMaybeMember) {
    const M = resolve(member);
    await DB_StaffCache.updateAsync({ _id: M._id }, M).catch(() => {});
  }
  export async function set(member: GuildMember | AsceticMaybeMember) {
    const M = resolve(member);
    DB_StaffCache.insertAsync(M).catch(() => null) ?? update(M);
  }
}

export async function fetchStaff(ctx: AnyContext, id: string):
  Promise<GuildMember | undefined>
{
  const M = await sfMember(ctx, id);
  if (M) StaffCache.set(M);
  else StaffCache.set({ _id: id, lastUpdateTimestamp: Date.now() });
  return M;
}

export async function getStaffAscData(ctx: AnyContext, id: string):
  Promise<AsceticMember | undefined>
{
  const cached = await StaffCache.get(id);
  const isActual = cached
    ? cached.lastUpdateTimestamp + StaffCache.ExpiryDuration > Date.now()
    : undefined;
  if (cached) {
    if (cached.username) return cached;
    else if (isActual) return undefined;
  }
  const M = await fetchStaff(ctx, id);
  return M ? AsceticMember.from(M) : undefined;
}
