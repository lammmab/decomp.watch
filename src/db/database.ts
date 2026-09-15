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
          percentage: project.percentage,
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
      .onConflictDoNothing()
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

  public async getTriggeredWatchers(percentage: number) {
    const all = await this.db.select().from(schema.watchers);
    return all.filter((w) => {
      const currentStep = Math.floor(percentage / w.interval);
      return currentStep > w.lastNotifiedStep && currentStep >= 1;
    });
  }

  public async setTrackingMessageId(id: number, messageId: string) {
    const [row] = await this.db
      .update(schema.watchers)
      .set({ trackingMessageId: messageId })
      .where(eq(schema.watchers.id, id))
      .returning();
    return row;
  }

  public async markWatcherNotified(id: number, percentage: number) {
    const interval = (
      await this.db.query.watchers.findFirst({
        where: eq(schema.watchers.id, id),
      })
    )?.interval;
    if (!interval) return undefined;

    const currentStep = Math.floor(percentage / interval);

    const [row] = await this.db
      .update(schema.watchers)
      .set({ lastNotifiedStep: currentStep })
      .where(eq(schema.watchers.id, id))
      .returning();
    return row;
  }

  public async getProjectByRepository(repository: string) {
    return await this.db.query.projects.findFirst({
      where: sql`LOWER(${schema.projects.repository}) = ${repository.toLowerCase()}`,
    });
  }
}
