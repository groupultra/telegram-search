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

## Local daemon (Linux and macOS)

The daemon keeps one Telegram connection and one local database writer for a profile. Start it before logging in when you want new messages to arrive without repeatedly running remote reads:

```bash
tg-search --profile work daemon run
# In a second terminal:
tg-search --profile work auth login
tg-search --profile work daemon status
```

`daemon run` is intentionally foreground-only in this first version. Run it under Docker, a `systemd --user` unit on Linux, or a `launchd` LaunchAgent on macOS when it should survive terminal closure. The daemon listens on a profile-scoped Unix socket under a user-only temporary directory; it holds an exclusive profile lock, so other CLI commands automatically use the daemon instead of opening a second Telegram/PGlite runtime.

As with the server, realtime persistence receives all new, edited, and deleted messages after login. Bulk history remains a separate `sync --takeout` action and still requires explicit Takeout approval.

The daemon writes structured operational records at `info` level to its supervisor's stdout/stderr. For a `launchd` or `systemd` setup, direct these streams to `<profile-root>/daemon.stdout.log` and `<profile-root>/daemon.stderr.log`. The daemon checks them every six hours, rotates the prior day's file, and deletes archives older than 14 days; set `TG_SEARCH_DAEMON_LOG_RETENTION_DAYS` to override the retention period.

After a Telegram transport disconnect, `daemon status` reports `reconnecting`. Once the transport is restored, the daemon recovers both account updates (`updates.GetDifference`) and per-channel gaps (`updates.GetChannelDifference`) before returning to `ready`. Recovered messages, edits, and deletions are persisted before their `pts` checkpoints advance. If Telegram reports a gap that is too large for either difference API, the daemon preserves the old checkpoint and reports `error`; run an explicit full sync before restarting catch-up.

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

If Telegram returns `TAKEOUT_INIT_DELAY_*`, the CLI emits `TAKEOUT_AUTHORIZATION_REQUIRED` with `details.action: "authorize_takeout_in_telegram"`. An Agent must stop, ask the user to review and authorize the pending data export request on one of their Telegram devices, and rerun `sync --takeout` only after the user confirms and Telegram allows it. This is distinct from the user's initial approval for the CLI to add `--takeout`; it is a Telegram-side security confirmation and is never retried automatically.

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

Reply records keep `replyToId` and also embed a one-level `replyTo` message snapshot so an Agent can read the referenced sender, timestamp, text, forward, media, and link metadata without joining the archive. The snapshot is resolved from the local database even when the target falls outside the selected `--from`/`--to` range. It is `null` when the target is not available locally, and reply chains are not recursively expanded. This reply-aware output is manifest schema version `2`.

The CLI performs no AI analysis. An Agent can read the JSONL files and produce a monthly or annual summary separately.

## Privacy boundary

- Remote `chats list` and `messages list` read Telegram without persisting message domain data.
- Only `sync --takeout` persists messages, and the Agent may add `--takeout` only after explicit user approval.
- Declined consent or Takeout initialization failure stops the sync; it never falls back to ordinary `GetHistory` bulk reads.
- Takeout requests only the selected chat category and does not request contacts or files for text sync.
- Local query, search, context, stats, and export do not create a Telegram connection.
- Media references and metadata may be stored; media binaries are not downloaded by these CLI commands.
