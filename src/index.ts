import "@core/logbuffer";
import { snooplogg as snoop } from "snooplogg";

import { Decomp } from "./core/decomp";

const decomp = new Decomp();
await decomp.start(process.env.DISCORD_TOKEN!);

process.on("SIGINT", async () => {
  decomp.database.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  decomp.database.close();
  process.exit(0);
});

process.on("unhandledRejection", (error) => {
  snoop.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  snoop.error("Uncaught exception:", error);
});
