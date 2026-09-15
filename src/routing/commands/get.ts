import { getProjectStatus, normalizeRepoUrl, type DecompProject } from "@core/api";
import type { Decomp } from "@core/decomp";
import { projectEmbed } from "@utility/embed";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags } from "discord.js";

export async function handleGet(decomp: Decomp, interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const repoUrl = normalizeRepoUrl(interaction.options.getString("repo_url", true));

  const project = await decomp.database.getProjectByRepository(repoUrl);
  if (!project) {
    await interaction.editReply({
      content: `No tracked project found with repository \`${repoUrl}\`.`,
    });
    return;
  }

  const asDecompProject: DecompProject = {
    id: project.id,
    platformId: project.platformId,
    platformName: project.platformName,
    repository: project.repository,
    displayName: project.displayName,
  };

  let status;
  try {
    status = await getProjectStatus(asDecompProject);
  } catch {
    await interaction.editReply({
      content: "Failed to fetch live status from decomp.dev. Try again shortly.",
    });
    return;
  }

  const embed = projectEmbed({
    name: project.displayName,
    matchedPercent: status.percentage,
    fuzzyMatchedPercent: status.fuzzyMatchPercent,
    matchedFunctions: status.matchedFunctions,
    totalFunctions: status.totalFunctions,
    projectUrl: project.repository,
    treemapUrl: status.treemapUrl,
  });

  await interaction.editReply({ embeds: [embed] });
}
