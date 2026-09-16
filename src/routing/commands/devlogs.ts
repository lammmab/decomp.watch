import type { Decomp } from "@core/decomp";
import type { DecompCommand } from "@routing/router";
import { logger } from "@utility/log-buffer";
import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

const AUTHORIZED_USER_ID = process.env.DEVELOPER_USER_ID ?? "335589777308909571";
const MAX_EMBED_DESC_LENGTH = 4096;

export default {
  name: "devlogs",
  description: "View application logs (developer only)",

  data: new SlashCommandBuilder().setName("devlogs").setDescription("View application logs"),

  async execute(_decomp: Decomp, interaction: ChatInputCommandInteraction) {
    if (interaction.user.id !== AUTHORIZED_USER_ID) {
      await interaction.reply({
        content: "This command is restricted to the bot developer.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const logs = logger.getLogs();

    if (logs.length === 0) {
      await interaction.reply({
        content: "No logs in buffer.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const logLines = logs.map((log) => {
      const timestamp = log.timestamp.toISOString().substring(11, 19);
      return `[${timestamp}] ${log.level.padEnd(5)} ${log.message}`;
    });

    const chunks: string[] = [];
    let currentChunk = "";

    for (const line of logLines) {
      if ((currentChunk + line + "\n").length > MAX_EMBED_DESC_LENGTH - 10) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = line + "\n";
      } else {
        currentChunk += line + "\n";
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    const embeds = chunks.slice(0, 10).map((chunk, index) => {
      const embed = new EmbedBuilder()
        .setTitle(index === 0 ? "Application Logs" : `Application Logs (cont'd ${index + 1})`)
        .setDescription(`\`\`\`\n${chunk}\`\`\``)
        .setColor(0x5865f2)
        .setFooter({ text: `${logs.length} total logs | Buffer: ${MAX_EMBED_DESC_LENGTH} chars` });

      if (index === 0) {
        embed.setTimestamp();
      }

      return embed;
    });

    await interaction.reply({
      embeds,
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies DecompCommand;
