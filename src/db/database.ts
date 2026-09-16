import { Database } from "bun:sqlite";

import * as schema from "@db/schemas";
import { eq, and, desc, or, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

type ProjectInsert = typeof schema.projects.$inferInsert;
type WatcherInsert = Omit<typeof schema.watchers.$inferInsert, "id" | "createdAt">;

export class DecompDatabase {
  public readonly db;

  public constructor(path: string = ":memory:") {
    const sqlite = new Database(path, { create: true });
    this.db = drizzle({
      client: sqlite,
      schema,
    });

    migrate(this.db, { migrationsFolder: "./.drizzle" });

    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
  }

  public close() {
    this.db.$client.close();
  }

  // == Projects ==

  public async upsertProject(project: ProjectInsert) {
    const [row] = await this.db
      .insert(schema.projects)
      .values(project)
      .onConflictDoUpdate({
        target: schema.projects.id,
        set: {
          platformId: project.platformId,
          platformName: project.platformName,
          repository: project.repository,
          displayName: project.displayName,
          treemapUrl: project.treemapUrl,
          percentage: project.percentage,
          fuzzyMatchPercent: project.fuzzyMatchPercent,
          matchedFunctionsPercent: project.matchedFunctionsPercent,
          matchedDataPercent: project.matchedDataPercent,
          totalUnits: project.totalUnits,
          totalFunctions: project.totalFunctions,
          matchedFunctions: project.matchedFunctions,
          updatedAt: sql`(unixepoch())`,
        },
      })
      .returning();
    return row;
  }

  public async getProject(id: number) {
    return await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    });
  }

  public async getAllProjects() {
    return await this.db.select().from(schema.projects).orderBy(desc(schema.projects.percentage));
  }

  public async getProjectCount(): Promise<number> {
    const [row] = await this.db.select({ count: sql<number>`count(*)` }).from(schema.projects);
    return row?.count ?? 0;
  }

  public async getProjectCountByPlatform(
    platformId: typeof schema.projects.$inferSelect.platformId,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.projects)
      .where(eq(schema.projects.platformId, platformId));
    return row?.count ?? 0;
  }

  public async getProjectsByPlatform(platformId: string) {
    return await this.db
      .select()
      .from(schema.projects)
      .where(sql`${schema.projects.platformId} = ${platformId}`);
  }

  public async deleteProject(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.projects)
      .where(eq(schema.projects.id, id))
      .returning({ id: schema.projects.id });
    return result.length > 0;
  }

  // == Watchers ==

  public async addWatcher(watcher: WatcherInsert) {
    const [row] = await this.db
      .insert(schema.watchers)
      .values(watcher)
      .onConflictDoUpdate({
        target: [
          schema.watchers.guildId,
          schema.watchers.channelId,
          schema.watchers.projectIdNorm,
          schema.watchers.platformIdNorm,
        ],
        set: {
          interval: watcher.interval,
        },
      })
      .returning();
    return row;
  }

  public async removeWatcher(id: number): Promise<boolean> {
    const result = await this.db
      .delete(schema.watchers)
      .where(eq(schema.watchers.id, id))
      .returning({ id: schema.watchers.id });
    return result.length > 0;
  }

  public async getWatchersForChannel(guildId: string, channelId: string) {
    return await this.db
      .select()
      .from(schema.watchers)
      .where(and(eq(schema.watchers.guildId, guildId), eq(schema.watchers.channelId, channelId)));
  }

  public async getWatchersForProject(projectId: number, platformId: string) {
    return await this.db
      .select()
      .from(schema.watchers)
      .where(
        or(
          eq(schema.watchers.projectId, projectId),
          and(isNull(schema.watchers.projectId), eq(schema.watchers.platformId, platformId)),
          and(isNull(schema.watchers.projectId), isNull(schema.watchers.platformId)),
        ),
      );
  }

  public async getAllWatchers() {
    return await this.db.select().from(schema.watchers);
  }

  public async setTrackingMessageId(id: number, messageId: string) {
    const [row] = await this.db
      .update(schema.watchers)
      .set({ trackingMessageId: messageId })
      .where(eq(schema.watchers.id, id))
      .returning();
    return row;
  }

  public async getProjectByRepository(repository: string) {
    return await this.db.query.projects.findFirst({
      where: sql`LOWER(${schema.projects.repository}) = ${repository.toLowerCase()}`,
    });
  }

  // == Watcher Baselines ==

  public async createBaseline(watcherId: number, projectId: number, baselinePercentage: number) {
    const [row] = await this.db
      .insert(schema.watcherBaselines)
      .values({ watcherId, projectId, baselinePercentage })
      .onConflictDoNothing()
      .returning();
    return row;
  }

  public async getBaselinesForWatcher(watcherId: number) {
    return await this.db
      .select()
      .from(schema.watcherBaselines)
      .where(eq(schema.watcherBaselines.watcherId, watcherId));
  }

  public async getBaselineForWatcherProject(watcherId: number, projectId: number) {
    return await this.db.query.watcherBaselines.findFirst({
      where: and(
        eq(schema.watcherBaselines.watcherId, watcherId),
        eq(schema.watcherBaselines.projectId, projectId),
      ),
    });
  }

  public async updateBaselineNotified(watcherId: number, projectId: number, step: number) {
    const [row] = await this.db
      .update(schema.watcherBaselines)
      .set({ lastNotifiedStep: step })
      .where(
        and(
          eq(schema.watcherBaselines.watcherId, watcherId),
          eq(schema.watcherBaselines.projectId, projectId),
        ),
      )
      .returning();
    return row;
  }
}
