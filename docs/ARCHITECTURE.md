# Architecture

## System Overview

The Web3 Shoutbox is a **dual-protocol, browser-only system** with no backend server. Two decentralized protocols divide responsibilities:

| Layer | Protocol | Responsibility |
|-------|----------|---------------|
| **Presence** | GunDB | Who is currently on the page (ephemeral, real-time, CRDT-based) |
| **Messaging** | XMTP | Encrypted message transport tied to wallet identity (MLS-encrypted) |

The critical design principle: **these two layers are decoupled**. GunDB owns the UI roster. XMTP owns message delivery. Presence changes do NOT trigger XMTP group mutations.

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEB3 SHOUTBOX PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│   │  Standalone App  │    │  Embed Widget    │    │  Test Embed Page    │  │
│   │  (/)             │    │  (/embed/*)      │    │  (test-embed.html)  │  │
│   │                  │    │                  │    │                     │  │
│   │ • ShoutboxPage   │    │ • Shoutbox Chat  │    │ • PostMessage Log   │  │
│   │ • Room Browser   │    │ • Presence Bar   │    │ • Config Controls   │  │
│   │ • Settings       │    │ • Wallet Connect │    │                     │  │
│   └────────┬─────────┘    └────────┬─────────┘    └─────────────────────┘  │
│            │                       │                                        │
│            └───────────┬───────────┘                                        │
│                        │                                                    │
│                        ▼                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        SERVICE LAYER                                │   │
│   │                                                                     │   │
│   │   ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │   │
│   │   │ Presence     │  │ Messaging    │  │ Group Lifecycle         │  │   │
│   │   │ Service      │  │ Service      │  │ Service                 │  │   │
│   │   │              │  │              │  │                         │  │   │
│   │   │ GunDB join/  │  │ XMTP send/  │  │ Sliding window mgmt,   │  │   │
│   │   │ leave/sub    │  │ receive/sub  │  │ leader election,       │  │   │
│   │   │ heartbeat    │  │ retry logic  │  │ group creation          │  │   │
│   │   └──────┬───────┘  └──────┬───────┘  └────────────┬────────────┘  │   │
│   │          │                 │                        │               │   │
│   └──────────┼─────────────────┼────────────────────────┼───────────────┘   │
│              │                 │                        │                    │
│              ▼                 ▼                        ▼                    │
│   ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐   │
│   │    GunDB         │  │     XMTP         │  │    XMTP + GunDB       │   │
│   │    Relay Peers   │  │     Network      │  │    Coordinated        │   │
│   │                  │  │                  │  │                        │   │
│   │ • Public relays  │  │ • Gateway → Nodes│  │ • Group ID stored     │   │
│   │ • CRDT sync      │  │ • MLS encryption │  │   in GunDB            │   │
│   │ • Heartbeat TTL  │  │ • 60-day retain  │  │ • Leader = lowest     │   │
│   │                  │  │                  │  │   Inbox ID            │   │
│   └──────────────────┘  └──────────────────┘  └────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: User Joins a Shoutbox

```
┌──────────┐     Step 1          ┌────────────────────┐
│  User    │ ──────────────────▶ │  Connect Wallet    │
│  visits  │  Click "Connect"    │  (Reown AppKit)    │
│  page    │                     └─────────┬──────────┘
└──────────┘                               │
                                           │ wallet address
                                           ▼
                                ┌────────────────────┐
                                │  Initialize XMTP   │
                                │  Client            │
                                │                    │
                                │ • Wallet signs     │
                                │   registration     │
                                │ • Inbox ID derived │
                                │ • Installation key │
                                │   created          │
                                └─────────┬──────────┘
                                          │
                                          │ inboxId
                                          ▼
                              ┌──────────────────────┐
                              │  Write Presence to   │
                              │  GunDB               │
                              │                      │
                              │  shoutbox-v1/        │
                              │    presence/         │
                              │    {roomKey}/        │
                              │    {inboxId}         │
                              │    → { inboxId,      │
                              │        address,      │
                              │        ts, status }  │
                              └─────────┬────────────┘
                                        │
                              ┌─────────┴────────────┐
                              │                      │
                              ▼                      ▼
                   ┌─────────────────┐    ┌─────────────────────┐
                   │ Subscribe to    │    │ Look up XMTP Group  │
                   │ GunDB presence  │    │ ID from GunDB       │
                   │ for this room   │    │                     │
                   │                 │    │ shoutbox-v1/        │
                   │ Render online   │    │   groups/{roomKey}  │
                   │ user list       │    │                     │
                   └─────────────────┘    └──────────┬──────────┘
                                                     │
                                          ┌──────────┴──────────┐
                                          │ Group exists?       │
                                          └──────────┬──────────┘
                                           NO │            │ YES
                                              ▼            ▼
                                   ┌──────────────┐  ┌──────────────┐
                                   │ Am I leader? │  │ Join group   │
                                   │ (lowest      │  │ if not       │
                                   │  inboxId)    │  │ already a    │
                                   └──────┬───────┘  │ member       │
                                    YES   │          └──────────────┘
                                          ▼
                                   ┌──────────────┐
                                   │ Create XMTP  │
                                   │ group, store │
                                   │ ID in GunDB  │
                                   └──────────────┘
```

## Data Flow: Sending a Message

```
┌──────────┐     Type + Send     ┌────────────────────┐
│  User    │ ──────────────────▶ │  group.sendText()  │
│          │                     │                     │
└──────────┘                     │ • Message signed    │
                                 │   with install key  │
                                 │ • MLS encrypts      │
                                 │ • Sent to XMTP net  │
                                 └─────────┬───────────┘
                                           │
                                           ▼
                                 ┌────────────────────┐
                                 │  All group members  │
                                 │  receive via XMTP   │
                                 │  stream             │
                                 └─────────┬───────────┘
                                           │
                                           ▼
                                 ┌────────────────────┐
                                 │  UI renders message │
                                 │  in chat feed       │
                                 └─────────────────────┘
```

## Key Architectural Decisions

### 1. Presence and Group Membership Are Decoupled

GunDB tracks who is on the page (UI only). XMTP group membership is append-only — users are added when they first visit and never removed within a window.

**Why:** MLS group mutations (add/remove member) are expensive cryptographic operations that update the ratchet tree. In a shoutbox with constant join/leave churn, this would thrash the group state and hit XMTP's rate limits (3,000 writes per 5 minutes). Decoupling eliminates this entirely.

**Trade-off:** Anyone who has visited during a window can decrypt that window's messages. Acceptable for a public shoutbox.

### 2. Sliding Window Epoch Model

Instead of one permanent XMTP group per URL, groups are created in time-based windows (default: 5 minutes). When a window expires, a new group is created with only the currently-present users.

**Why:** This naturally resets the member count (XMTP cap is 250), avoids ever calling `removeMembers`, and provides built-in history segmentation appropriate for ephemeral shoutbox semantics.

**Window lifecycle:**
```
IDLE → WAITING_FOR_GROUP → ACTIVE → EXPIRING → TRANSITIONING → ACTIVE
```

See [planning/shoutbox/07-sliding-window-group-model.md](../../planning/shoutbox/07-sliding-window-group-model.md) for the full design.

### 3. No Backend Server

The entire system runs in the browser. GunDB uses public relay peers. XMTP uses its gateway network. No developer-hosted server.

**Why:** Mirrors the Web3 ethos, minimizes deployment friction (static hosting only), and keeps the widget truly composable.

### 4. URL as Room Identity

Each unique page URL maps to a shoutbox room. The canonical room key is `SHA256(normalizedURL)`.

**Why:** URLs are the most natural scoping mechanism for "a chat about this page." Hashing normalizes them to a fixed-length key safe for GunDB paths and XMTP group metadata.

**Normalization rules** (implemented in `src/lib/url-utils.ts`):
1. Parse URL
2. Keep protocol + host + pathname
3. Strip query parameters and hash fragments
4. Lowercase the host
5. Remove trailing slash
6. SHA-256 hash the result → room key

### 5. Leader Election for Group Creation

The client with the lexicographically lowest XMTP Inbox ID among the current GunDB presence set is the designated group creator for a given window.

**Why:** Deterministic, no coordination messages needed, no backend required. All clients independently agree on the leader by reading the same GunDB presence set.

**Failover:** If the leader doesn't create a group within 15 seconds, the next-lowest Inbox ID takes over.

## State Ownership

| State | Owner | Storage | Lifetime |
|-------|-------|---------|----------|
| Who is online now | GunDB | GunDB relay peers | Heartbeat TTL (~30s) |
| Current XMTP group ID for a room | GunDB | GunDB relay peers | Per-window epoch |
| Messages | XMTP | XMTP nodes | 60 days |
| Wallet ↔ Inbox ID mapping | XMTP | On-chain (L3 appchain) | Permanent |
| User's XMTP keys | XMTP SDK | Local SQLite (per-install) | Per-device |
| UI state (theme, filters) | Zustand | In-memory | Session |

## Security Model

### Layer 1: Wallet Identity

- Wallet signature required to create XMTP Inbox ID
- ECDSA on secp256k1 binds wallet to messaging identity
- No spoofing — you must own the private key to register

### Layer 2: End-to-End Encryption

- MLS (RFC 9420) — mandatory, no plaintext mode
- Forward secrecy + post-compromise security
- Per-installation Ed25519 signing keys
- AEAD encryption for message confidentiality

### Layer 3: Presence Trust

- GunDB presence is **untrusted / advisory**
- Anyone can write any Inbox ID to GunDB
- XMTP identity (wallet signature) is the ground truth
- GunDB is only used for UI hints, never for access control

### PostMessage Privacy

The iframe PostMessage API **never** sends message content to the parent window. Only metadata (counts, IDs, connection status) crosses the iframe boundary. Messages are E2E encrypted and stay within the XMTP group.

## Service Layer Architecture

The codebase follows a three-tier pattern:

```
Pages / Components (UI)
        │
        ▼
    Hooks (orchestration, React lifecycle)
        │
        ▼
    Services (business logic, error handling, retry)
        │
        ▼
    Lib (protocol-specific low-level operations)
```

| Layer | Files | Responsibility |
|-------|-------|---------------|
| **Services** | `messagingService.ts`, `presenceService.ts`, `groupLifecycleService.ts` | Business logic with `Result<T, E>` error handling and retry |
| **Lib** | `xmtp.ts`, `gun.ts`, `gun-presence.ts`, `group-lifecycle.ts`, `leader-election.ts`, `url-utils.ts` | Protocol-specific operations, no error wrapping |
| **Hooks** | `useShoutboxRoom.ts`, `useGroupLifecycle.ts`, `usePresence.ts`, `useEmbed.ts` | React lifecycle, state management, orchestration |
| **Stores** | `authStore.ts`, `chatStore.ts`, `presenceStore.ts` | Zustand global state |

All fallible service operations return `Result<T, E>` instead of throwing, using typed error classes (`MessagingError`, `PresenceError`, `GroupLifecycleError`).
