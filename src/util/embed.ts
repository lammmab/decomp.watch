/*
 * embed.ts
 * Tiny Discord embed builder with templates for tracking updates.
 *
 * Made by @gee.wzz
 */

import { EmbedBuilder } from "discord.js";

export interface Project {
  name: string;
  matchedPercent: number;
  fuzzyMatchedPercent: number;
  matchedFunctions: number;
  totalFunctions: number;
  projectUrl: string;
  treemapUrl: string;
}

const AUTHOR = "Decompilation Tracking";
const AUTHOR_URL = "https://decomp.dev";

export function projectEmbed(project: Project): EmbedBuilder {
  return new EmbedBuilder()
    .setAuthor({
      name: AUTHOR,
      url: AUTHOR_URL,
    })
    .setTitle(project.name)
    .setURL(project.projectUrl)
    .setDescription(
      `**${project.matchedPercent.toFixed(2)}%** matched | ` +
        `**${project.fuzzyMatchedPercent.toFixed(2)}%** fuzzy matched | ` +
        `**${project.matchedFunctions} / ${project.totalFunctions}** functions matched`,
    )
    .setImage(project.treemapUrl)
    .setColor(0x237feb);
}

export function milestoneEmbed(project: Project, milestone: number): EmbedBuilder {
  return new EmbedBuilder()
    .setAuthor({
      name: AUTHOR,
      url: AUTHOR_URL,
    })
    .setTitle("Milestone Hit!")
    .setURL(project.projectUrl)
    .setDescription(`${project.name} has now been **${milestone}%** decompiled!`)
    .setColor(0xffcf00);
}

export function completedEmbed(project: Project): EmbedBuilder {
  return new EmbedBuilder()
    .setAuthor({
      name: AUTHOR,
      url: AUTHOR_URL,
    })
    .setTitle("Fully Decompiled!")
    .setDescription(
      `${project.name} has now been **fully decompiled!** Congratulations to the team!`,
    )
    .setFooter({
      text: "Note: this project will no longer be tracked.",
    })
    .setColor(0x52ff00);
}
