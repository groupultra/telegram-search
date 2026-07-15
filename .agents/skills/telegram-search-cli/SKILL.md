---
name: telegram-search-cli
description: Operate the Telegram Search CLI through an authorized local profile. Use when an agent needs to discover Telegram chats, read bounded remote messages, explicitly synchronize history with user-approved Telegram Takeout, query/search/contextualize persisted messages, compute statistics, export deterministic JSONL, or run a real CLI end-to-end canary. Never send or modify Telegram messages.
---

# Telegram Search CLI

Use the CLI as a local-first data tool. Let the agent compose atomic commands; do not require the web UI or a daemon.

## Contracts

- Treat stdout as exactly one JSON envelope. Read diagnostics, prompts, migration output, and progress from stderr.
- Use `chats list` and `messages list` for bounded remote reads without persistence.
- Use local `messages query`, `search`, `context`, `stats`, and `export` without connecting to Telegram.
- Use `sync --takeout` for message persistence and bulk history. Add `--takeout` only after the user explicitly approves the selected chats, time range, and data scope.
- Stop when consent is missing or Telegram delays/rejects Takeout. Never fall back to ordinary history reads for bulk synchronization.
- Never request or expose API hashes, login codes, 2FA passwords, StringSessions, private chat names, or message text in reports.
- Never send messages or modify Telegram data.

## Common workflow

Work from the checkout containing the CLI or use an installed `tg-search` executable. Build the workspace CLI when `packages/cli/dist/index.mjs` is absent or stale:

```bash
pnpm -F @tg-search/cli build
```

List profiles and discover chats:

```bash
pnpm cli profile list
pnpm cli --profile=<profile> chats list --limit 200
```

Read a bounded remote range without persistence:

```bash
pnpm cli --profile=<profile> messages list \
  --chat <chat-id> --from <ISO-time> --to <ISO-time> --limit 100
```

After explicit user approval, persist the approved range through Takeout:

```bash
pnpm cli --profile=<profile> sync --takeout \
  --chat <chat-id> --from <ISO-time> --to <ISO-time> --limit 100000
```

Analyze the local database:

```bash
pnpm cli --profile=<profile> messages query --chat <chat-id> --sender <user-id> --from <ISO-time> --to <ISO-time>
pnpm cli --profile=<profile> search '<query>' --chat <chat-id>
pnpm cli --profile=<profile> context --chat <chat-id> --message <message-id> --before 20 --after 20
pnpm cli --profile=<profile> stats --group-by month --timezone Asia/Singapore --chat <chat-id>
pnpm cli --profile=<profile> export --timezone Asia/Singapore --chat <chat-id> --output <directory>
```

Treat a remote `total` field as informational. Telegram does not guarantee it reflects sender and date filters; calculate exact filtered counts from the authorized local dataset.

## Login gate

If credentials or authorization are missing, ask the user to complete login locally:

```bash
pnpm cli --profile=<profile> profile configure --apiId <id> --apiHash <hash>
pnpm cli --profile=<profile> auth login --phone <phone>
```

Do not ask the user to paste authentication secrets into chat. Resume only after the user confirms login.

## Optional real E2E canary

Use the bundled canary only when validating the real CLI boundary. Mocks, offline smoke tests, and in-process handlers are not E2E.

Discover candidate chats without persistence:

```bash
node .agents/skills/telegram-search-cli/scripts/run-canary.mjs \
  --profile <profile> --discover
```

After selecting the smallest practical chat/time range and obtaining explicit Takeout approval, run:

```bash
node .agents/skills/telegram-search-cli/scripts/run-canary.mjs \
  --profile <profile> \
  --chat <chat-id> \
  --from <ISO-time> \
  --to <ISO-time> \
  --takeout
```

The canary must prove remote discovery/read, approved Takeout sync, local query/context/search/stats, and deterministic export. Inspect `summary.json` and report only stage counts and the local evidence directory. Keep evidence private with directory mode `0700` and file mode `0600`.

Report `blocked` when authorization, explicit Takeout approval, or a non-empty bounded range is unavailable. Report `failed` only when an attempted stage violates its contract or produces inconsistent evidence.
