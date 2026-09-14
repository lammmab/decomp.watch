/*
 * router.ts
 * A dumb router for Discord commands and events;
 * Creating for some nice modularity :)
 *
 * Made by @gee.wzz
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Decomp } from "@core/decomp";
import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { REST, Routes } from "discord.js";
import { snooplogg as snoop } from "snooplogg";

function collectFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) return collectFiles(full);
      if (/\.(test|spec)\.(js|ts)$/.test(full)) return [];
      return full.endsWith(".js") || full.endsWith(".ts") ? [full] : [];
    });
  } catch {
    return [];
  }
}

export interface DecompEvent<T extends unknown[] = unknown[]> {
  name: string;
  once?: boolean;
  execute: (decomp: Decomp, ...args: T) => void | Promise<void>;
}

export interface DecompCommand {
  name: string;
  description: string;
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (decomp: Decomp, interaction: ChatInputCommandInteraction) => void | Promise<void>;
}

export class DecompRouter {
  readonly commands = new Map<string, DecompCommand>();
  readonly events = new Map<string, DecompEvent[]>();

  async deploy(token: string, clientId: string, guildId?: string): Promise<void> {
    const rest = new REST().setToken(token);
    const body = [...this.commands.values()].map((cmd) => cmd.data.toJSON());

    const route = guildId
      ? Routes.applicationGuildCommands(clientId, guildId)
      : Routes.applicationCommands(clientId);

    await rest.put(route, { body });
    snoop.info(`[DecompRouter] Deployed ${body.length} command(s) to Discord.`);
  }

  async load(decomp: Decomp): Promise<void> {
    await this.loadEvents(decomp);
    await this.loadCommands();
  }

  private async loadEvents(decomp: Decomp): Promise<void> {
    const eventsPath = join(__dirname, "./events");
    const files = collectFiles(eventsPath);
    if (!files.length) {
      snoop.warn("[DecompRouter] No events/ folder found — skipping.");
      return;
    }

    await Promise.all(
      files.map(async (file) => {
        const filePath = pathToFileURL(file).href;
        const mod = await import(filePath);
        const event: DecompEvent = mod.default ?? mod;

        if (!event?.name) {
          snoop.warn(`[DecompRouter] Skipping ${file} — missing 'name' export.`);
          return;
        }

        const existing = this.events.get(event.name) ?? [];
        this.events.set(event.name, [...existing, event]);

        const handler = (...args: unknown[]) => {
          Promise.resolve(event.execute(decomp, ...args)).catch((error: unknown) => {
            snoop.error(`Event ${event.name} failed:`, error);
          });
        };

        if (event.once) {
          decomp.client.once(event.name, handler);
        } else {
          decomp.client.on(event.name, handler);
        }

        snoop.info(`[DecompRouter] Registered event: ${event.name}`);
      }),
    );
  }

  private async loadCommands(): Promise<void> {
    const commandsPath = join(__dirname, "./commands");
    const files = collectFiles(commandsPath);
    if (!files.length) {
      snoop.warn("[DecompRouter] No commands/ folder found — skipping.");
      return;
    }

    await Promise.all(
      files.map(async (file) => {
        const filePath = pathToFileURL(file).href;
        const mod = await import(filePath);
        const command: DecompCommand = mod.default ?? mod;
        if (!command?.name) {
          snoop.warn(`[DecompRouter] Skipping ${file} — missing 'name' export.`);
          return;
        }

        this.commands.set(command.name, command);
        snoop.info(`[DecompRouter] Registered command: ${command.name}`);
      }),
    );
  }
}
