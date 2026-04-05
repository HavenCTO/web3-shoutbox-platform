# Sovereign Shoutbox Bot

**The first application built on the [Haven Core](https://github.com/Haven-hvn/haven-core) sovereign agent kernel.**

A self-sustaining AI bot that lives in a Web3 shoutbox chat room — with its own wallet, its own identity, its own economics, and the ability to operate autonomously without human babysitting.

---

## What It Does

The sovereign shoutbox bot:

- **Joins a shoutbox chat room** via XMTP encrypted messaging
- **Announces its presence** on GunDB so the room's sliding-window leader includes it in group creation
- **Listens for messages** from human participants
- **Reasons and responds** using a local LLM (LM Studio) — with full cost tracking through the treasury
- **Adapts its behavior** based on its financial state (treasury runway, balance, budget)
- **Persists its identity** across restarts via its Ethereum wallet — the wallet address IS the bot

It's not a chatbot. It's a **sovereign agent** — an AI that owns itself, pays for its own intelligence, and participates in the shoutbox as a first-class entity.

---

## Architecture

The bot is a **thin application** that wires the [Haven Core kernel](https://github.com/Haven-hvn/haven-core) with [Haven Adapters](https://github.com/Haven-hvn/haven-adapters) and adds shoutbox-specific logic (GunDB presence).

```
┌─────────────────────────────────────────────────────────────┐
│                    Sovereign Shoutbox Bot                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           haven-core: SovereignAgentKernel           │    │
│  │                                                      │    │
│  │  ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ │    │
│  │  │  Wallet  │ │Treasury │ │MessageBus│ │AgentLoop│ │    │
│  │  │ Identity │ │         │ │          │ │ + Tools  │ │    │
│  │  └────┬─────┘ └────┬────┘ └────┬─────┘ └────┬────┘ │    │
│  │       │             │           │              │      │    │
│  │  ┌────┴─────────────┴───────────┴──────────────┴────┐ │    │
│  │  │              Kernel Interfaces                    │ │    │
│  │  │   (CryptoAdapter, ChatChannel, LLM Provider)     │ │    │
│  │  └───────────────────────────────────────────────────┘ │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │              haven-adapters                              │    │
│  │                                                          │    │
│  │  ┌──────────────┐ ┌───────────┐ ┌──────────────────┐   │    │
│  │  │   Ethereum   │ │   XMTP    │ │   LM Studio      │   │    │
│  │  │ CryptoAdapter│ │  Channel  │ │   Provider       │   │    │
│  │  │   (viem)     │ │(@xmtp)    │ │ (@lmstudio/sdk)  │   │    │
│  │  └──────────────┘ └───────────┘ └──────────────────┘   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                             │                                   │
│  ┌──────────────────────────┴──────────────────────────────┐    │
│  │              Shoutbox-Specific Logic                     │    │
│  │                                                          │    │
│  │  ┌──────────────┐ ┌──────────────────────────────────┐  │    │
│  │  │  GunPresence │ │ System Prompt + Presence Store   │  │    │
│  │  │  (gun)       │ │ (room context, member list)      │  │    │
│  │  └──────────────┘ └──────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Message Flow

```
User message → XMTP → MessageBus → AgentLoop
  → Treasury cost-check → LLM (LM Studio)
  → AgentLoop → MessageBus → XMTP → User
```

### Key Design Principle

**The kernel never imports chain-specific or provider-specific libraries.** It defines interfaces. Adapters implement them. The application wires them together. This means:

- Swap Ethereum for Solana → just change the crypto adapter
- Swap XMTP for Telegram → just change the chat channel
- Swap LM Studio for OpenAI → just change the LLM provider
- The kernel code doesn't change

---

## Components

### Kernel (haven-core)

The [Haven Core kernel](https://github.com/Haven-hvn/haven-core) provides 5 core state machines:

| Machine | Role |
|---------|------|
| **WalletIdentity** | Cryptographic identity — signs, proves, persists |
| **Treasury** | Economic engine — tracks balances, enforces budgets, manages survival states |
| **MessageBus** | Nervous system — routes messages between channels and the agent |
| **AgentLoop** | Mind — reasons, calls tools, iterates toward answers |
| **ToolExecutor** | Hands — executes actions, gated by cost and permission |

### Adapters (haven-adapters)

The [Haven Adapters](https://github.com/Haven-hvn/haven-adapters) provide chain and provider implementations:

| Adapter | Interface | What It Does |
|---------|-----------|-------------|
| `EthereumCryptoAdapter` | `CryptoAdapter` | Ethereum wallet identity via viem |
| `XmtpChannel` | `ChatChannel` | Encrypted XMTP messaging |
| `LmStudioProvider` | LLM Provider | Local LLM inference via LM Studio |

### Shoutbox-Specific

| Module | What It Does |
|--------|-------------|
| `GunPresence.ts` | Heartbeats GunDB presence so the shoutbox leader includes the bot in XMTP group creation. Subscribes to group window changes. |
| `main.ts` | Entry point — wires kernel + adapters + presence, configures system prompt, manages lifecycle |

---

## Quick Start

### Prerequisites

- **Node.js 20+** (ESM support required)
- **LM Studio** running locally (or any OpenAI-compatible inference endpoint)
- **Ethereum wallet** with a private key (for bot identity)
- **XMTP account** (the wallet IS the XMTP identity)
- **GunDB relay peers** (for shoutbox presence)

### 1. Install Dependencies

```bash
cd sovereign-bot
npm install
```

### 2. Configure Environment

Copy `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SHOUTBOX_ROOM_URL` | URL of the shoutbox room | `https://myapp.com/rooms/abc123` |
| `SHOUTBOX_BOT_PRIVATE_KEY` | Ethereum private key (bot identity) | `0x...` |
| `SHOUTBOX_XMTP_ENV` | XMTP network | `dev`, `production`, or `local` |
| `SHOUTBOX_GUN_RELAY_PEERS` | GunDB relay URLs (comma-separated) | `https://relay1,https://relay2` |
| `SHOUTBOX_OPENAI_BASE_URL` | LM Studio (or compatible) endpoint | `http://127.0.0.1:1234` |
| `SHOUTBOX_OPENAI_MODEL` | Model to use for inference | `qwen/qwen3-4b-2507` |

Optional:

| Variable | Description | Default |
|----------|-------------|---------|
| `SHOUTBOX_BOT_DB_PATH` | XMTP database path (for persistence across restarts) | In-memory |

### 3. Start LM Studio

Make sure LM Studio is running and serving the configured model:

```
http://127.0.0.1:1234
```

### 4. Run the Bot

```bash
npm start          # Production run
npm run dev        # Watch mode (auto-restart on file changes)
```

You should see:

```
╔══════════════════════════════════════════════════════════════╗
║        SOVEREIGN SHOUTBOX BOT — Kernel + Extensions         ║
║                                                              ║
║  Kernel: WalletIdentity • Treasury • MessageBus             ║
║          ToolExecutor • AgentLoop                            ║
║  Extensions: LmStudioProvider • EthereumCrypto              ║
║              XmtpChannel • GunPresence                       ║
╚══════════════════════════════════════════════════════════════╝

[sovereign-bot] Room: https://myapp.com/rooms/abc123
[sovereign-bot] XMTP env: dev
[sovereign-bot] LLM: qwen/qwen3-4b-2507 @ http://127.0.0.1:1234
[sovereign-bot] Wallet address: 0x...
[sovereign-bot] Gun peers: https://relay1, https://relay2
[sovereign-bot] Room key: a1b2c3d4...
[sovereign-bot] Creating XMTP client...
[sovereign-bot] XMTP inbox: abc123def456...
═══════════════════════════════════════════════════════════════
  Sovereign Shoutbox Bot is RUNNING
  Wallet:    0x...
  Treasury:  Healthy (runway: 30 days)
  XMTP:      abc123def456...
  Room:      a1b2c3d4...
  LLM:       qwen/qwen3-4b-2507
═══════════════════════════════════════════════════════════════
```

---

## How It Works

### Boot Sequence

1. **Create kernel** — `SovereignAgentKernel` initializes all 5 state machines
2. **Inject Ethereum adapter** — `kernel.wallet.setCryptoAdapter()` gives the kernel an Ethereum identity
3. **Replace stub provider** — `kernel.agent.setProvider()` swaps the stub LLM for LM Studio
4. **Register tools** — Shoutbox-specific tools (e.g., `get_time`) are registered with the kernel
5. **Start kernel** — `kernel.start()` boots all state machines with the real wallet
6. **Wire XMTP** — `XmtpChannel` connects to the XMTP network and starts listening
7. **Start GunDB presence** — `GunPresence` heartbeats to the shoutbox presence system
8. **Start relay warmer** — A second Gun peer forces relay data to browser subscribers
9. **Set transform context** — System prompt is dynamically built with wallet address, treasury state, and room presence
10. **Running** — Messages flow: XMTP → MessageBus → AgentLoop → LLM → MessageBus → XMTP

### Presence System

The shoutbox uses a **sliding-window group** model:

1. The bot heartbeats its presence to GunDB every 10 seconds
2. The room's leader election picks a leader who creates an XMTP group
3. The leader includes all online members (including the bot)
4. The bot subscribes to group window changes and joins the active group
5. A **relay warmer** (second Gun peer) ensures presence data flows to browser clients

### Treasury & Economics

The kernel's treasury tracks every expense:

- **LLM inference cost** — tracked per message (stubbed in prototype, real costs coming)
- **Tool execution cost** — tracked per tool call
- **Budget categories** — separate budgets for inference, tools, and operations
- **Survival states** — `Healthy` → `Aware` → `Conserving` → `Critical` → `Dormant`

When funds are low, the agent adapts: cheaper models, deferred tasks, asking for help. When funds run out, it goes dormant — but its identity survives, waiting to be revived.

---

## Project Structure

```
sovereign-bot/
├── README.md                    ← This file
├── package.json                 ← Dependencies (haven-core, haven-adapters, viem, @xmtp/node-sdk, gun)
├── tsconfig.json                ← TypeScript config
├── .env                         ← Environment variables (not committed)
└── src/
    ├── main.ts                  ← Entry point — wires kernel + adapters + presence
    └── GunPresence.ts           ← GunDB presence heartbeat + group window subscription
```

---

## Related Repos

- **[haven-core](https://github.com/Haven-hvn/haven-core)** — The sovereign agent kernel (5 core state machines, formal spec in P)
- **[haven-adapters](https://github.com/Haven-hvn/haven-adapters)** — Chain & provider adapters (Ethereum, XMTP, LM Studio)
- **[web3-shoutbox-platform](https://github.com/HavenCTO/web3-shoutbox-platform)** — The shoutbox web app this bot connects to

---

## Development

### Adding New Tools

```typescript
kernel.registerTool(
  {
    name: "my_tool",
    description: "Does something useful",
    estimatedCost: { amounts: [], category: BudgetCategory.TOOLS },
  },
  async (args) => {
    // Tool implementation
    return "result";
  }
);
```

### Swapping Adapters

```typescript
// Instead of Ethereum:
kernel.wallet.setCryptoAdapter(createSolanaCryptoAdapter());

// Instead of LM Studio:
const openaiProvider = new OpenAIProvider(kernel.registry, "provider", {
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4",
});
kernel.agent.setProvider(openaiProvider);

// Instead of XMTP:
const telegram = new TelegramChannel(kernel.registry, kernel.bus, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
});
```

### Debugging

The kernel logs all state transitions. Set `DEBUG=haven-core:*` for verbose logging.

---

## License

Open source. The sovereign agent kernel is open source. The adapter ecosystem is permissionless. The future is autonomous.