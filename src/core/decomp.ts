import { ProjectSyncer } from "@core/syncer";
import { WatcherService } from "@core/watcher-service";
import { DecompDatabase } from "@db/database";
import { DecompRouter } from "@routing/router.js";
import { Client, GatewayIntentBits } from "discord.js";
import cron, { type ScheduledTask } from "node-cron";
import { snooplogg as snoop } from "snooplogg";

export class Decomp {
  router: DecompRouter;
  client: Client;
  database: DecompDatabase;
  syncer: ProjectSyncer;
  private syncTask?: ScheduledTask;
  watchers: WatcherService;

  async start(token: string) {
    await this.router.load(this);
    await this.router.deploy(token, process.env.CLIENT_ID!, process.env.GUILD_ID);
    await this.client.login(token);

    // Run every hour & on boot
    await this.syncer.sync();
    this.syncTask = cron.schedule("*/30 * * * *", () => {
      this.syncer.sync().catch((error) => {
        snoop.error("Project sync failed:", error);
      });
    });
  }

  stop() {
    void this.syncTask?.stop();
  }

  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds],
      partials: [],
    });
    this.router = new DecompRouter();
    this.database = new DecompDatabase(process.env.DB_FILE_NAME ?? "decomp.db");
    this.syncer = new ProjectSyncer(this.client, this.database);
    this.watchers = new WatcherService(this.database);
  }
}
