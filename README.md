# Web3 Shoutbox

[![XMTP](https://img.shields.io/badge/XMTP-Messaging-blue)](https://xmtp.org)
[![GunDB](https://img.shields.io/badge/GunDB-Presence-green)](https://gun.eco)
[![Vite](https://img.shields.io/badge/Vite-7.x-purple)](https://vite.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A decentralized, embeddable shoutbox widget powered by **XMTP** for end-to-end encrypted messaging and **GunDB** for real-time presence. No backend server required — the entire system runs in the browser.

![Web3 Shoutbox Screenshot](./docs/screenshots/shoutbox-preview.png)

## What is this?

Web3 Shoutbox is a real-time chat widget that any website can embed via an `<iframe>`. Identity is anchored to crypto wallets, all messages are end-to-end encrypted via XMTP's MLS protocol, and presence (who is online) is tracked peer-to-peer through GunDB. Zero server infrastructure required — just static hosting.

## Features

- 🔐 **End-to-end encryption** — MLS protocol (RFC 9420) via XMTP, mandatory on all messages
- 👛 **Wallet-based identity** — connect with MetaMask, Rainbow, Coinbase, or any WalletConnect wallet
- 👥 **Real-time presence** — see who is online via GunDB CRDT-based peer-to-peer sync
- 📦 **Embeddable widget** — drop an `<iframe>` on any website with a single line of HTML
- 🔄 **Sliding window groups** — XMTP groups rotate on a schedule, naturally resetting member counts
- 🏗️ **No backend** — fully JAMstack, deploy to any static host
- 🗳️ **Deterministic leader election** — client-side, coordination-free group creation
- 🌙 **Dark mode** — full light/dark theme support
- 📱 **Mobile responsive** — works down to 280px width
- 🔔 **Toast notifications** — real-time feedback for connections, errors, and transitions

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd web3-shoutbox-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local — you need a WalletConnect Project ID at minimum
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Embed the Widget

Add this to any website to embed the shoutbox:

```html
<iframe
  src="https://your-shoutbox-domain.com/embed/shoutbox"
  width="400"
  height="600"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"
  allow="clipboard-write">
</iframe>
```

The widget auto-detects the parent page URL as the chat room. Pass `?room=my-room&theme=dark` for customization.

👉 **[Full Embed Guide →](./docs/EMBED_GUIDE.md)**

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Vite](https://vite.dev) | 7.x | Build tool & dev server |
| [React](https://react.dev) | 19.x | UI library |
| [TypeScript](https://typescriptlang.org) | 5.x | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4.x | Styling |
| [XMTP browser-sdk](https://xmtp.org) | 7.x | E2E encrypted messaging (MLS) |
| [GunDB](https://gun.eco) | 0.2020.x | CRDT-based real-time presence |
| [wagmi](https://wagmi.sh) | 3.x | Ethereum React hooks |
| [viem](https://viem.sh) | 2.x | Ethereum library |
| [@reown/appkit](https://reown.com/appkit) | 1.x | Wallet connection (WalletConnect) |
| [Zustand](https://github.com/pmndrs/zustand) | 5.x | State management |
| [Zod](https://zod.dev) | 4.x | Runtime validation |
| [Sonner](https://sonner.emilkowal.ski) | 2.x | Toast notifications |

## Architecture Overview

The shoutbox is a **dual-protocol, browser-only system**:

- **XMTP** handles encrypted message transport — messages are signed with wallet keys and encrypted via MLS
- **GunDB** handles ephemeral presence — who is currently on the page, tracked via heartbeat TTL

These layers are intentionally decoupled. GunDB owns the UI roster; XMTP owns message delivery. Presence changes do not trigger XMTP group mutations.

Groups use a **sliding window model** — instead of one permanent group per URL, groups rotate on a time-based schedule (default: 5 minutes). This avoids the 250-member cap and eliminates expensive `removeMembers` MLS operations.

👉 **[Full Architecture Doc →](./docs/ARCHITECTURE.md)**

## Project Structure

```
web3-shoutbox-platform/
├── src/
│   ├── components/
│   │   ├── auth/              # ConnectWallet button
│   │   ├── chat/              # ChatContainer, MessageList, MessageBubble, MessageInput
│   │   ├── layout/            # AppLayout, Header
│   │   ├── presence/          # PresencePanel, UserAvatar
│   │   ├── providers/         # Web3Provider, XmtpProvider, GunProvider, ThemeProvider
│   │   ├── ui/                # Skeleton, XmtpStepIndicator
│   │   └── ErrorBoundary.tsx  # Top-level error boundary
│   ├── config/
│   │   └── env.ts             # Zod-validated environment variables
│   ├── hooks/
│   │   ├── useEmbed.ts        # Embed detection, PostMessage API, auto-resize
│   │   ├── useGroupLifecycle.ts # Window management, leader election orchestration
│   │   ├── useLeaderElection.ts # Deterministic leader computation
│   │   ├── useOnlineUsers.ts  # Presence subscription → OnlineUser[]
│   │   ├── usePresence.ts     # Join/leave room, heartbeat lifecycle
│   │   ├── useShoutboxRoom.ts # Unified room hook (presence + messaging + groups)
│   │   ├── useXmtpClient.ts   # XMTP client state from provider
│   │   └── useXmtpConversation.ts # Group message send/receive
│   ├── lib/
│   │   ├── embed-messaging.ts # PostMessage protocol, auto-resize, config parsing
│   │   ├── group-lifecycle.ts # GunDB group read/write/subscribe
│   │   ├── gun.ts             # GunDB singleton instance
│   │   ├── gun-presence.ts    # Low-level presence read/write
│   │   ├── leader-election.ts # Deterministic leader election algorithm
│   │   ├── retry.ts           # Generic retry with exponential backoff
│   │   ├── url-utils.ts       # URL normalization + SHA-256 room keys
│   │   ├── utils.ts           # Tailwind cn() helper
│   │   └── xmtp.ts            # XMTP client factory
│   ├── pages/
│   │   ├── embed/
│   │   │   └── EmbedShoutboxPage.tsx  # Compact embed widget page
│   │   ├── NotFoundPage.tsx
│   │   ├── RoomBrowserPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── ShoutboxPage.tsx   # Main standalone shoutbox page
│   ├── services/
│   │   ├── groupLifecycleService.ts  # Group creation, discovery, failover
│   │   ├── messagingService.ts       # XMTP send/receive with retry
│   │   └── presenceService.ts        # GunDB presence join/leave/heartbeat
│   ├── stores/
│   │   ├── authStore.ts       # Wallet connection state
│   │   ├── chatStore.ts       # Messages and chat UI state
│   │   └── presenceStore.ts   # Online users state
│   ├── types/
│   │   ├── embed.ts           # PostMessage event/command types
│   │   ├── errors.ts          # Typed error classes + error classifiers
│   │   ├── group.ts           # GroupWindow, GroupState
│   │   ├── gun.d.ts           # GunDB type declarations
│   │   ├── message.ts         # ShoutboxMessage
│   │   ├── presence.ts        # PresenceRecord, OnlineUser
│   │   └── result.ts          # Result<T, E> pattern (ok/err)
│   ├── App.tsx                # Router + provider tree
│   ├── globals.css            # Tailwind base + custom animations
│   └── main.tsx               # Entry point
├── public/
│   ├── test-embed.html        # Interactive embed test page
│   ├── _headers               # CDN headers for iframe embedding
│   └── _redirects              # SPA fallback redirects
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   ├── EMBED_GUIDE.md
│   └── SETUP.md
├── e2e/                       # Playwright E2E test directory
├── .env.local.example         # Environment variable template
├── eslint.config.mjs          # ESLint configuration
├── index.html                 # Vite entry HTML
├── package.json               # Dependencies & scripts
├── playwright.config.ts       # Playwright configuration
├── postcss.config.mjs         # PostCSS (Tailwind)
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
└── vitest.config.ts           # Vitest configuration
```

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Type-check and build for production (output: `out/`) |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |

## Environment Variables

Create a `.env.local` file from the template:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | — | WalletConnect Project ID from [Reown Dashboard](https://dashboard.reown.com) |
| `VITE_XMTP_ENV` | Yes | — | XMTP network environment: `dev` or `production` |
| `VITE_APP_URL` | Yes | — | Application base URL (e.g., `http://localhost:3000`) |
| `VITE_GUN_RELAY_PEERS` | No | Public relays | Comma-separated GunDB relay peer URLs |
| `VITE_SLIDING_WINDOW_MINUTES` | No | `5` | Duration of each sliding window epoch in minutes |

## Deployment

The shoutbox is a static site — build it and deploy the `out/` directory to any static host.

```bash
npm run build
```

### Vercel

```bash
npx vercel --prod
```

Set the build output directory to `out` and add environment variables in the Vercel dashboard.

### Netlify

The `public/_redirects` file handles SPA routing automatically. Deploy via:

```bash
npx netlify deploy --prod --dir=out
```

### Cloudflare Pages

The `public/_headers` file configures iframe embedding headers. Connect your repository in the Cloudflare Pages dashboard with:

- Build command: `npm run build`
- Build output directory: `out`

## Documentation

- **[Architecture](./docs/ARCHITECTURE.md)** — System design, data flow, and key decisions
- **[Embed Guide](./docs/EMBED_GUIDE.md)** — Third-party integration guide with PostMessage API
- **[Setup Guide](./docs/SETUP.md)** — Detailed environment setup and troubleshooting
- **[Contributing](./docs/CONTRIBUTING.md)** — Code style, workflow, and PR guidelines

## License

MIT License — see [LICENSE](./LICENSE) for details.
