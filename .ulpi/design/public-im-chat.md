# Public IM Chat Redesign

`DESIGN.md` is the source of truth for this feature. Every screen must read as the same product if placed side by side.

## Design Read

Turn the existing contact affordance into a focused travel-planning conversation: one thread, one primary action, and enough context for a customer to start without an account.

Direction: organic / natural, expressed through route-blue accents, cool mist surfaces, and a restrained route marker. The visual system is product-first and uses the existing Radix/shadcn wrappers rather than introducing a new mobile component library.

## Scope and non-goals

In scope:

- Reuse the existing right-side green contact button in the China Trips mobile shell.
- Open the existing public IM conversation in a mobile bottom sheet and a desktop anchored panel.
- Improve first-message guidance, message hierarchy, composer behavior, and connection states.
- Preserve anonymous visitor sessions and existing Socket.IO + REST compensation behavior.
- Keep WhatsApp as a secondary action inside the chat surface.

Out of scope:

- A second mobile trigger, a new tab, or a separate inbox page for visitors.
- Mandatory login, mandatory lead form, file uploads, voice, reactions, typing indicators, or read receipts in this pass.
- Changing staff permissions or the mobile客服 workbench.

## User Flow: Start a conversation

### Overview

**Goal:** A visitor starts a conversation with a travel specialist in under one action after tapping the existing contact button.

**User Story:** As a temporary or logged-in portal visitor, I want to ask about a China trip immediately so that I can get help without filling a form first.

**Trigger:** Tap the existing right-side green contact button in the China Trips mobile shell, or the desktop “联系客服” trigger.

### Flow

```text
[Existing contact button]
          │
          ▼
 [Open chat sheet/panel]
          │
          ├── session ready ──▶ [Welcome + quick prompts + composer]
          │
          ├── session loading ─▶ [Skeleton header + disabled composer]
          │
          └── session error ───▶ [Retry state + WhatsApp fallback]
                                      │
                                      ▼
                              [Visitor sends message]
                                      │
                                      ▼
                         [Persisted message in timeline]
```

### Entry behavior

- The existing mobile button keeps its green visual treatment and right-side position. Its accessible name becomes “打开客服聊天窗口”.
- The button dispatches the existing IM open event. `PublicImBubble` owns the panel state; the mobile shell does not duplicate the panel.
- The mobile shell hides the generic desktop trigger while the mobile route is active.
- The visitor session is created or restored via `POST /api/im/public/session`. No login or lead form gate is shown.

### First-run conversation state

- Header: “联系客服” with connection state “正在连接”, “在线”, “连接中断”, or “暂时无法连接”. Never promise a fixed response time.
- Timeline: one route marker icon and the copy “告诉我们目的地、日期或大概想法”. This is the signature, not a separate nested card.
- Quick prompts: “我想定制一条路线” and “我已有目的地和日期”. Selecting a prompt inserts editable text into the composer; it does not send automatically.
- Composer: focused only after the session is ready; send is the single primary action.

### Message state

- Visitor bubbles align right with ink background and white text.
- Staff bubbles align left with white surface, ink text, and a compact “Syncing Travel” sender label on the first consecutive staff message only.
- System states use a full-width timeline row, not a fake message bubble.
- Messages are deduplicated by message id; polling remains the recovery path after reconnect or `sync.required`.

### Exit behavior

- Close button and Escape close the sheet/panel but keep the visitor cookie and draft in memory for the current page session.
- Browser back closes the mobile sheet before navigating away.
- If a draft is non-empty, close does not discard it silently: preserve it in component state while mounted; do not persist message text to localStorage.
- WhatsApp opens only from an explicit secondary action and never replaces the IM send path.

## State matrix

| State | Header | Timeline | Composer | Recovery |
|---|---|---|---|---|
| Loading | skeleton title + muted status | route marker skeleton | disabled | wait; timeout after 10s |
| Empty/ready | online/available state | route marker + two prompts | enabled | start typing or choose prompt |
| Sending | unchanged | optimistic visitor bubble with subtle pending label | disabled for current send | idempotency key; retry on failure |
| Staff reply | online/available | staff bubble appended and announced | enabled | Socket event or 5s REST compensation |
| Reconnecting | amber status | timeline remains usable/read-only | disabled briefly | auto-reconnect then GET after_seq |
| Send failed | unchanged | failed bubble marked “未发送” | enabled with “重试” | resend same client message id |
| Session/API error | danger status | concise explanation, no fake messages | disabled | “重试连接” + WhatsApp fallback |
| Offline | offline status | existing messages remain | disabled | listen for online event, then reconnect |

## Component: ExistingContactShortcut

### Purpose

Reuse the current right-side mobile contact button as the only mobile IM entry point.

### Variants

- `mobile`: existing green circular affordance, 48px minimum touch target, right-side safe-area position.
- `desktop`: existing labeled portal trigger, shown only outside the China Trips mobile shell.

### Behavior

- On activate, dispatch `PUBLIC_IM_OPEN_EVENT`.
- Do not open the old inquiry/WhatsApp gate.
- If the chat panel is already open, activation is a no-op or focuses the composer; it must not create a second panel.

### Accessibility

- `button`, accessible name “打开客服聊天窗口”.
- Visible focus ring at least 3px against the page surface.
- Touch target ≥48dp; respect `env(safe-area-inset-bottom)`.

## Component: PublicImSheet

### Purpose

Provide the conversation surface after the existing entry point is activated.

### Responsive composition

| Breakpoint | Behavior |
|---|---|
| Mobile `<640px` | Bottom sheet, width 100%, height `min(760px, 100dvh - 24px)`, top corners `xl`, safe-area-aware composer, page behind dimmed but not navigated. |
| Tablet `640–1023px` | Anchored panel, width 440px, max height `calc(100dvh - 48px)`, right 20px, bottom 20px. |
| Desktop `≥1024px` | Anchored panel, width 420px, max height 680px, right 24px, bottom 24px, elevation `lg`. |

### Visual hierarchy

1. Header: title, current connection state, close/back action.
2. Timeline: messages and route marker; no nested welcome card.
3. Composer: text input, send button, hint, optional WhatsApp secondary link below the input only when session/API is unavailable.

### Keyboard and screen reader behavior

- Dialog semantics: `role="dialog"`, `aria-modal="true"`, labelled by the title.
- Focus moves to the composer when ready and returns to the existing contact button on close.
- Escape closes; Tab is trapped within the sheet while open.
- Timeline uses `aria-live="polite"`; announce only new staff messages and send failures.
- Send button exposes “发送消息”; close exposes “关闭客服聊天”.

### Motion

- Mobile sheet enters from bottom over 300ms using the locked easing curve; exits in 225ms.
- Desktop panel fades and moves 8px upward over 225ms.
- No pulse animation inside the conversation. The existing green entry animation remains only as an entry affordance.
- With reduced motion, show/hide immediately.

## Component: MessageTimeline

### Rules

- Max message width 82% on mobile and 72% on desktop.
- Consecutive messages from one sender collapse sender metadata after the first item.
- Long URLs and CJK text wrap; never overflow horizontally.
- Use the route marker only at the beginning of an empty thread or after a day boundary.
- Pending, failed, and system states use labels and icons, not color alone.

## Component: Composer

### Rules

- One multiline textarea, 1–4 visual lines, max 8,000 characters.
- Enter sends; Shift + Enter inserts a newline.
- Disable only while the current message is being persisted or while session is unavailable.
- Preserve draft while reconnecting; clear only after server success.
- Show character count only after 7,500 characters.

## API and data contract

- Keep `POST /api/im/public/session`, `POST /api/im/public/conversations`, `GET/POST /api/im/public/conversations/:id/messages`.
- Keep visitor HttpOnly cookie as the browser identity. Do not put a portal access token in the Socket.IO handshake.
- Socket `message.created` is an enhancement; REST `after_seq` compensation is required for correctness.
- On failed send, reuse the same idempotency/client message id for retry.

## Acceptance criteria

- [ ] Existing mobile right-side button is the only mobile entry point.
- [ ] Tapping it opens one full-height mobile sheet, not a lead form or a second floating widget.
- [ ] Anonymous visitors can reach the composer without login.
- [ ] Loading, empty, staff reply, reconnect, offline, send failure, and API error states are distinct and recoverable.
- [ ] Staff messages arrive through Socket.IO when connected and through `after_seq` polling after interruption.
- [ ] Mobile sheet respects safe areas and has 48dp minimum controls.
- [ ] Keyboard focus, Escape, screen-reader labels, and polite message announcements work.
- [ ] WhatsApp is secondary and never replaces the IM primary action.
- [ ] Existing desktop portal entry remains functional.
- [ ] No new mobile trigger component is introduced.

## Build handoff

**Target agent:** `react-vite-tailwind-engineer`

**Design system:** Radix primitives + the existing shadcn/ui wrappers. Theme the implementation with `.ulpi/design/DESIGN.md`; do not re-implement dialog primitives.

**Likely files:** `app/src/components/PublicImBubble.tsx`, `app/src/index.css`, `app/src/shells/china-trips-mobile/ChinaTripsMobile.tsx`, and `app/src/domains/im/publicImClient.ts` only when required by the state contract.

**Instruction:** Implement exactly this spec. Reuse the existing mobile contact shortcut and existing IM client; do not add another mobile trigger or redesign unrelated portal surfaces.

## Design Pre-Flight

- Identity lock: pass. All values bind to `DESIGN.md`; no new colors, fonts, radii, or motion values are specified.
- Anti-slop: pass. No purple glow, cream canvas, nested cards, fake precision, buzzword copy, or elastic UI motion.
- State/flow coverage: pass. Loading, empty, sending, reply, reconnect, failure, offline, session error, refresh, back, and anonymous entry are covered.
- Accessibility: pass. Dialog semantics, focus return, keyboard handling, polite live region, 48dp touch targets, safe areas, and reduced motion are specified.
- Layout craft: pass. Mobile bottom sheet, desktop anchored panel, and timeline/composer hierarchy are distinct composition families.
- Cognitive load: pass. One primary action, two quick prompts, no mandatory form, and no new navigation layer.

### Scored self-critique

| Axis | Score | Note |
|---|---:|---|
| Distinctiveness | 3 | Route marker and single-entry reuse make the feature specific to travel planning. |
| Hierarchy and focus | 4 | One thread and one send action keep the surface direct. |
| Consistency | 4 | Tokens bind the existing mobile shell, desktop portal, and IM panel. |
| Accessibility | 4 | Focus, keyboard, live regions, contrast, and safe areas are explicit. |
| State/edge coverage | 4 | Recovery paths are specified without inventing backend semantics. |
| Copy quality | 3 | Plain Chinese copy is short and operational; final product copy can be tuned with support team terminology. |
| Restraint | 4 | Decorative UI is limited to one route marker signature. |
| Motion motivation | 4 | Motion communicates sheet/panel entry only. |
| **Total** | **30/32** | No axis is ≤2. |
