import { resolvePlatformId, normalizeRepoUrl } from "@core/api";
import type { Decomp } from "@core/decomp";
import { platformEmbed, projectEmbed, type Project } from "@utility/embed";
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
      await decomp.database.createBaseline(watcher.id, project.id, project.percentage);

      try {
        const embed = projectEmbed({
          name: project.displayName,
          matchedPercent: project.percentage,
          fuzzyMatchedPercent: project.fuzzyMatchPercent,
          matchedFunctions: project.matchedFunctions,
          totalFunctions: project.totalFunctions,
          projectUrl: project.repository,
          treemapUrl: project.treemapUrl,
        });
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

  const watcher = await decomp.watchers.register({
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

    if (watcher) {
      const projects = await decomp.database.getProjectsByPlatform(platformId);
      await Promise.all(
        projects.map((project) =>
          decomp.database.createBaseline(watcher.id, project.id, project.percentage),
        ),
      );

      try {
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
        const textChannel = await decomp.client.channels.fetch(channel.id);
        if (textChannel instanceof TextChannel) {
          const message = await textChannel.send({ embeds });
          await decomp.database.setTrackingMessageId(watcher.id, message.id);
        }
      } catch (error) {
        snoop.error(`Failed to post initial platform embed for ${platformId}:`, error);
      }
    }
  }
}
