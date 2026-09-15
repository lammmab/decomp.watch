import { normalizeRepoUrl } from "@core/api";
import type { Decomp } from "@core/decomp";
import { projectEmbed } from "@utility/embed";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

export async function handleGet(decomp: Decomp, interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const repoUrl = normalizeRepoUrl(interaction.options.getString("project", true));

  const project = await decomp.database.getProjectByRepository(repoUrl);
  if (!project) {
    await interaction.editReply({
      content: `No tracked project found with repository \`${repoUrl}\`.`,
    });
    return;
  }

  const embed = projectEmbed({
    name: project.displayName,
    matchedPercent: project.percentage,
    fuzzyMatchedPercent: project.fuzzyMatchPercent,
    matchedFunctions: project.matchedFunctions,
    totalFunctions: project.totalFunctions,
    projectUrl: project.repository,
    treemapUrl: project.treemapUrl,
  });

  await interaction.editReply({ embeds: [embed] });
}
