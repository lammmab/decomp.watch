import { DecompDatabase } from "@db/database";

type WatcherInsert = Parameters<DecompDatabase["addWatcher"]>[0];

export class WatcherService {
  private database: DecompDatabase;

  constructor(database: DecompDatabase) {
    this.database = database;
  }

  public async register(watcher: WatcherInsert) {
    return await this.database.addWatcher(watcher);
  }

  public async unregister(id: number) {
    return await this.database.removeWatcher(id);
  }

  public async listForChannel(guildId: string, channelId: string) {
    return await this.database.getWatchersForChannel(guildId, channelId);
  }
}
