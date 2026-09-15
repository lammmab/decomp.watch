import { getProjects, type DecompStatus } from "@core/api";
import { DecompDatabase } from "@db/database";
import { completedEmbed, milestoneEmbed, projectEmbed, type Project } from "@utility/embed";
import { ActivityType, Client, TextChannel } from "discord.js";
import { snooplogg as snoop } from "snooplogg";

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

    // Process projects sequentially to avoid overwhelming the database and Discord API
    for (const status of statuses) {
      // eslint-disable-next-line no-await-in-loop
      const watchers = await this.database.getWatchersForProject(status.id, status.platformId);
      if (!this.firstLoad && watchers.length === 0) continue;

      // eslint-disable-next-line no-await-in-loop
      await this.database.upsertProject({
        id: status.id,
        platformId: status.platformId,
        platformName: status.platformName,
        repository: status.repository,
        displayName: status.displayName,
        percentage: status.percentage,
      });

      if (watchers.length === 0) continue;

      // Create baselines for new projects appearing on watched platforms
      for (const watcher of watchers) {
        if (watcher.platformId) {
          // eslint-disable-next-line no-await-in-loop
          const baseline = await this.database.getBaselineForWatcherProject(watcher.id, status.id);
          if (!baseline) {
            // eslint-disable-next-line no-await-in-loop
            await this.database.createBaseline(watcher.id, status.id, status.percentage);
          }
        }
      }

      const embedProject = toEmbedProject(status);

      // eslint-disable-next-line no-await-in-loop
      await this.updatePersistentEmbed(status.id, embedProject);

      if (status.percentage >= 100) {
        // eslint-disable-next-line no-await-in-loop
        await this.announceCompletion(status.id, status.platformId, embedProject);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await this.notifyMilestones(status.id, status.platformId, status.percentage, embedProject);
    }

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

  private async updatePersistentEmbed(projectId: number, embedProject: Project) {
    const watchers = await this.database.getWatchersForProject(projectId, embedProject.name);
    const embed = projectEmbed(embedProject);

    // Process watchers sequentially to respect Discord rate limits
    for (const watcher of watchers) {
      // eslint-disable-next-line no-await-in-loop
      const channel = await this.fetchTextChannel(watcher.channelId);
      if (!channel) continue;

      if (watcher.trackingMessageId) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const message = await channel.messages.fetch(watcher.trackingMessageId);
          // eslint-disable-next-line no-await-in-loop
          await message.edit({ embeds: [embed] });
          continue;
        } catch (error) {
          snoop.error(
            `Failed to edit tracking message for watcher ${watcher.id}, resending:`,
            error,
          );
        }
      }

      // eslint-disable-next-line no-await-in-loop
      const message = await channel.send({ embeds: [embed] });
      // eslint-disable-next-line no-await-in-loop
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
      // eslint-disable-next-line no-await-in-loop
      const baseline = await this.database.getBaselineForWatcherProject(watcher.id, projectId);
      if (!baseline) continue;

      const currentStep = Math.floor(percentage / watcher.interval);
      const milestonePercentage = currentStep * watcher.interval;

      const shouldNotify =
        currentStep > baseline.lastNotifiedStep &&
        currentStep >= 1 &&
        milestonePercentage > baseline.baselinePercentage;

      if (shouldNotify) {
        // eslint-disable-next-line no-await-in-loop
        const channel = await this.fetchTextChannel(watcher.channelId);
        if (channel) {
          // eslint-disable-next-line no-await-in-loop
          await channel.send({ embeds: [milestoneEmbed(embedProject, milestonePercentage)] });
        }
        // eslint-disable-next-line no-await-in-loop
        await this.database.updateBaselineNotified(watcher.id, projectId, currentStep);
      }
    }
  }

  private async announceCompletion(projectId: number, platformId: string, embedProject: Project) {
    const watchers = await this.database.getWatchersForProject(projectId, platformId);

    // Process watchers sequentially to respect Discord rate limits
    for (const watcher of watchers) {
      // eslint-disable-next-line no-await-in-loop
      const channel = await this.fetchTextChannel(watcher.channelId);
      if (channel) {
        // eslint-disable-next-line no-await-in-loop
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
      snoop.error(`Failed to fetch channel ${channelId}:`, error);
      return undefined;
    }
  }
}
