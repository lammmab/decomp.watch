/* eslint-disable-next-line no-await-in-loop */
import { getProjects, type DecompStatus } from "@core/api";
import { DecompDatabase } from "@db/database";
import {
  completedEmbed,
  milestoneEmbed,
  platformEmbed,
  projectEmbed,
  type Project,
} from "@utility/embed";
import { logger } from "@utility/log-buffer";
import { ActivityType, Client, TextChannel } from "discord.js";

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

export class ProjectSyncer {
  private client: Client;
  private database: DecompDatabase;
  private firstLoad = true;

  constructor(client: Client, database: DecompDatabase) {
    this.client = client;
    this.database = database;
  }

  public async sync() {
    const statuses = await getProjects();
    const platformsWithWatchers = new Set<string>();

    // Process projects sequentially to avoid overwhelming the database and Discord API
    for (const status of statuses) {
      const watchers = await this.database.getWatchersForProject(status.id, status.platformId);
      if (!this.firstLoad && watchers.length === 0) continue;

      await this.database.upsertProject({
        id: status.id,
        platformId: status.platformId,
        platformName: status.platformName,
        repository: status.repository,
        displayName: status.displayName,
        treemapUrl: status.treemapUrl,
        percentage: status.percentage,
        fuzzyMatchPercent: status.fuzzyMatchPercent,
        matchedFunctionsPercent: status.matchedFunctionsPercent,
        matchedDataPercent: status.matchedDataPercent,
        totalUnits: status.totalUnits,
        totalFunctions: status.totalFunctions,
        matchedFunctions: status.matchedFunctions,
      });

      if (watchers.length === 0) continue;

      // Create baselines for new projects appearing on watched platforms
      for (const watcher of watchers) {
        if (watcher.platformId) {
          platformsWithWatchers.add(watcher.platformId);
          const baseline = await this.database.getBaselineForWatcherProject(watcher.id, status.id);
          if (!baseline) {
            await this.database.createBaseline(watcher.id, status.id, status.percentage);
          }
        }
      }

      const embedProject = toEmbedProject(status);

      // Update only project-specific watchers (platform watchers are updated in bulk later)
      await this.updatePersistentEmbed(status.id, status.platformId, embedProject);

      if (status.percentage >= 100) {
        await this.announceCompletion(status.id, status.platformId, embedProject);
        continue;
      }

      await this.notifyMilestones(status.id, status.platformId, status.percentage, embedProject);
    }

    // Update all platform watchers with combined embeds
    await this.updateAllPlatformWatchers(platformsWithWatchers);

    const projectCount = await this.database.getProjectCount();

    this.client.user?.setPresence({
      activities: [
        {
          name: "customstatus",
          state: `Watching ${projectCount} decomps 👀`,
          type: ActivityType.Custom,
        },
      ],
      status: "online",
    });

    this.firstLoad = false;
  }

  private async updatePersistentEmbed(
    projectId: number,
    platformId: string,
    embedProject: Project,
  ) {
    const watchers = await this.database.getWatchersForProject(projectId, platformId);
    // platform watchers are handled separately
    const projectWatchers = watchers.filter((w) => w.projectId !== null);
    const embed = projectEmbed(embedProject);

    // Process watchers sequentially to respect Discord rate limits
    for (const watcher of projectWatchers) {
      const channel = await this.fetchTextChannel(watcher.channelId);
      if (!channel) continue;

      if (watcher.trackingMessageId) {
        try {
          const message = await channel.messages.fetch(watcher.trackingMessageId);
          await message.edit({ embeds: [embed] });
          continue;
        } catch (error) {
          logger.error(
            `Failed to edit tracking message for watcher ${watcher.id}, resending:`,
            error,
          );
        }
      }

      const message = await channel.send({ embeds: [embed] });
      await this.database.setTrackingMessageId(watcher.id, message.id);
    }
  }

  private async notifyMilestones(
    projectId: number,
    platformId: string,
    percentage: number,
    embedProject: Project,
  ) {
    const relevant = await this.database.getWatchersForProject(projectId, platformId);

    // Process watchers sequentially to respect Discord rate limits
    for (const watcher of relevant) {
      const baseline = await this.database.getBaselineForWatcherProject(watcher.id, projectId);
      if (!baseline) continue;

      const currentStep = Math.floor(percentage / watcher.interval);
      const milestonePercentage = currentStep * watcher.interval;

      const shouldNotify =
        currentStep > baseline.lastNotifiedStep &&
        currentStep >= 1 &&
        milestonePercentage > baseline.baselinePercentage;

      if (shouldNotify) {
        const channel = await this.fetchTextChannel(watcher.channelId);
        if (channel) {
          await channel.send({ embeds: [milestoneEmbed(embedProject, milestonePercentage)] });
        }
        await this.database.updateBaselineNotified(watcher.id, projectId, currentStep);
      }
    }
  }

  private async announceCompletion(projectId: number, platformId: string, embedProject: Project) {
    const watchers = await this.database.getWatchersForProject(projectId, platformId);

    // Process watchers sequentially to respect Discord rate limits
    for (const watcher of watchers) {
      const baseline = await this.database.getBaselineForWatcherProject(watcher.id, projectId);
      if (!baseline || baseline.baselinePercentage >= 100) continue;

      const channel = await this.fetchTextChannel(watcher.channelId);
      if (channel) {
        await channel.send({ embeds: [completedEmbed(embedProject)] });
      }
    }

    await this.database.deleteProject(projectId);
  }

  private async fetchTextChannel(channelId: string): Promise<TextChannel | undefined> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel instanceof TextChannel ? channel : undefined;
    } catch (error) {
      logger.error(`Failed to fetch channel ${channelId}:`, error);
      return undefined;
    }
  }

  private async updateAllPlatformWatchers(platformIds: Set<string>) {
    for (const platformId of platformIds) {
      const projects = await this.database.getProjectsByPlatform(platformId);
      if (projects.length === 0) continue;

      const platformName = projects[0]?.platformName ?? platformId;
      const embedProjects: Project[] = projects.map(toEmbedProject);
      const embeds = platformEmbed(platformName, embedProjects);

      const watchers = await this.database.getWatchersForProject(0, platformId);
      const platformWatchers = watchers.filter(
        (w) => w.projectId === null && w.platformId === platformId,
      );

      for (const watcher of platformWatchers) {
        const channel = await this.fetchTextChannel(watcher.channelId);
        if (!channel) continue;

        if (watcher.trackingMessageId) {
          try {
            const message = await channel.messages.fetch(watcher.trackingMessageId);
            await message.edit({ embeds });
            continue;
          } catch (error) {
            logger.error(
              `Failed to edit platform tracking message for watcher ${watcher.id}, resending:`,
              error,
            );
          }
        }

        const message = await channel.send({ embeds });
        await this.database.setTrackingMessageId(watcher.id, message.id);
      }
    }
  }
}
