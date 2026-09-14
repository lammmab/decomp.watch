import { Database } from "bun:sqlite";

import { eq, desc, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "./schemas";

export class DecompDatabase {
  public readonly db;

  public constructor(path: string = ":memory:") {
    const sqlite = new Database(path, { create: true });
    this.db = drizzle<typeof schema>({
      client: sqlite,
      schema,
    });

    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA foreign_keys = ON;");
  }

  public close() {
    this.db.$client.close();
  }

  // == Status Messages ==
  public async addStatusMessage(message: string, id: string): Promise<boolean> {
    const result = await this.db
      .insert(schema.statusMessages)
      .values({ id, message })
      .onConflictDoNothing({
        target: schema.statusMessages.id,
      })
      .returning();
    return result.length > 0;
  }

  public async removeStatusMessage(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.statusMessages)
      .where(eq(schema.statusMessages.id, id))
      .returning({
        id: schema.statusMessages.id,
      });
    return result.length > 0;
  }

  public async getStatusMessages(): Promise<{ id: string; message: string }[]> {
    return await this.db
      .select({
        id: schema.statusMessages.id,
        message: schema.statusMessages.message,
      })
      .from(schema.statusMessages);
  }
}
