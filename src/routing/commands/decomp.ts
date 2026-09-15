import { getProjects, platforms } from "@core/api";
import type { Decomp } from "@core/decomp";
import type { DecompCommand } from "@routing/router";
import {
  ChannelType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";

import { handleGet } from "./get";
import { handleWatchPlatform, handleWatchRepo } from "./watch";

export async function handleAutocomplete(
  _decomp: Decomp,
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);

  if (focused.name === "platform_name") {
    const input = focused.value.toLowerCase();
    const platformChoices = Object.values(platforms).map((name) => ({
      name,
      value: name,
    }));
    const filtered = platformChoices
      .filter((platform) => platform.name.toLowerCase().includes(input))
      .slice(0, 25);
    await interaction.respond(filtered);
  } else if (focused.name === "project") {
    const input = focused.value.toLowerCase();
    try {
      const projects = await getProjects();
      const filtered = projects
        .filter((project) => {
          const repoLower = project.repository.toLowerCase();
          const nameLower = project.displayName.toLowerCase();
          return repoLower.includes(input) || nameLower.includes(input);
        })
        .slice(0, 25)
        .map((project) => ({
          name: `${project.displayName} (${project.platformName})`,
          value: project.repository,
        }));
      await interaction.respond(filtered);
    } catch (error) {
      console.error("Failed to fetch projects for autocomplete:", error);
      await interaction.respond([]);
    }
  }
}

export default {
  name: "decomp",
  description: "Track decomp.dev projects and platforms",

  data: new SlashCommandBuilder()
    .setName("decomp")
    .setDescription("Track decomp.dev projects and platforms")
    .addSubcommand((sub) =>
      sub
        .setName("watch-project")
        .setDescription("Watch a specific project's decompilation progress")
        .addStringOption((option) =>
          option
            .setName("project")
            .setDescription("The project's repository URL or name")
            .setRequired(true)
            .setAutocomplete(true),
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
            .setRequired(true)
            .setAutocomplete(true),
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
            .setName("project")
            .setDescription("The project's repository URL or name")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),

  async execute(decomp: Decomp, interaction: ChatInputCommandInteraction) {
    switch (interaction.options.getSubcommand()) {
      case "watch-project":
        return handleWatchRepo(decomp, interaction);
      case "watch-platform":
        return handleWatchPlatform(decomp, interaction);
      case "get":
        return handleGet(decomp, interaction);
    }
  },
} satisfies DecompCommand;
