# @tg-search/cli

`tg-search` is a local-first Telegram CLI designed for humans to authenticate once and for AI Agents to compose explicit retrieval commands afterward.

## Install and build

From this monorepo:

```bash
pnpm install
pnpm run build:packages
pnpm -F @tg-search/cli build
node packages/cli/dist/index.mjs --help
```

The package exposes the `tg-search` executable when installed from a registry.

## Profiles and login

Profiles isolate Telegram credentials, the StringSession, PGlite data, and exports under `~/.tg-search/profiles/<name>/`. Config and session files use mode `0600`.

```bash
tg-search --profile work profile create work
tg-search --profile work profile configure --api-id 123456 --api-hash abcdef
tg-search --profile work auth login --phone +6512345678
```

You may use `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` instead of storing API credentials in profile config. Login prompts and progress are written to stderr.

## Agent commands

Every successful command writes one JSON envelope to stdout. Diagnostics, prompts, migration logs, and streaming progress go to stderr. `--json` is accepted for compatibility but JSON is always enabled.

```bash
# Discover chats remotely. No messages are persisted.
tg-search --profile work chats list --limit 200 --json

# Read one chat remotely. No messages are persisted.
tg-search --profile work messages list --chat 123456 --from 2026-01-01 --to 2026-12-31 --json

# Explicitly persist selected chats. At least --chat or --all is required.
tg-search --profile work sync --chat 123456,789012 --from 2026-01-01 --to 2026-12-31

# Query and search only the local PGlite database. These commands do not connect to Telegram.
tg-search --profile work messages query --from 2026-01-01 --to 2026-12-31 --json
tg-search --profile work search "项目进展" --chat 123456 --json
tg-search --profile work context --chat 123456 --message 42 --before 20 --after 20 --json
tg-search --profile work stats --group-by month --from 2026-01-01 --to 2026-12-31 --json
```

## Annual export

```bash
tg-search --profile work export \
  --from 2026-01-01 \
  --to 2026-12-31 \
  --format jsonl \
  --output ./telegram-2026
```

The export contains deterministic monthly JSONL files plus `manifest.json` with per-file SHA-256 checksums. It exports text and structured forward/media/link metadata, but not media binaries, Telegram sessions, embeddings, or credentials.

The CLI performs no AI analysis. An Agent can read the JSONL files and produce a monthly or annual summary separately.

## Privacy boundary

- Remote `chats list` and `messages list` read Telegram without persisting message domain data.
- Only explicit `sync` persists messages.
- Local query, search, context, stats, and export do not create a Telegram connection.
- Media references and metadata may be stored; media binaries are not downloaded by these CLI commands.
