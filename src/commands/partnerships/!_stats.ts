import {
  ActivityTypes,
  statsMenuSource,
  StatsViewType
} from "#core_functional";
import {
  checkPermission,
  CoreLog,
  DgPermissions,
  noAccess
} from "#corelib";
import eds from "@eds-fw/framework";
import { MessageFlags } from "discord.js";

export default {
  async run(ctx) {
    const user = ctx.options.getUser("user") ?? ctx.user;

    if (user.id != ctx.user.id
      && !checkPermission(ctx.member, DgPermissions.viewForeignStats)
    ) {
      return noAccess(ctx);
    }

    const lazyDefer = ctx.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(CoreLog.unexpectedError);
    
    // Используем общую функцию с типом DELEGATE
    const msg = await statsMenuSource(
      ctx, 
      ActivityTypes.TWO_WEEKS, // По умолчанию показываем за 2 недели
      StatsViewType.DELEGATE,
      user
    );

    await lazyDefer;
    ctx.followUp(msg).catch(CoreLog.unexpectedError);
  },

  info: {
    name: "био-делегата",
    type: "slash",
    desc: "Просмотр статистики делегата",
  },
} satisfies eds.CommandFile<"slash">;

// Кнопки для переключения режимов у делегата
eds.createButton({ custom_id: "delegation-stats.mode.today" },
  async (ctx) => {
    // Здесь нужно получить ID делегата из контекста
    // Это можно сделать через кастомные данные в кнопке или из сообщения
    const userId = ctx.user.id; // В реальности нужно получать целевого пользователя
    
    if (!checkPermission(ctx.member, DgPermissions.viewForeignStats) && userId !== ctx.user.id) {
      return noAccess(ctx);
    }
    
    const lazyDefer = ctx.deferUpdate().catch(CoreLog.unexpectedError);
    const msg = await statsMenuSource(
      ctx, 
      ActivityTypes.TODAY,
      StatsViewType.DELEGATE,
      ctx.user // Здесь должен быть целевой пользователь
    );
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    ctx.editReply(msg).catch(CoreLog.unexpectedError);
  }
);

eds.createButton({ custom_id: "delegation-stats.mode.two_weeks" },
  async (ctx) => {
    const userId = ctx.user.id; // В реальности нужно получать целевого пользователя
    
    if (!checkPermission(ctx.member, DgPermissions.viewForeignStats) && userId !== ctx.user.id) {
      return noAccess(ctx);
    }
    
    const lazyDefer = ctx.deferUpdate().catch(CoreLog.unexpectedError);
    const msg = await statsMenuSource(
      ctx, 
      ActivityTypes.TWO_WEEKS,
      StatsViewType.DELEGATE,
      ctx.user // Здесь должен быть целевой пользователь
    );
    if ("flags" in msg) delete msg.flags;
    await lazyDefer;
    ctx.editReply(msg).catch(CoreLog.unexpectedError);
  }
);