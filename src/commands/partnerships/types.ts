import { Invite } from "discord.js";
import { DateRecord } from "../../corelib.js";


export interface DelegateStats {
  /** user id */
  _id: string;
  total_partnerships: number;
  activity: DateRecord<number/*PartnershipCount*/>;
}

export interface ServerData {
  /** server id */
  _id: string;
  timestamp: number;
  message_id: string | null;
  last_name: string;
  last_members_count: number;

  delegates: DateRecord<string/*ID*/>;
  partners: DateRecord<string/*ID*/>;
}

export interface PartnerData {
  /** user id */
  _id: string;
  username: string;
  delegates: DateRecord<string/*ID*/>;
  server_ids: DateRecord<string/*ID*/>;
}

export interface ServerBlacklistData {
  /** server id */
  _id: string;
  timestamp: number;

  reason: string;
  admin_id: string;
}

export interface AsceticInvite {
  /** Invite code */
  _id: string;
  guild: {
    id: string;
    name: string;
    iconURL?: string;
  };
  temporary: boolean;
  memberCount?: number;
  lastUpdateTimestamp: number;
}
export namespace AsceticInvite {
  export function from(invite: Invite): AsceticInvite {
    return {
      _id: invite.code,
      guild: {
        id: invite.guild!.id,
        name: invite.guild!.name,
        iconURL: invite.guild!.iconURL() ?? undefined,
      },
      temporary: !!(invite.temporary || invite.expiresTimestamp),
      memberCount: invite.memberCount ?? undefined,
      lastUpdateTimestamp: Date.now(),
    };
  }
}



//cSpell:words mili poli
/*
type ServerThematic =
  | "anime|vanilla"
  | "communicating"
  | "advertisement"
  | "role_play"
  | "mili_poli_play"
  | "games"
  | "bot_support|it"
  | "media"
  | "thematic_community"
  | "other";
*/
