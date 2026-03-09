import { ConfigEnv, CoreLog } from "#corelib";
import { eds } from "@eds-fw/framework";
import { AttachmentBuilder } from "discord.js";
import { AutoDumpAction, setAutoDumpAction } from "../auto_dump.js";;


const dumpAction: AutoDumpAction = async (blob) => {
  const client = eds.runtimeStorage.client;
  if (!client.isReady()) return;

  const guild = await eds.sfGuild(client.guilds, ConfigEnv.GUILD_ID);
  if (!guild) return;

  const channel = await eds.sfChannel(guild.channels, ConfigEnv.DB_DUMPS_CHANNEL_ID);
  if (!channel?.isTextBased()) return;
  
  const messages = await channel.messages.fetch({ limit: 50, cache: false });
  for (const [, msg] of messages) {
    if (!msg.content.startsWith("[FPH AutoDump]")) continue;
    await msg.delete().catch(() => {});
  }
  const attachment = new AttachmentBuilder(Buffer.from(await blob.arrayBuffer()))
    .setName("DatabasesAutoDump.zip");
  await channel.send({
    content: "[FPH AutoDump]",
    files: [attachment]
  }).catch(CoreLog.unexpectedError);
}

//Enable auto-dumps feature
if (ConfigEnv.DB_DUMPS_CHANNEL_ID) setAutoDumpAction(dumpAction);

export const pragmaSkip = true;

//cSpell:words seald
