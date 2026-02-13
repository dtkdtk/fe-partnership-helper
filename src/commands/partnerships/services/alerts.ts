import eds from "@eds-fw/framework";
import { ButtonStyle, ComponentType, GuildMember, Message, MessageCreateOptions, User } from "discord.js";
import { ConfigEnv, CoreLog, emoji, quotePartnership, resources } from "../../../corelib.js";
import { TimedQueue } from "../../../lib/timedQueue.js";
import { ConditionErrNames, ConditionErrno } from "./check_conditions.js";
import { Log } from "./log.js";


export namespace PartnerAlerts {

  type AlertsQHandle = {
    partner: User,
    delegate: GuildMember,
    queue: TimedQueue<[string, string]>
  };
  const TIMED_QUEUE_DURATION = ConfigEnv.PARTNER_ALERTS_BATCH_DURATION * 1000;
  const PartnershipAlertsQueue = new Map<string, AlertsQHandle>();
  function _initQueue(inputHandle: Omit<AlertsQHandle, "queue">) {
    const handle = inputHandle as AlertsQHandle;
    const Q = new TimedQueue<[string, string]>(TIMED_QUEUE_DURATION);
    Q.executor = (guilds) => {
      NewPartnership._sendAlert(
        handle.partner, handle.delegate,
        guilds.map(x => x[0]), guilds.map(x => x[1])
      );
      PartnershipAlertsQueue.delete(handle.partner.id);
    }
    handle.queue = Q;
    PartnershipAlertsQueue.set(handle.partner.id, handle);
    return handle;
  }

  export namespace NewPartnership {
    export function queueAlert(
      partner: User,
      delegate: GuildMember,
      guildName: string,
      guildId: string
    ) {
      const handle = PartnershipAlertsQueue.get(partner.id)
        ?? _initQueue({ partner, delegate });
      handle.queue.add([guildName, guildId]);
      handle.queue.restart();
    }

    export async function _sendAlert(
      partner: User,
      delegate: GuildMember,
      partnerGuilds: string[],
      partnerGuildIds: string[]
    ): Promise<boolean> {
      const guild = delegate.guild;
      const displayThanks = resources.text_fragments.partnerAlert_thanks + "\n";
      const displayGuilds = partnerGuilds.length > 1
        ? "Ваши серверы:\n" + partnerGuilds.map(s => `- \`${s}\``).join("\n")
        : "Ваш сервер: \`" + partnerGuilds[0] + "\`";
      const displayTomorrowRemind = ConfigEnv.REQUIREMENT_ONCE_PER_DAY
        ? "\n" + resources.text_fragments.partnerAlert_tomorrowRemind
        : "";
      const message = await partner
        .send({
          embeds: [
            {
              color: resources.colors.delegation,
              title: "Партнёрство с " + guild.name,
              thumbnail: {
                url: resources.images.briefcase,
              },
              description: `${displayThanks}${displayGuilds}${displayTomorrowRemind}\n\n${resources.emoji.warning} **Напоминание:** не выходите с нашего сервера, если заключили на условии взаимного захода; иначе ваш текст будет удалён.`,
              footer: {
                text: `Наш представитель: ${delegate.user.displayName}`,
                icon_url: delegate.user.avatarURL() ?? undefined,
              },
            },
          ],
        })
        .catch(() => {});
      const successful = !!message;
      Log.DMAlert.partner(partner.id, partnerGuildIds, successful);
      return successful;
    }
  }
}


export namespace DelegateAlerts {
  export async function deletePartnership(
    message: Message<true>,
    errno: ConditionErrno,
    isOffline: boolean = false,
  ) {
    const errorMsg = ConditionErrNames[errno];
    const partnershipTextDisplay = quotePartnership(message.content);
    const msg: MessageCreateOptions = {
      content: `<@${message.author.id}>**, ваш текст партнёрства не проходит по условиям и был УДАЛЁН! ${isOffline ? "(при перепроверке)" : ""}**`,
      embeds: [
        {
          color: resources.colors.default,
          description: `**Нарушенное условие:**\n${errorMsg}\n\n**Сам текст:** ||\n${partnershipTextDisplay}||\n\n${resources.emoji.warning} **Этот текст был автоматически удалён.**`,
          footer: eds.getRandomFooterEmbed().data_djs,
        },
      ],
    };
    let success = !!(await message.author.send(msg).catch(() => {}));
    Log.DMAlert.deletePartnership(message.id, message.author.id, success);
    if (!success) {
      const delegateRoom = await eds.sfChannel(
        message.guild.channels,
        ConfigEnv.STAFF_CHANNEL_ID
      );
      if (!delegateRoom?.isTextBased() || !delegateRoom.isSendable()) return;
      success = !!(await delegateRoom
        .send(msg)
        .catch(() => CoreLog.missingPermission("SEND_MESSAGES", { channelId: delegateRoom.id })));
      Log.DMAlert.deletePartnershipFallback(message.id, message.author.id, success);
    }
  }
}
