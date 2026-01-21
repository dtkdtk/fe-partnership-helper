import { hasRole, type AnyContext } from "@eds-fw/framework";
import { APIInteractionGuildMember, GuildMember, PermissionFlagsBits } from "discord.js";
import { DgPermissions } from "./checkAccess_permissions.js";
import { ConfigEnv, resources } from "./getconfig.js";

const _permAdmin = PermissionFlagsBits.Administrator;

export function checkPermission(
  member: GuildMember | APIInteractionGuildMember | null,
  permission: DgPermissions
): boolean {
  if (member === null) return false;
  if (typeof member.permissions === "string" && (BigInt(member.permissions) & _permAdmin)) return true;
  else if (typeof member.permissions !== "string" && member.permissions.has(_permAdmin)) return true;
  const roles = Object.keys(ConfigEnv.ROLE_PERMISSIONS);
  let result: DgPermissions = DgPermissions._no;
  for (const role of roles)
    result |= hasRole(member)(role) ? ConfigEnv.ROLE_PERMISSIONS[role] : 0;
  return (result & permission) === permission;
}

export function noAccess(ctx: AnyContext) {
  ctx.quickReply(
    true,
    "Ошибка",
    `\`\`\`d\nУ вас нет прав на это\`\`\``,
    undefined,
    undefined,
    { thumbnail: { url: resources.images.no } }
  );
}
