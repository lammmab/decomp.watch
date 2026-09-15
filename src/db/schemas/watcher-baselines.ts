import { sqliteTable, integer, primaryKey } from "drizzle-orm/sqlite-core";

import { projects } from "./projects";
import { watchers } from "./watchers";

export const watcherBaselines = sqliteTable(
  "watcher_baselines",
  {
    watcherId: integer("watcher_id")
      .notNull()
      .references(() => watchers.id, { onDelete: "cascade" }),

    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    baselinePercentage: integer("baseline_percentage").notNull(),

    lastNotifiedStep: integer("last_notified_step").notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.watcherId, table.projectId] }),
  }),
);
