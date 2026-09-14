import type { DecompDatabase } from "@db/database";
import { increment } from "@db/helpers/functions";
import { guildConfig } from "@db/schemas/config";
import { eq } from "drizzle-orm";

export const CONFIG = {
  emojis: {
    report: "1497665413834608892",
    resolved: "✅",
    star: "⭐",
  },
} as const;

type GuildConfigSelect = typeof guildConfig.$inferSelect;
type GuildConfigInsert = typeof guildConfig.$inferInsert;

export class DecompGuildConfig {
  private readonly db;
  constructor(decompDb: DecompDatabase) {
    this.db = decompDb.db;
  }

  public async get(guildId: string): Promise<GuildConfigSelect> {
    const config = await this.db
      .select()
      .from(guildConfig)
      .where(eq(guildConfig.guildId, guildId))
      .limit(1);

    if (!config.length) {
      throw new Error(`Guild config not found for guild: ${guildId}`);
    }

    return config.at(0)!;
  }

  public async getConfigValue<K extends keyof GuildConfigSelect>(
    guildId: string,
    key: K,
  ): Promise<GuildConfigSelect[K]> {
    const config = await this.get(guildId);
    return config[key];
  }

  public async insertOrUpdate(
    guildId: string,
    newConfig: Partial<GuildConfigInsert>,
  ): Promise<boolean> {
    const result = await this.db
      .insert(guildConfig)
      .values({ guildId, ...newConfig })
      .onConflictDoUpdate({ set: newConfig, target: guildConfig.guildId })
      .returning();

    return result.length > 0;
  }
}
