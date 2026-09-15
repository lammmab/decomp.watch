import type { DecompEvent } from "@routing/router";
import { MessageFlags, type Interaction, type InteractionReplyOptions } from "discord.js";

export default {
  name: "interactionCreate",
  async execute(decomp, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = decomp.router.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(decomp, interaction);
    } catch (error) {
      console.error(`Command ${interaction.commandName} failed:`, error);

      const errorReply: InteractionReplyOptions = {
        content: "Something went wrong running that command.",
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  },
} satisfies DecompEvent<[Interaction]>;
