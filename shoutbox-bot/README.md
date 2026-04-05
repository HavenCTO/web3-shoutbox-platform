# Shoutbox room bot

Node worker that joins a [Web3 Shoutbox](https://shoutbox.orbiter.website/) room using the same **GunDB** presence and **XMTP group** model as the browser app.

## What it does

- **Presence:** Heartbeats Gun so sliding-window leaders can add the bot wallet to new XMTP groups.
- **Chat:** Subscribes to the room’s active `groupId` in Gun, streams XMTP messages, and posts replies into that group.
- **Replies:** With OpenAI-compatible env vars set, replies use **chat completions** (e.g. LM Studio). Otherwise they use the echo helper in `src/reply.ts` (`formatShoutboxReply`).

## Setup

1. Copy `env.example` to `.env` next to this package.
2. Set at least **`SHOUTBOX_ROOM_URL`**, **`SHOUTBOX_BOT_PRIVATE_KEY`**, and **`SHOUTBOX_XMTP_ENV`**.  
   **`SHOUTBOX_XMTP_ENV` must match the web app** (`VITE_XMTP_ENV` in the parent project — e.g. `dev` or `production`).
3. Use a **dedicated** bot wallet; treat `.env` like a secret (`shoutbox-bot/.env` is gitignored at repo root).

```bash
npm install
npm start
```

### Room URL and logs

The bot hashes the room URL the same way as the UI. On startup it logs the **full room key** and the **short `#` label** from the shoutbox header so you can confirm it matches your browser session.

### LLM (optional, OpenAI-compatible)

For a local server such as **LM Studio**, set in `.env`:

- `SHOUTBOX_OPENAI_BASE_URL` — must end with `/v1` (e.g. `http://127.0.0.1:1234/v1`).
- `SHOUTBOX_OPENAI_MODEL` — must match the loaded model id (check `GET …/v1/models` if unsure).
- `SHOUTBOX_OPENAI_API_KEY` — optional; LM Studio often works with `lm-studio`.

See `env.example` for `SHOUTBOX_OPENAI_SYSTEM_PROMPT` and context limits.

### Windows and Gun

On Windows, Gun’s disk backend under the repo could raise **`EPERM` on `rename`**. The bot **starts with cwd under the OS temp directory** and an **in-memory Gun store**; **`RAD`** stays off by default (`env.example`). **AXE and multicast match Gun’s normal Node defaults** so presence and groups can sync through the same public peers as the browser—disabling them hid the bot from other clients.

If **`SHOUTBOX_BOT_DB_PATH`** is **relative**, it is resolved from that temp cwd; use an **absolute** path to keep the SQLite file beside the project.

### Troubleshooting (presence / replies)

The XMTP group is created with the **wallet addresses seen online in Gun** at creation time. If the bot never appears beside human users, its presence is not reaching the relays—check **`SHOUTBOX_GUN_RELAY_PEERS`** matches **`VITE_GUN_RELAY_PEERS`**, watch the console for **`Gun presence put error`**, and confirm the **bot wallet** from startup logs shows as an extra “online” row. If the session started **before** the bot was visible, wait for the **sliding window** to roll (default five minutes in the web app) or refresh after the bot shows online so a new group includes it.

## Scripts

| Command     | Description                                |
| ----------- | ------------------------------------------ |
| `npm start` | Run the bot (`tsx src/main.ts`)           |
| `npm test`  | Vitest with coverage on all library code |

## References

- Parent app architecture: `../docs/ARCHITECTURE.md`
- URL → room key rules match `../src/lib/url-utils.ts`
