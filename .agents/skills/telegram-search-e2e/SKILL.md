---
name: telegram-search-e2e
description: Run and assess a real Telegram Search CLI end-to-end canary using an authorized local Telegram profile. Use when validating real login/session connectivity, remote chat and message reads, explicit PGlite sync, local query/search/context/stats, or deterministic JSONL export. Never count mocks, offline smoke tests, or in-process handlers as E2E.
---

# Telegram Search E2E

Run the canary against the current checkout and preserve machine-readable evidence. Treat Telegram reads and local PGlite writes as real side effects; never send messages or modify Telegram data.

## Proof standard

Call a run **passed** only when one authorized profile completes all of these stages against Telegram and the local database:

1. List remote chats.
2. Read at least one real remote message from a selected chat.
3. Explicitly sync that bounded chat/time range into its local profile database.
4. Query the synced message locally.
5. Retrieve local context around that message.
6. Search locally using text derived from a synced message.
7. Produce non-zero local statistics.
8. Export the bounded data and verify the manifest count and files.

Report **blocked**, not failed, when credentials, an authorized StringSession, or a chat containing messages in the chosen range is unavailable. Report **failed** when an attempted stage violates its contract or returns inconsistent evidence.

## Workflow

1. Work from the repository checkout containing the CLI change.
2. Build `@tg-search/cli` if `packages/cli/dist/index.mjs` is absent or stale.
3. List profiles without exposing their config or session contents:

   ```bash
   pnpm cli profile list
   ```

4. Discover chats for the selected profile:

   ```bash
   node .agents/skills/telegram-search-e2e/scripts/run-canary.mjs \
     --profile <profile> --discover
   ```

5. Read the generated `chats.stdout.json` locally. Select a chat with a recent `lastMessageAt`; do not assume the first chat is appropriate. Choose the smallest practical time range that should contain at least one message.
6. Run the bounded canary:

   ```bash
   node .agents/skills/telegram-search-e2e/scripts/run-canary.mjs \
     --profile <profile> \
     --chat <chat-id> \
     --from <ISO-date-or-unix-seconds> \
     --to <ISO-date-or-unix-seconds>
   ```

7. Inspect `summary.json`, not chat content, for the final report. Include the evidence directory and stage counts. Do not include Telegram credentials, session values, message text, or private chat names in the report.

## Login gate

If discovery reports missing credentials or session authorization, ask the user to perform the local interactive step:

```bash
pnpm cli --profile=<profile> profile configure --apiId <id> --apiHash <hash>
pnpm cli --profile=<profile> auth login --phone <phone>
```

Do not request the API hash, login code, 2FA password, or StringSession in chat. Resume discovery after the user confirms local login.

## Safety and evidence

- Never use `sync --all` for a canary.
- Bound sync to one chat, a selected time range, and at most 200 messages.
- Remote list commands must not persist message-domain data; only the explicit sync stage may write it.
- Keep evidence local with directory mode `0700` and file mode `0600`.
- Never upload or paste evidence files because they contain private message data.
- An empty remote range is not proof of failure; choose another bounded range or report blocked.
