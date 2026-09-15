# decomp.watch

A tiny Discord bot wrapping decomp.dev

## Architecture

Library structure built [here](<https://tree.nathanfriend.com/?s=(%27options!(%27fancy!true~fullPath!false~trailingSlash!true~rootDot!false)~5(%275%27src0core*api6decomp6sync467-s4vice20util*embed6help4s20routing*rout46commands%2F*events%2F0db*database6schemas*3projects637s2%27)~v4sion!%271%27)*030%5Cn32.ts3%20%204er5source!62*7watch4%017654320*>)

```
src/
├── core/
│   ├── api.ts              ← decomp.dev API wrapper
│   ├── decomp.ts           ← coordinator class, wraps all logic
│   ├── syncer.ts           ← synchronization logic, updates watchers
│   └── watcher-service.ts  ← thin façade over the watcher database schema
├── util/
│   ├── embed.ts            ← embed helpers for milestones and projects
│   └── helpers.ts          ← miscellaneous helpers
├── routing/
│   ├── router.ts
│   ├── commands/           ← registered /decomp commands
│   └── events/             ← interaction creation
└── db/
    ├── database.ts         ← database class wrapping the schemas
    └── schemas/
        ├── projects.ts     ← stores information about decomp.dev projects
        └── watchers.ts     ← stores information about registered watchers
```

## Dependencies

- [Bun](https://bun.sh) v1.4+
- [Node.js](https://nodejs.org) (with `npx`)
- A Discord bot application/token (see [Discord Developer Portal](https://discord.com/developers/applications))

## Usage

> [!IMPORTANT]
> Make sure to create a `.env` file filling out information from `.env.example`!

1. Grab the dependencies

```bash
bun install
```

2. Generate the migration

```bash
npx drizzle-kit generate
```

3. Run the server:

```bash
bun run start
```
