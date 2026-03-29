# Embed Integration Guide

This guide explains how to embed the Web3 Shoutbox widget on any website. The shoutbox runs entirely in the browser — no backend required from the embedding site.

## Table of Contents

- [Basic Usage](#basic-usage)
- [URL Parameters](#url-parameters)
- [PostMessage API Reference](#postmessage-api-reference)
- [JavaScript Integration Examples](#javascript-integration-examples)
- [Responsive Embedding](#responsive-embedding)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)

---

## Basic Usage

Add this iframe to your website:

```html
<iframe
  id="shoutbox"
  src="https://your-shoutbox-domain.com/embed/shoutbox"
  width="400"
  height="600"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"
  allow="clipboard-write">
</iframe>
```

By default, the widget uses the parent page's URL (via `document.referrer`) as the chat room identifier. Everyone on the same page sees the same chat.

### With Custom Parameters

```html
<iframe
  id="shoutbox"
  src="https://your-shoutbox-domain.com/embed/shoutbox?room=my-custom-room&theme=dark&compact=true&showPresence=true&maxHeight=500"
  width="350"
  height="500"
  frameborder="0"
  allow="clipboard-write">
</iframe>
```

### Iframe Permissions

```html
allow="clipboard-write"
```

| Permission | Purpose | Required? |
|------------|---------|-----------|
| `clipboard-write` | Copy wallet addresses and messages | Recommended |

The shoutbox is text-only — no `camera`, `microphone`, or `display-capture` permissions are needed.

---

## URL Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `room` | `string` | Parent page URL | Custom room identifier. Overrides auto-detected URL. Use for site-wide rooms or topic channels. |
| `theme` | `"light" \| "dark"` | `"light"` | UI color theme |
| `compact` | `"true" \| "false"` | `"false"` | Compact mode for narrow containers |
| `showPresence` | `"true" \| "false"` | `"true"` | Show/hide the online users bar |
| `maxHeight` | `number` | `600` | Maximum widget height in pixels |

### Room Identification

When no `room` parameter is provided:

1. **In embed mode:** The widget reads `document.referrer` to get the parent page URL
2. The URL is normalized (strip query params, hash, trailing slash, lowercase host)
3. The normalized URL is SHA-256 hashed to produce the room key

This means the same page always maps to the same room, regardless of query parameters or hash fragments.

**Custom room examples:**
```html
<!-- Site-wide chat (same room on every page) -->
<iframe src="https://shoutbox.example.com/embed/shoutbox?room=general"></iframe>

<!-- Topic-specific rooms -->
<iframe src="https://shoutbox.example.com/embed/shoutbox?room=announcements"></iframe>
<iframe src="https://shoutbox.example.com/embed/shoutbox?room=support"></iframe>
```

---

## PostMessage API Reference

The widget communicates with the parent window via `postMessage`. All messages use this envelope:

```typescript
interface ShoutboxPostMessage {
  source: 'web3-shoutbox'    // Constant — use to filter messages
  type: string                // Event or command type
  payload?: unknown           // Type-specific data
}
```

### Events Emitted by the Widget (iframe → parent)

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `{ room: string \| null }` | Widget loaded and ready. Fired once on initialization. |
| `wallet-connected` | `{ address: string, inboxId: string }` | User connected wallet and initialized XMTP. |
| `wallet-disconnected` | — | User disconnected their wallet. |
| `message-sent` | `{ messageId: string }` | User sent a message. No content included (privacy). |
| `message-received` | `{ count: number }` | New messages received. Count only, no content. |
| `presence-updated` | `{ onlineCount: number }` | Online user count changed. |
| `error` | `{ message: string, code: string }` | An error occurred in the widget. |
| `resize` | `{ height: number }` | Widget content height changed. Use to adjust iframe size. |
| `status-response` | `{ isConnected: boolean, address: string \| null, onlineCount: number, xmtpStatus: string }` | Response to a `get-status` command. |

**Privacy principle:** The PostMessage API **never** sends message content to the parent. Messages are E2E encrypted via XMTP and stay within the group. Only metadata (counts, IDs) crosses the iframe boundary.

### Commands Accepted by the Widget (parent → iframe)

Commands use a different source identifier:

```typescript
{
  source: 'web3-shoutbox-parent',  // Note: different from events
  type: string,
  payload?: unknown
}
```

| Command | Payload | Description |
|---------|---------|-------------|
| `set-room` | `{ room: string }` | Change the active room. Useful for SPA navigation. |
| `set-theme` | `{ theme: "light" \| "dark" }` | Change the theme dynamically. |
| `get-status` | — | Request current status. Widget responds with `status-response` event. |

---

## JavaScript Integration Examples

### Listening for Events

```javascript
window.addEventListener('message', (event) => {
  // Validate origin in production
  if (event.origin !== 'https://your-shoutbox-domain.com') return;

  // Filter for shoutbox messages
  if (event.data?.source !== 'web3-shoutbox') return;

  switch (event.data.type) {
    case 'ready':
      console.log('Shoutbox ready for room:', event.data.payload.room);
      break;

    case 'wallet-connected':
      console.log('User connected:', event.data.payload.address);
      break;

    case 'wallet-disconnected':
      console.log('User disconnected');
      break;

    case 'presence-updated':
      // Update a badge showing online count
      document.getElementById('online-badge').textContent =
        `${event.data.payload.onlineCount} online`;
      break;

    case 'message-received':
      console.log('Messages in room:', event.data.payload.count);
      break;

    case 'error':
      console.error('Shoutbox error:', event.data.payload.message,
        `(${event.data.payload.code})`);
      break;

    case 'resize':
      // Auto-adjust iframe height to match content
      document.getElementById('shoutbox').style.height =
        `${event.data.payload.height}px`;
      break;
  }
});
```

### Sending Commands

```javascript
const iframe = document.getElementById('shoutbox');

// Change room (e.g., on SPA navigation)
iframe.contentWindow.postMessage({
  source: 'web3-shoutbox-parent',
  type: 'set-room',
  payload: { room: window.location.pathname }
}, 'https://your-shoutbox-domain.com');

// Switch to dark theme
iframe.contentWindow.postMessage({
  source: 'web3-shoutbox-parent',
  type: 'set-theme',
  payload: { theme: 'dark' }
}, 'https://your-shoutbox-domain.com');

// Request current status
iframe.contentWindow.postMessage({
  source: 'web3-shoutbox-parent',
  type: 'get-status'
}, 'https://your-shoutbox-domain.com');
```

### SPA Integration (React Example)

```jsx
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

function ShoutboxWidget() {
  const iframeRef = useRef(null);
  const location = useLocation();

  // Update room on route change
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({
      source: 'web3-shoutbox-parent',
      type: 'set-room',
      payload: { room: location.pathname }
    }, 'https://your-shoutbox-domain.com');
  }, [location.pathname]);

  return (
    <iframe
      ref={iframeRef}
      src="https://your-shoutbox-domain.com/embed/shoutbox"
      width="400"
      height="600"
      frameBorder="0"
      allow="clipboard-write"
    />
  );
}
```

---

## Responsive Embedding

### Size Recommendations

| Layout | Min Width | Recommended Width | Min Height |
|--------|-----------|-------------------|------------|
| Standard | 320px | 400px | 500px |
| Compact | 280px | 350px | 400px |
| Full-width | 100% | — | 600px |

### Auto-Resize

The widget emits `resize` events when its content height changes. Use this to dynamically adjust the iframe:

```html
<iframe
  id="shoutbox"
  src="https://your-shoutbox-domain.com/embed/shoutbox"
  width="100%"
  style="border: none; min-height: 400px;"
  allow="clipboard-write">
</iframe>

<script>
window.addEventListener('message', (event) => {
  if (event.data?.source !== 'web3-shoutbox') return;
  if (event.data.type === 'resize') {
    document.getElementById('shoutbox').style.height =
      `${event.data.payload.height}px`;
  }
});
</script>
```

### Responsive Container

```html
<div style="width: 100%; max-width: 500px; margin: 0 auto;">
  <iframe
    id="shoutbox"
    src="https://your-shoutbox-domain.com/embed/shoutbox?compact=true"
    width="100%"
    height="500"
    frameborder="0"
    allow="clipboard-write">
  </iframe>
</div>

<style>
@media (max-width: 768px) {
  #shoutbox { height: 400px; }
}
</style>
```

---

## Security Considerations

### Origin Validation

In production, always validate the origin of incoming PostMessage events:

```javascript
const ALLOWED_ORIGINS = ['https://your-shoutbox-domain.com'];

window.addEventListener('message', (event) => {
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;
  if (event.data?.source !== 'web3-shoutbox') return;
  // Handle message...
});
```

The widget also validates incoming command origins. In production, configure `VITE_ALLOWED_PARENT_ORIGINS` to restrict which sites can send commands.

### Content Security Policy

**Host site** (the page embedding the iframe):

```http
Content-Security-Policy: frame-src https://your-shoutbox-domain.com;
```

**Shoutbox app** (already configured in `public/_headers`):

```http
Content-Security-Policy: frame-ancestors *;
```

To restrict which sites can embed the widget, replace `*` with specific origins.

### HTTPS

Both the parent page and the shoutbox must use HTTPS in production. Wallet connections and XMTP require a secure context.

### What Crosses the Iframe Boundary

| Data | Shared? | Notes |
|------|---------|-------|
| Message content | ❌ Never | E2E encrypted, stays in XMTP |
| Wallet private keys | ❌ Never | Never leave the wallet |
| XMTP installation keys | ❌ Never | Managed by SDK |
| Wallet address | ✅ On connect | Via `wallet-connected` event |
| Online user count | ✅ On change | Via `presence-updated` event |
| Message count | ✅ On receive | Via `message-received` event |
| Room name | ✅ On ready | Via `ready` event |

---

## Troubleshooting

### Widget Not Loading

1. Check browser console for errors
2. Verify the iframe `src` URL is correct and accessible
3. Ensure HTTPS is used in production
4. Check for CSP headers blocking the iframe (`frame-src` directive)

### Wallet Connection Issues

1. Ensure the user has a Web3 wallet browser extension installed
2. Check that the WalletConnect Project ID is configured correctly
3. Try connecting directly at the shoutbox URL (not in iframe) to isolate issues

### Buffer / WASM Errors

The XMTP SDK uses WebAssembly. If you see `Buffer is not defined` or WASM-related errors:

1. The shoutbox's Vite config already polyfills `Buffer` and `global` — this should work out of the box
2. If embedding in a site with its own bundler, ensure `buffer` is available globally
3. Some browsers in private/incognito mode may restrict OPFS/IndexedDB access needed by XMTP

### Messages Not Appearing

1. Verify both users are connected to the same room (check the `ready` event payload)
2. The XMTP environment (`dev` vs `production`) must match across all participants
3. First-time XMTP users need to sign a wallet registration — check for pending signature prompts

### PostMessage Events Not Received

1. Verify you're filtering for `source: 'web3-shoutbox'` (not `'web3-shoutbox-parent'`)
2. Check that origin validation isn't blocking events
3. Use the built-in test page at `/test-embed.html` to debug PostMessage communication

### Test Embed Page

The shoutbox includes a test page at `public/test-embed.html` that:

- Embeds the shoutbox iframe with configurable parameters
- Logs all PostMessage events in a console panel
- Provides controls to send commands to the iframe
- Tests different themes and compact modes

Access it at `http://localhost:3000/test-embed.html` during development.
