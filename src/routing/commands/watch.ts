import { resolvePlatformId, normalizeRepoUrl } from "@core/api";
import type { Decomp } from "@core/decomp";
import { platformEmbed, projectEmbed, type Project } from "@utility/embed";
import { logger } from "@utility/log-buffer";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, TextChannel } from "discord.js";

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

  if (alreadyWatching) {
    await decomp.watchers.register({
      guildId: interaction.guildId!,
      channelId: channel.id,
      projectId: project.id,
      platformId: null,
      interval,
    });

    await interaction.reply({
      content: `Updated **${project.displayName}** watcher in <#${channel.id}> to notify every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const textChannel = await decomp.client.channels.fetch(channel.id);
    if (!(textChannel instanceof TextChannel)) {
      await interaction.reply({
        content: `Cannot send messages to <#${channel.id}>. Make sure it's a text channel.`,
        flags: MessageFlags.Ephemeral,
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

    const message = await textChannel.send({ embeds: [embed] });

    const watcher = await decomp.watchers.register({
      guildId: interaction.guildId!,
      channelId: channel.id,
      projectId: project.id,
      platformId: null,
      interval,
    });

    if (!watcher) {
      await interaction.reply({
        content: `Failed to create watcher for **${project.displayName}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await decomp.database.createBaseline(watcher.id, project.id, project.percentage);
    await decomp.database.setTrackingMessageId(watcher.id, message.id);

    await interaction.reply({
      content: `Now watching **${project.displayName}** in <#${channel.id}>, every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Failed to create watcher for project ${project.id}:`, error);
    await interaction.reply({
      content: `Failed to create watcher. I may not have permission to send messages in <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
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

  if (alreadyWatching) {
    await decomp.watchers.register({
      guildId: interaction.guildId!,
      channelId: channel.id,
      projectId: null,
      platformId,
      interval,
    });

    await interaction.reply({
      content: `Updated **${platformName}** watcher in <#${channel.id}> to notify every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const textChannel = await decomp.client.channels.fetch(channel.id);
    if (!(textChannel instanceof TextChannel)) {
      await interaction.reply({
        content: `Cannot send messages to <#${channel.id}>. Make sure it's a text channel.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const projects = await decomp.database.getProjectsByPlatform(platformId);
    const embedProjects: Project[] = projects.map((project) => ({
      name: project.displayName,
      matchedPercent: project.percentage,
      fuzzyMatchedPercent: project.fuzzyMatchPercent,
      matchedFunctions: project.matchedFunctions,
      totalFunctions: project.totalFunctions,
      projectUrl: project.repository,
      treemapUrl: project.treemapUrl,
    }));

    const embeds = platformEmbed(platformName, embedProjects);
    const message = await textChannel.send({ embeds });

    const watcher = await decomp.watchers.register({
      guildId: interaction.guildId!,
      channelId: channel.id,
      projectId: null,
      platformId,
      interval,
    });

    if (!watcher) {
      await interaction.reply({
        content: `Failed to create watcher for **${platformName}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await Promise.all(
      projects.map((project) =>
        decomp.database.createBaseline(watcher.id, project.id, project.percentage),
      ),
    );
    await decomp.database.setTrackingMessageId(watcher.id, message.id);

    await interaction.reply({
      content: `Now watching all **${platformName}** projects in <#${channel.id}>, every **${interval}%**.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Failed to create platform watcher for ${platformId}:`, error);
    await interaction.reply({
      content: `Failed to create watcher. I may not have permission to send messages in <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
