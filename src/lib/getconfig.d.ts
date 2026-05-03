import type { DgPermissions } from "./checkAccess_permissions.ts";

type ConfigEnvProperties = {
  BOT_SECRET_TOKEN: string;
  GUILD_ID: string;
  PARTNERSHIP_CHANNELS_ID: string[];
  STAFF_CHANNEL_ID: string;
  BOT_SYSTEM_CHANNEL_ID: string;
  ENABLE_DEBUG: boolean;
  PARTNER_ROLE_ID?: string;
  ADMIN_ID_LIST: string[];
  REQUIREMENT_MINIMAL_MEMBERS: number;
  REQUIREMENT_ONCE_PER_DAY: boolean;
  DELETE_OLD_TEXTS: boolean;
  DB_DUMPS_CHANNEL_ID?: string;
  GENERAL_SCAN_UNFETCHED_STRATEGY: "DELETE" | "IGNORE" | "COUNT";
  GENERAL_SCAN_DAILY_LIMIT: number;
  PARTNER_ALERTS_BATCH_DURATION: number;
  TIMEZONE_UTC_OFFSET: number;
  LOG_LEVEL: string;
  LOGS_LIFE_DURATION: number;
  WATCHDOG_BOT_ENABLED: boolean;

  /** `Record<roleId, permissionBitflags>` */
  ROLE_PERMISSIONS: Record<string, DgPermissions>;
  TextPrefix: string; //calculated
  BotVersion: string; //external
};

interface Resources {
  colors: Record<"default" | "gray" | "delegation" | "error", number>;
  images: Record<"briefcase" | "info" | "yes" | "no" | "time" | "list" | "statistics", string>;
  emoji: Record<"briefcase" | "calendar" | "warning" | "yes" | "no" | "system" | "link" | "member", string>;
  button_icons: Record<"calendar" | "yes" | "no" | "warning" | "link" | "trophy", string>;
  default_footer: { delete1h: string; deleteP1m: string; text: string; image: string; };
  text_fragments: Record<"partnerAlert_thanks" | "partnerAlert_tomorrowRemind", string>;
}

export const ConfigEnv: ConfigEnvProperties;
export const resources: Resources;
