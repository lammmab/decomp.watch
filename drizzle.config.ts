import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./.drizzle",
  schema: "./src/db/schemas/*",
  dialect: "sqlite",
  dbCredentials: {
    url: Bun.env.DB_FILE_NAME ?? ":memory:",
  },
});
