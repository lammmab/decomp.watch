import {
  resolvePlatformId,
  normalizeRepoUrl,
  getProjectStatus,
  type DecompStatus,
} from "@core/api";
import type { Decomp } from "@core/decomp";
import { projectEmbed, type Project } from "@utility/embed";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, TextChannel } from "discord.js";
import { snooplogg as snoop } from "snooplogg";

export async function handleWatchRepo(decomp: Decomp, interaction: ChatInputCommandInteraction) {
  const repoUrl = normalizeRepoUrl(interaction.options.getString("project", true));
  const channel = interaction.options.getChannel("channel", true);
  const interval = interaction.options.getInteger("milestone_interval", true);

  const project = await decomp.database.getProjectByRepository(repoUrl);
  if (!project) {
    await interaction.reply({
      content: `No tracked project found with repository \`${repoUrl}\`. It may not be tracked by decomp.dev, or the URL doesn't match exactly.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = await decomp.database.getWatchersForChannel(interaction.guildId!, channel.id);
  const alreadyWatching = existing.find((w) => w.projectId === project.id && w.platformId === null);

  const watcher = await decomp.watchers.register({
    guildId: interaction.guildId!,
    channelId: channel.id,
    projectId: project.id,
    platformId: null,
    interval,
  });

  if (alreadyWatching) {
    await interaction.reply({
      content: `Updated **${project.displayName}** watcher in <#${channel.id}> to notify every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: `Now watching **${project.displayName}** in <#${channel.id}>, every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });

    if (watcher) {
      try {
        const status = await getProjectStatus(project);
        const embed = projectEmbed(toEmbedProject(status));
        const textChannel = await decomp.client.channels.fetch(channel.id);
        if (textChannel instanceof TextChannel) {
          const message = await textChannel.send({ embeds: [embed] });
          await decomp.database.setTrackingMessageId(watcher.id, message.id);
        }
      } catch (error) {
        snoop.error(`Failed to post initial embed for project ${project.id}:`, error);
      }
    }
  }
}

export async function handleWatchPlatform(
  decomp: Decomp,
  interaction: ChatInputCommandInteraction,
) {
  const platformName = interaction.options.getString("platform_name", true);
  const channel = interaction.options.getChannel("channel", true);
  const interval = interaction.options.getInteger("milestone_interval", true);

  const platformId = resolvePlatformId(platformName);
  if (!platformId) {
    await interaction.reply({
      content: `Unknown platform \`${platformName}\`. Try a name like "Nintendo 64" or an id like "n64".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = await decomp.database.getWatchersForChannel(interaction.guildId!, channel.id);
  const alreadyWatching = existing.find((w) => w.projectId === null && w.platformId === platformId);

  await decomp.watchers.register({
    guildId: interaction.guildId!,
    channelId: channel.id,
    projectId: null,
    platformId,
    interval,
  });

  if (alreadyWatching) {
    await interaction.reply({
      content: `Updated **${platformName}** watcher in <#${channel.id}> to notify every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content: `Now watching all **${platformName}** projects in <#${channel.id}>, every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

function toEmbedProject(status: DecompStatus): Project {
  return {
    name: status.displayName,
    matchedPercent: status.percentage,
    fuzzyMatchedPercent: status.fuzzyMatchPercent,
    matchedFunctions: status.matchedFunctions,
    totalFunctions: status.totalFunctions,
    projectUrl: status.repository,
    treemapUrl: status.treemapUrl,
  };
}
