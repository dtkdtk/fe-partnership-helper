import { DB_InvitesCache } from "../../../databases.js";
import { AsceticInvite } from "../types.js";

export namespace InvitesCache {
  export const Unfetched = Symbol();

  export async function get(inviteCode: string): Promise<AsceticInvite | null | typeof Unfetched> {
    const data = await DB_InvitesCache.findOneAsync({ _id: inviteCode });
    if (data === null) return null;
    else if ("guild" in data) return data;
    else return Unfetched;
  }
  export function set(data: AsceticInvite) {
    return DB_InvitesCache.insertAsync({ ...data });
  }
  export function setUnfetched(inviteCode: string) {
    return DB_InvitesCache.insertAsync({ _id: inviteCode });
  }
} 
