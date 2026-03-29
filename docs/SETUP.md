# Setup Guide

Step-by-step instructions to get the Web3 Shoutbox running locally.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 20.x or higher | Check with `node --version` |
| **npm** | 10.x or higher | Comes with Node.js |
| **Web3 Wallet** | — | MetaMask, Rainbow, Coinbase Wallet, or any WalletConnect-compatible wallet |
| **WalletConnect Project ID** | — | Free from [Reown Dashboard](https://dashboard.reown.com) |

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd web3-shoutbox-platform
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```env
# Required: Get this from https://dashboard.reown.com
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here

# Required: Use "dev" for development, "production" for mainnet
VITE_XMTP_ENV=dev

# Required: Your app's base URL
VITE_APP_URL=http://localhost:3000

# Optional: Custom GunDB relay peers (comma-separated)
# Defaults to public relays if not set
VITE_GUN_RELAY_PEERS=

# Optional: Sliding window duration in minutes (default: 5)
VITE_SLIDING_WINDOW_MINUTES=5
```

#### Environment Variable Details

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | Project ID from the [Reown Dashboard](https://dashboard.reown.com). Create a free account, then create a new project to get this ID. |
| `VITE_XMTP_ENV` | Yes | XMTP network to connect to. Use `dev` for development and testing. Use `production` only when deploying to mainnet users. All participants must be on the same environment to communicate. |
| `VITE_APP_URL` | Yes | The base URL where the app is served. Used for origin validation in embed mode. Set to `http://localhost:3000` for local development. |
| `VITE_GUN_RELAY_PEERS` | No | Comma-separated list of GunDB relay peer URLs. Defaults to public relays (`https://gun-manhattan.herokuapp.com/gun,https://gun-us.herokuapp.com/gun`). For production, consider running your own relay. |
| `VITE_SLIDING_WINDOW_MINUTES` | No | How long each XMTP group window lasts before rotating. Default is 5 minutes. Increase for quieter rooms, decrease for busy ones. |

The app validates all environment variables at startup using Zod. If any required variable is missing or invalid, you'll see a descriptive error in the browser console.

### 4. Run the Development Server

```bash
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

### 5. Connect Your Wallet

1. Open the app in your browser
2. Click "Connect Wallet"
3. Select your wallet provider
4. Approve the connection
5. Sign the XMTP registration message (one-time per wallet)

After signing, you'll see the shoutbox chat interface with your wallet connected.

## Testing with Multiple Wallets

To test real-time messaging between users:

1. Open the app in two different browser profiles (or one regular + one incognito window)
2. Connect a different wallet in each
3. Both users should see each other in the presence panel
4. Messages sent by one user appear in real-time for the other

**Tip:** Use `VITE_XMTP_ENV=dev` — the dev network is free and doesn't require mainnet tokens.

## Running Tests

### Unit Tests

```bash
npm run test
```

Tests are located in `src/lib/__tests__/` and `src/services/__tests__/`. They cover:
- Leader election algorithm
- URL normalization and hashing
- Group lifecycle service logic

### E2E Tests

```bash
npm run test:e2e
```

Requires Playwright browsers to be installed:

```bash
npx playwright install
```

### Linting

```bash
npm run lint
```

## Building for Production

```bash
npm run build
```

This runs TypeScript type-checking and Vite's production build. Output goes to the `out/` directory.

To preview the production build locally:

```bash
npm run preview
```

## Troubleshooting

### `Buffer is not defined`

The XMTP SDK requires the `Buffer` polyfill. This is already configured in `vite.config.ts`:

```typescript
resolve: {
  alias: {
    buffer: 'buffer/',
  },
},
define: {
  global: 'globalThis',
},
```

If you still see this error, ensure `buffer` is in your dependencies:

```bash
npm ls buffer
```

### WASM / OPFS Errors

The XMTP browser SDK uses WebAssembly and OPFS (Origin Private File System) for local storage. Common issues:

- **Incognito/private mode:** Some browsers restrict OPFS in private browsing. Try a regular window.
- **Older browsers:** XMTP requires Chrome 90+, Firefox 88+, Safari 14+.
- **Cross-origin iframe:** OPFS may be restricted in third-party iframes on some browsers. The embed route at `/embed/shoutbox` is designed to handle this.

The `optimizeDeps` configuration in `vite.config.ts` excludes XMTP WASM bindings from pre-bundling:

```typescript
optimizeDeps: {
  exclude: ['@xmtp/wasm-bindings', '@xmtp/browser-sdk'],
  include: ['@xmtp/proto'],
},
```

### Wallet Signature Confusion

When connecting for the first time, XMTP requires a wallet signature to register your Inbox ID. This is a one-time operation per wallet. Users may see:

1. **First signature:** WalletConnect connection approval
2. **Second signature:** XMTP Inbox ID registration

If a user rejects the second signature, XMTP initialization fails. The app shows an error and allows retrying.

### GunDB Connection Issues

If presence (online users) isn't working:

1. Check that GunDB relay peers are accessible (default public relays may have downtime)
2. Try adding alternative relays in `VITE_GUN_RELAY_PEERS`
3. GunDB presence is best-effort — the app continues to work for messaging even if presence fails

### Port Already in Use

If port 3000 is occupied:

```bash
# Find what's using port 3000
lsof -i :3000

# Or change the port in vite.config.ts
server: {
  port: 3001,
}
```

### Environment Validation Errors

If you see `Environment validation failed:` in the console, check your `.env.local` file against `.env.local.example`. The error message will tell you exactly which variable is missing or invalid.
