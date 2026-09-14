import { createFrameHandler, emojiFeedFor } from "@bridge/handlers";
import { DecompDatabase } from "@db/database";
import { DecompRouter } from "@routing/router.js";
import { Client, GatewayIntentBits, Partials } from "discord.js";

import { DecompGuildConfig } from "./config";

export class Decomp {
  router: DecompRouter;
  client: Client;
  database: DecompDatabase;
  guildConfig: DecompGuildConfig;

  async start(token: string) {
    await this.router.load(this);
    await this.router.deploy(token, process.env.CLIENT_ID!, process.env.GUILD_ID);
    await this.client.login(token);

    this.bridge = startBridge(
      { secret: process.env.BRIDGE_SECRET, port: process.env.BRIDGE_PORT },
      process.env.GUILD_ID ? createFrameHandler(this, process.env.GUILD_ID) : undefined,
      (serverId) => this.mcStatus.forget(serverId),
      process.env.GUILD_ID ? () => emojiFeedFor(this, process.env.GUILD_ID!) : undefined,
    );
  }

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
      partials: [Partials.Message, Partials.Reaction, Partials.Channel],
    });
    this.router = new DecompRouter();
    this.database = new DecompDatabase("decomp.db");
    this.guildConfig = new DecompGuildConfig(this.database);
  }
}
