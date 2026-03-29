# Contributing

Guidelines for contributing to the Web3 Shoutbox project.

## Code Organization

```
src/
├── components/     # React UI components (presentational + container)
│   ├── auth/       # Wallet connection UI
│   ├── chat/       # Message list, bubbles, input
│   ├── layout/     # App shell, header, navigation
│   ├── presence/   # Online user panel, avatars
│   ├── providers/  # React context providers (Web3, XMTP, Gun, Theme)
│   └── ui/         # Reusable UI primitives (Skeleton, indicators)
├── config/         # Environment validation (Zod schemas)
├── hooks/          # Custom React hooks (orchestration layer)
├── lib/            # Low-level protocol operations (no React dependency)
├── pages/          # Route-level page components
├── services/       # Business logic with Result<T, E> error handling
├── stores/         # Zustand global state stores
└── types/          # TypeScript type definitions and error classes
```

### Layer Responsibilities

| Layer | Depends On | Responsibility |
|-------|-----------|---------------|
| `pages/` | hooks, components | Route-level composition |
| `components/` | hooks, stores, types | UI rendering |
| `hooks/` | services, stores, lib | React lifecycle, orchestration |
| `services/` | lib, types | Business logic, retry, error wrapping |
| `lib/` | types, config | Protocol-specific operations (XMTP, GunDB) |
| `stores/` | types | Global state (Zustand) |
| `types/` | — | Type definitions, error classes |

**Key rule:** `lib/` files must not import from `services/` or `hooks/`. `services/` must not import from `hooks/`. Dependencies flow downward only.

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Implement your changes** following the code style guidelines below

3. **Run tests and lint:**
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Commit** with a conventional commit message (see below)

5. **Create a pull request** against `main`

## Branch Naming

| Pattern | Use Case | Example |
|---------|----------|---------|
| `feat/<description>` | New features | `feat/token-gating` |
| `fix/<description>` | Bug fixes | `fix/presence-heartbeat` |
| `docs/<description>` | Documentation | `docs/embed-guide` |
| `refactor/<description>` | Code restructuring | `refactor/service-layer` |
| `test/<description>` | Test additions | `test/leader-election` |
| `s<sprint>-<description>` | Sprint work | `s8-documentation` |

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting, no logic change |
| `refactor` | Code restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build, tooling, dependency changes |

### Scopes

Use the module name: `xmtp`, `gun`, `presence`, `messaging`, `embed`, `ui`, `groups`, `auth`.

### Examples

```
feat(embed): Add auto-resize support for iframe height
fix(presence): Correct heartbeat interval drift on background tabs
docs(embed): Add SPA integration example to embed guide
refactor(services): Extract retry logic into shared utility
test(groups): Add unit tests for leader election edge cases
```

### Rules

- Use imperative mood: "add" not "added" or "adds"
- Don't end the subject line with a period
- Limit subject to 50 characters
- Capitalize the subject line

## Code Style Guidelines

### TypeScript

- **Strict mode** — `strict: true` in `tsconfig.json`
- **No `any`** — use `unknown` and narrow with type guards. The only exceptions are GunDB callback types (marked with `eslint-disable` comments)
- **Prefer `interface` over `type`** for object shapes
- **Use `Result<T, E>`** for fallible operations in services (see `src/types/result.ts`)
- **Named exports only** — no default exports

### React

- **Functional components** only
- **Hooks for logic** — keep components focused on rendering
- **Props interfaces** — define explicitly, don't use inline types

### Styling

- **Tailwind CSS** for all styling — no CSS modules or styled-components
- **`cn()` utility** for conditional classes (from `src/lib/utils.ts`)
- **Dark mode** — use `dark:` variants for all color classes
- **Responsive** — mobile-first, test down to 280px width

### Error Handling

- **Services** return `Result<T, E>` — never throw
- **Typed error classes** — `MessagingError`, `PresenceError`, `GroupLifecycleError`, `EmbedError`
- **Error classifiers** — use `isUserRejection()`, `isTransientError()`, etc. from `src/types/errors.ts`
- **Presence is best-effort** — GunDB errors are silently swallowed; messaging errors surface to the user

### Service Layer Pattern

```typescript
// ✅ Good — returns Result, uses typed error
export async function sendMessage(
  group: Group,
  text: string,
): Promise<Result<void, MessagingError>> {
  try {
    await retryWithBackoff(() => group.sendText(text), {
      maxRetries: 1,
      shouldRetry: (e) => isTransientError(e),
    });
    return ok(undefined);
  } catch (error) {
    return err(new MessagingError(error.message, 'XMTP_SEND_FAILED'));
  }
}

// ❌ Bad — throws, untyped error
export async function sendMessage(group: Group, text: string): Promise<void> {
  await group.sendText(text);
}
```

## Testing Expectations

### Unit Tests

- **Required for:** `lib/` utilities and `services/` business logic
- **Location:** `src/lib/__tests__/` and `src/services/__tests__/`
- **Framework:** Vitest with `@testing-library/react` for component tests
- **Run:** `npm run test`

### What to Test

| Module | Test Focus |
|--------|-----------|
| `lib/leader-election.ts` | Deterministic leader selection, edge cases (empty list, single user, ties) |
| `lib/url-utils.ts` | URL normalization rules, hash consistency |
| `services/groupLifecycleService.ts` | Window expiration, epoch calculation, race conditions |
| `services/messagingService.ts` | Retry behavior, error classification |
| `services/presenceService.ts` | TTL filtering, heartbeat lifecycle |

### E2E Tests

- **Location:** `e2e/`
- **Framework:** Playwright
- **Run:** `npm run test:e2e`
- **Focus:** Critical user flows (wallet connect, send message, embed loading)

## PR Review Checklist

Before requesting review, verify:

- [ ] `npm run build` passes (TypeScript + Vite build)
- [ ] `npm run test` passes (all unit tests)
- [ ] `npm run lint` passes (no ESLint errors)
- [ ] No `any` types introduced (check with `grep -r ': any' src/`)
- [ ] New services return `Result<T, E>` instead of throwing
- [ ] Dark mode works (test with `?theme=dark` in embed mode)
- [ ] Mobile responsive (test at 280px, 320px, 375px widths)
- [ ] Embed mode works (test with `public/test-embed.html`)
- [ ] No sensitive data (API keys, wallet addresses) in committed code
- [ ] Commit messages follow conventional commits format
