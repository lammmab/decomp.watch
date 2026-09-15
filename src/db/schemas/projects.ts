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

  treemapUrl: text("treemap_url").notNull(),
  percentage: real("percentage").notNull(),
  fuzzyMatchPercent: real("fuzzy_match_percent").notNull(),
  matchedFunctionsPercent: real("matched_functions_percent").notNull(),
  matchedDataPercent: real("matched_data_percent").notNull(),
  totalUnits: integer("total_units").notNull(),
  totalFunctions: integer("total_functions").notNull(),
  matchedFunctions: integer("matched_functions").notNull(),

  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
