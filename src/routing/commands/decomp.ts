import type { Decomp } from "@core/decomp";
import type { DecompCommand } from "@routing/router";
import { ChannelType, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";

import { handleGet } from "./get";
import { handleWatchPlatform, handleWatchRepo } from "./watch";

export default {
  name: "decomp",
  description: "Track decomp.dev projects and platforms",

  data: new SlashCommandBuilder()
    .setName("decomp")
    .setDescription("Track decomp.dev projects and platforms")
    .addSubcommand((sub) =>
      sub
        .setName("watch-repo")
        .setDescription("Watch a specific project's decompilation progress")
        .addStringOption((option) =>
          option
            .setName("repo_url")
            .setDescription("The project's repository URL")
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to post updates in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("milestone_interval")
            .setDescription("Notify every X% matched (e.g. 5 = every 5%)")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("watch-platform")
        .setDescription("Watch every project on a platform")
        .addStringOption((option) =>
          option
            .setName("platform_name")
            .setDescription("e.g. Nintendo 64, GameCube")
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel to post updates in")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("milestone_interval")
            .setDescription("Notify every X% matched (e.g. 5 = every 5%)")
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("get")
        .setDescription("Get a project's current decompilation status")
        .addStringOption((option) =>
          option
            .setName("repo_url")
            .setDescription("The project's repository URL")
            .setRequired(true),
        ),
    ),

  async execute(decomp: Decomp, interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
      case "watch-repo":
        return handleWatchRepo(decomp, interaction);
      case "watch-platform":
        return handleWatchPlatform(decomp, interaction);
      case "get":
        return handleGet(decomp, interaction);
    }
  },
} satisfies DecompCommand;
