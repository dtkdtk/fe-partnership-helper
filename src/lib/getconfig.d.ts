import type { DgPermissions } from "./checkAccess_permissions.ts";

type ConfigEnvProperties = Record<
  | "BOT_SECRET_TOKEN"
  | "GUILD_ID"
  | "PARTNERSHIPS_CHANNEL_ID"
  | "STAFF_CHANNEL_ID"
  | "BOT_SYSTEM_CHANNEL_ID"
  | "TextPrefix" //calculated
  | "BotVersion", //external
  string
> & {
  ENABLE_DEBUG: boolean;
  PARTNER_ROLE_ID?: string;
  REQUIREMENT_MINIMAL_MEMBERS: number;
  REQUIREMENT_ONCE_PER_DAY: boolean;
  DELETE_OLD_TEXTS: boolean;
  PARTNER_ALERTS_BATCH_DURATION: number;
  TIMEZONE_UTC_OFFSET: number;
  ADMIN_ID_LIST: string[];
  /** `Record<roleId, permissionBitflags>` */
  ROLE_PERMISSIONS: Record<string, DgPermissions>;
};

interface Resources {
  colors: Record<"default" | "gray" | "delegation" | "error", number>;
  images: Record<"briefcase" | "info" | "yes" | "no" | "time" | "list" | "statistics", string>;
  emoji: Record<"briefcase" | "calendar" | "warning" | "yes" | "no" | "system" | "link" | "member", string>;
  button_icons: Record<"calendar" | "yes" | "no" | "warning" | "link", string>;
  default_footer: { delete1h: string; deleteP1m: string; text: string; image: string; };
  text_fragments: Record<"partnerAlert_thanks" | "partnerAlert_tomorrowRemind", string>;
}

export const ConfigEnv: ConfigEnvProperties;
export const resources: Resources;
