import type { PlatformId } from "@core/api";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  // decomp.dev's own numeric project id, used as our primary key directly
  id: integer("id").primaryKey(),

  platformId: text("platform_id").$type<PlatformId>().notNull(),
  platformName: text("platform_name").notNull(),
  repository: text("repository").notNull(),
  displayName: text("display_name").notNull(),

  percentage: real("percentage").notNull(),

  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
