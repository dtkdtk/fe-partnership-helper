import {
  AsceticInvite,
  deletePartnership,
  getServerData,
  incrementDelegateStats,
  initServerData_byInvite,
  markAsLatest,
  updateServerData_byInvite,
} from "#core_functional";
import {
  ConfigEnv,
  DB_Misc,
  MiscDbData,
  MSK,
  resources
} from "#corelib";
import eds from "@eds-fw/framework";
import {
  Client,
  Collection,
  FetchMessagesOptions,
  GuildTextBasedChannel,
  Message,
} from "discord.js";
import { DelegateAlerts } from "./alerts.js";
import { ConditionErrno, validateConditions } from "./check_conditions.js";
import { runGeneralScan } from "./general_scan.js";
import { Log } from "./log.js";


export async function performPartnershipsScan(client: Client) {
  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  if (!guild) return;

  for (const channelId of ConfigEnv.PARTNERSHIP_CHANNELS_ID) {
    const channel = await eds.sfChannel(guild?.channels, channelId);
    if (!channel?.isSendable()) continue;
    await new PartnershipChannelScanner(client, channel).start();
  }
}

class PartnershipChannelScanner {
  private miscDbData!: MiscDbData;
  private lastScanMessageId: string | undefined;
  private lastScanTimestamp: number = 0;
  private currentMsgTimestamp: number | undefined;
  private notificationWatermark = MSK().date(MSK().date() - 3);
  private fetchOptions: FetchMessagesOptions = { limit: 100, cache: false };

  /** `{message => guildID}` */
  private msgQueue = new Collection<string, Message<true>>();
  private reactionsQueue = new eds.ActionQueue(3_000);

  private get readonlyMode() {
    return !this.lastScanMessageId && !this.lastScanTimestamp;
  }
  private get needAlert() {
    return (
      !this.readonlyMode &&
      MSK(this.currentMsgTimestamp).isAfter(this.notificationWatermark)
    );
  }

  constructor(
    public client: Client,
    public channel: GuildTextBasedChannel,
  ) {}

  async start() {
    this.miscDbData = await DB_Misc.findOneAsync({ _id: "1" });
    this.lastScanMessageId =
      this.miscDbData.last_scanned_message[this.channel.id];
    if (this.lastScanMessageId) {
      const message = await eds.sfMessage(
        this.channel.messages,
        this.lastScanMessageId,
      );
      this.lastScanTimestamp = message?.createdTimestamp ?? 0;
    }

    if (!this.lastScanMessageId && !this.lastScanTimestamp)
      Log.Scan.silentMode();
    Log.Scan.start();
    await this.performScan();
    Log.Scan.end();
    await this.setLatestMessage();
    
    runGeneralScan(this.client);
  }

  private async performScan() {
    if (!this.readonlyMode) {
      this.fetchOptions.after = this.lastScanMessageId;
      await this.queueMessages();
    }
    else {
      // Коллекция начинается с новых сообщений 
      const messages = await this.channel.messages
        .fetch({ limit: 100 })
        .catch(() => {})
      if (!messages?.size) return;
      messages.reverse();
    }

    //Коллекция начинается с самых старых сообщений
    for (const msg of this.msgQueue.values()) {
      if (await this.scanMessage(msg)) break;
    }
  }

  private async queueMessages() {
    let toContinue = true;
    while (toContinue) {
      if (!this.fetchOptions.after) toContinue = false;
      // Коллекция начинается с новых сообщений 
      const messages = await this.channel.messages
        .fetch(this.fetchOptions)
        .catch(() => {});
      if (!messages?.size) break;
      this.fetchOptions.after = messages.firstKey();
      this.msgQueue = this.msgQueue.merge(
        messages,
        a => ({ keep: true, value: a }),
        b => ({ keep: true, value: b }),
        ab => ({ keep: true, value: ab })
      );
      await eds.wait(5_000);
    }
    this.msgQueue.reverse(); //Порядок: с новых -> со старых
    this.msgQueue.sort((A, B) => A.createdTimestamp - B.createdTimestamp); //Гарантированно начинаем со старых
    this.lastScanMessageId = this.msgQueue.last()?.id ?? this.lastScanMessageId;
  }

  private async setLatestMessage() {
    const latestMessageId = this.channel.lastMessageId
      ?? await this.channel.messages.fetch({ limit: 1 })
        .then(messages => messages.at(0)?.id)
        .catch(() => undefined);

    if (latestMessageId)
      markAsLatest(this.channel.id, latestMessageId);
  }

  /** @returns {true} если сканирование завершено */
  private async scanMessage(msg: Message<true>): Promise<true | undefined> {
    this.currentMsgTimestamp = msg.createdTimestamp;
    const invite = await validateConditions(msg);
    if (invite === ConditionErrno.just_return) {
      await deletePartnership(msg);
      return;
    }
    else if (typeof invite === "number") {
      if (!this.readonlyMode) {
        await deletePartnership(msg);
        Log.Scan.messageWrong(msg.id, msg.author.id, invite, this.needAlert);
      }
      if (this.needAlert) DelegateAlerts.deletePartnership(msg, invite, true);
      return;
    }
    else if (invite.guild) {
      Log.Scan.messageOk(msg.id, msg.author.id, this.readonlyMode);
      if (!this.readonlyMode) {
        await incrementDelegateStats(msg.author.id, msg.createdTimestamp);
        this.deferReaction(msg);
      }
      await this.updateServerData(invite, msg);
    }
    else {
      console.error("scan.ts: GOT TO UNREACHABLE CODE POINT. IT IS BAD!!");
    }
  }

  private async updateServerData(invite: AsceticInvite, msg: Message<true>) {
    const serverData =
      (await getServerData(invite.guild.id)) ??
      (await initServerData_byInvite(invite));

    updateServerData_byInvite(
      serverData!,
      invite,
      msg.author.id,
      msg.createdTimestamp,
    );
  }

  private deferReaction(message: Message) {
    this.reactionsQueue.push(async () => {
      await message.react(resources.button_icons.yes).catch(() => {});
    });
  }
}
