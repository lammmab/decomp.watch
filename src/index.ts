import { Decomp } from "@core/decomp";
import { logger } from "@utility/log-buffer";

const decomp = new Decomp();
await decomp.start(process.env.DISCORD_TOKEN!);

process.on("SIGINT", async () => {
  decomp.stop();
  decomp.database.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  decomp.stop();
  decomp.database.close();
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
});
