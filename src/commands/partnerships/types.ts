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
