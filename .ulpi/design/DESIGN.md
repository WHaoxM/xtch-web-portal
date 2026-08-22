---
project: syncing-travel-portal
register: product
aesthetic_direction: organic / natural
color_strategy: restrained
design_system: Radix primitives + existing shadcn/ui wrappers
design_variance: 5
motion_intensity: 3
visual_density: 5
---

## Design Read

Calm route-planning utility with a human handoff: the interface should feel like a reliable travel desk, not a generic support widget.

## Signature

The conversation timeline uses a small route marker at the start of a new planning thread. It turns “send a message” into “start a route conversation” without adding a second navigation system or decorative cards.

Every screen must read as the same product if placed side by side.

## Inspiration

No external references were supplied. The existing China Trips mobile shell is the source of interaction DNA: safe-area-aware surfaces, large touch targets, quiet cool-gray canvas, and a single green WhatsApp affordance. The redesign keeps the existing right-side entry point and changes only the conversation surface behind it.

## Color (locked)

| role | OKLCH | hex | use |
|---|---|---|---|
| canvas | `oklch(0.975 0.012 250)` | `#F4F7FB` | chat background and mobile sheet surround |
| surface | `oklch(1 0 0)` | `#FFFFFF` | message rows, composer, cards |
| elevated | `oklch(0.985 0.009 250)` | `#FAFCFF` | header controls and hover surfaces |
| ink | `oklch(0.24 0.045 250)` | `#15243B` | primary text and visitor bubbles |
| muted | `oklch(0.49 0.035 250)` | `#5D6B80` | secondary copy and timestamps |
| subtle | `oklch(0.68 0.025 250)` | `#8A96A8` | placeholder and hint copy |
| border | `oklch(0.89 0.022 250)` | `#DCE3ED` | dividers and field borders |
| accent | `oklch(0.49 0.16 255)` | `#0B63CE` | one primary action: send, quick prompt, focus ring |
| success | `oklch(0.53 0.13 155)` | `#167A52` | online/connected state |
| warning | `oklch(0.64 0.13 78)` | `#9A6500` | delayed response or reconnecting |
| danger | `oklch(0.54 0.16 28)` | `#B43F2F` | failed send and unrecoverable error |
| WhatsApp fallback | `oklch(0.63 0.16 153)` | `#16A765` | only the secondary WhatsApp action; never the IM primary action |

The dominant 60% is the cool canvas, 30% is white surface, and 10% is the route blue accent. Ink on canvas is approximately 12:1; ink on white is approximately 14:1; accent on white is approximately 5.4:1; muted on white is approximately 5.1:1. UI borders and focus indicators target at least 3:1 against adjacent surfaces.

## Type (locked)

| role | family | use | notes |
|---|---|---|---|
| display | `Noto Sans SC`, `Source Sans 3`, sans-serif | sheet title and empty-state heading | 24px / 700; no decorative serif in the product surface |
| body | `Noto Sans SC`, `Source Sans 3`, sans-serif | messages and supporting copy | 14–16px; line-height 1.45–1.6 |
| utility | `Noto Sans SC`, `Source Sans 3`, sans-serif | status, timestamp, controls | 11–12px; medium weight |

The pairing is a single humanist sans family across weights. It matches the mobile shell and avoids changing visual voice inside the chat.

## Scales (locked)

- Spacing: 4px base, allowed values `4, 8, 12, 16, 20, 24, 32, 40`.
- Radius: `sm 8px`, `md 12px`, `lg 16px`, `xl 24px`, `full 9999px`. Do not introduce a second radius family.
- Elevation: `sm 0 2px 8px rgba(21,36,59,.08)`, `md 0 12px 32px rgba(21,36,59,.14)`, `lg 0 24px 60px rgba(21,36,59,.20)`.
- Z layers: `fixed 40`, `modalBackdrop 45`, `modal 50`, `toast 70`.
- Breakpoints: mobile `<640px`, tablet `640–1023px`, desktop `≥1024px`.
- Motion: enter 300ms, state change 150ms, exit 225ms; easing `cubic-bezier(0.16, 1, 0.3, 1)`; no bounce or elastic easing. Respect `prefers-reduced-motion`.

## Voice

Register: plain, warm, operational. Use direct action vocabulary: “发送”, “重试”, “关闭”, “打开 WhatsApp”. Avoid marketing phrases and fake response-time promises. A status must describe the current connection state, not imply guaranteed staff availability.

## Consistency rule

The existing right-side mobile contact button remains the only mobile entry point. The chat sheet, desktop panel, quick prompts, message bubbles, composer, and error states all use this file’s tokens. Any new color, font, radius, or motion value is a design defect until this lock is deliberately updated.
