import { resolvePlatformId, normalizeRepoUrl } from "@core/api";
import type { Decomp } from "@core/decomp";
import type { ChatInputCommandInteraction } from "discord.js";
import { MessageFlags, PermissionFlagsBits } from "discord.js";

export async function handleUnwatchRepo(decomp: Decomp, interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
    interaction.inGuild()
  ) {
    await interaction.reply({
      content: "You need the **Manage Channels** permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const repoUrl = normalizeRepoUrl(interaction.options.getString("project", true));
  const channel = interaction.options.getChannel("channel", true);

  const project = await decomp.database.getProjectByRepository(repoUrl);
  if (!project) {
    await interaction.reply({
      content: `No tracked project found with repository \`${repoUrl}\`. It may not be tracked by decomp.dev, or the URL doesn't match exactly.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = await decomp.database.getWatchersForChannel(interaction.guildId!, channel.id);
  const watcher = existing.find((w) => w.projectId === project.id && w.platformId === null);

  if (!watcher) {
    await interaction.reply({
      content: `**${project.displayName}** is not being watched in <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await decomp.database.removeWatcher(watcher.id);

  await interaction.reply({
    content: `Stopped watching **${project.displayName}** in <#${channel.id}>.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleUnwatchPlatform(
  decomp: Decomp,
  interaction: ChatInputCommandInteraction,
) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) &&
    interaction.inGuild()
  ) {
    await interaction.reply({
      content: "You need the **Manage Channels** permission to use this command.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const platformName = interaction.options.getString("platform_name", true);
  const channel = interaction.options.getChannel("channel", true);

  const platformId = resolvePlatformId(platformName);
  if (!platformId) {
    await interaction.reply({
      content: `Unknown platform \`${platformName}\`. Try a name like "Nintendo 64" or an id like "n64".`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const existing = await decomp.database.getWatchersForChannel(interaction.guildId!, channel.id);
  const watcher = existing.find((w) => w.projectId === null && w.platformId === platformId);

  if (!watcher) {
    await interaction.reply({
      content: `**${platformName}** platform is not being watched in <#${channel.id}>.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await decomp.database.removeWatcher(watcher.id);

  await interaction.reply({
    content: `Stopped watching all **${platformName}** projects in <#${channel.id}>.`,
    flags: MessageFlags.Ephemeral,
  });
}
