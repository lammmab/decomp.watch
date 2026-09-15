import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

import { projects } from "./projects";

export const watchers = sqliteTable(
  "watchers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),

    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),

    platformId: text("platform_id"),

    interval: integer("interval").notNull(),

    trackingMessageId: text("tracking_message_id"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    projectIdNorm: integer("project_id_norm").generatedAlwaysAs(
      (): any => sql`COALESCE(project_id, -1)`,
      { mode: "stored" },
    ),

    platformIdNorm: text("platform_id_norm").generatedAlwaysAs(
      (): any => sql`COALESCE(platform_id, '')`,
      { mode: "stored" },
    ),
  },
  (table) => ({
    uniqueWatch: uniqueIndex("watchers_unique").on(
      table.guildId,
      table.channelId,
      table.projectIdNorm,
      table.platformIdNorm,
    ),
  }),
);
