# @tg-search/cli

`tg-search` is a local-first Telegram CLI designed for humans to authenticate once and for AI Agents to compose explicit retrieval commands afterward.

## Install and build

From this monorepo:

```bash
pnpm install
pnpm run build:packages
pnpm -F @tg-search/cli build
pnpm cli --help
```

The package exposes the `tg-search` executable when installed from a registry.

## Profiles and login

Profiles isolate Telegram credentials, the StringSession, PGlite data, and exports under the operating system's application data directory. Config and session files use mode `0600`, and `TG_SEARCH_HOME` can override the data root.

- macOS: `~/Library/Application Support/telegram-search/profiles/<name>/`
- Windows: `%LOCALAPPDATA%/telegram-search/Data/profiles/<name>/`
- Linux: `$XDG_DATA_HOME/telegram-search/profiles/<name>/`, falling back to `~/.local/share/telegram-search/profiles/<name>/`

```bash
tg-search --profile work profile create work
tg-search --profile work profile configure --apiId 123456 --apiHash abcdef
tg-search --profile work auth login --phone +6512345678
```

You may use `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` instead of storing API credentials in profile config. Login prompts and progress are written to stderr.

## Agent commands

Every command writes one JSON envelope to stdout. Successful envelopes contain `ok`, `data`, top-level `next_cursor` when pagination applies, and `meta.profile` / `meta.source`. Failed envelopes contain `ok: false` and a structured `error`; the process also exits non-zero. Diagnostics, prompts, GramJS logs, migration logs, and streaming progress go to stderr. `--json` is accepted for compatibility but JSON is always enabled.

```bash
# Discover chats remotely. No messages are persisted.
tg-search --profile work chats list --limit 200 --json

# Read one chat remotely. No messages are persisted.
tg-search --profile work messages list --chat 123456 --from 2026-01-01 --to 2026-12-31 --json

# After the user explicitly approves Telegram Takeout, persist selected chats.
# At least --chat or --all is required. Never add --takeout without that approval.
tg-search --profile work sync --takeout --chat 123456,789012 --from 2026-01-01 --to 2026-12-31

# Query and search only the local PGlite database. These commands do not connect to Telegram.
tg-search --profile work messages query --from 2026-01-01 --to 2026-12-31 --json
tg-search --profile work search "项目进展" --chat 123456 --json
tg-search --profile work context --chat 123456 --message 42 --before 20 --after 20 --json
tg-search --profile work stats --group-by month --timezone Asia/Singapore --from 2026-01-01 --to 2026-12-31 --json
```

The current CLI `search` command uses local jieba text retrieval. It does not generate query embeddings, so vector retrieval is not enabled by this command.

Remote pages may include Telegram's raw `total`, but Telegram does not guarantee that it reflects the CLI's sender and date filters. Treat it as informational rather than as an exact filtered count. Use Takeout plus local queries when exact filtered counts are required.

```bash
tg-search --profile work messages list --chat 123456 --sender me --to 2026-01-31 --limit 1
```

## Annual export

```bash
tg-search --profile work export \
  --from 2026-01-01 \
  --to 2026-12-31 \
  --timezone Asia/Singapore \
  --format jsonl \
  --output ./telegram-2026
```

The export contains deterministic monthly JSONL files plus `manifest.json` with the selected IANA time zone and per-file SHA-256 checksums. `--timezone` defaults to `UTC`; set it explicitly when local calendar months matter. The export includes text and structured forward/media/link metadata, but not media binaries, Telegram sessions, embeddings, or credentials.

The CLI performs no AI analysis. An Agent can read the JSONL files and produce a monthly or annual summary separately.

## Privacy boundary

- Remote `chats list` and `messages list` read Telegram without persisting message domain data.
- Only `sync --takeout` persists messages, and the Agent may add `--takeout` only after explicit user approval.
- Declined consent or Takeout initialization failure stops the sync; it never falls back to ordinary `GetHistory` bulk reads.
- Takeout requests only the selected chat category and does not request contacts or files for text sync.
- Local query, search, context, stats, and export do not create a Telegram connection.
- Media references and metadata may be stored; media binaries are not downloaded by these CLI commands.
