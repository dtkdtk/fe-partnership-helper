import { ActivityTypes, statsMenuSource } from "#core_functional";
import {
  checkPermission,
  CoreLog,
  DgPermissions,
  noAccess,
} from "#corelib";
import eds from "@eds-fw/framework";
import { MessageFlags } from "discord.js";

export default {
  async run(ctx) {
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }

    const lazyDefer = ctx.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(CoreLog.unexpectedError);
    const msg = await statsMenuSource(ctx, ActivityTypes.TODAY);
    await lazyDefer;
    ctx.followUp(msg).catch(CoreLog.unexpectedError);
  },

  info: {
    name: "стата-делегации",
    type: "slash",
    desc: "Статистика деятельности делегации",
  },
} satisfies eds.CommandFile<"slash">;

eds.createButton({ custom_id: "delegation-stats.mode.today" },
  async (ctx) => {
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }
    
    const lazyDefer = ctx.deferUpdate().catch(CoreLog.unexpectedError);
    const msg = await statsMenuSource(ctx, ActivityTypes.TODAY);
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    ctx.editReply(msg).catch(CoreLog.unexpectedError);
  }
);

eds.createButton({ custom_id: "delegation-stats.mode.two_weeks" },
  async (ctx) => {
    if (!checkPermission(ctx.member, DgPermissions.viewDepartmentStats)) {
      return noAccess(ctx);
    }
    
    const lazyDefer = ctx.deferUpdate();
    const msg = await statsMenuSource(ctx, ActivityTypes.TWO_WEEKS);
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    ctx.editReply(msg).catch(CoreLog.unexpectedError);
  }
);
