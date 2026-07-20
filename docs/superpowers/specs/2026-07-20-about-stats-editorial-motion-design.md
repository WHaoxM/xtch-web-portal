# About Stats Editorial Motion Design

Status: Approved

## Goal

Make the About page statistics section feel editorial, calm, and intentionally animated instead of resembling a dashboard.

## Scope

- Change only the statistics section in `app/src/pages/About.tsx`.
- Preserve the four approved facts and the existing pale blue section color.
- Reuse `motion/react` and the font families already loaded by `index.css`.
- Do not add dependencies or change global animation/font rules.

## Typography and layout

- Display values as `60K+`, `50+`, `100%`, and `15 Years` without wrapping.
- Use Playfair Display at weight 500 for values.
- Use Manrope at weight 500 for labels; remove the current monospace treatment.
- Value sizes: 40px mobile, 50px medium, 60px extra-wide.
- Label sizes: 13px mobile, 14px medium and above.
- Use a two-column grid below the large breakpoint and four columns from the large breakpoint.
- Use 56px vertical section padding on mobile, 64px on desktop, and 72px on extra-wide screens.
- Use animated hairline dividers between columns and between the two mobile rows.

## Motion

- Trigger once when 30% of the grid enters the viewport (`viewport.amount = 0.3`).
- Reveal each item in a 90ms stagger.
- Draw dividers from their center over 700ms.
- Reveal values through an overflow mask with a 16px upward movement over 650ms.
- Fade labels upward by 8px after the corresponding value begins, over 500ms.
- Use the restrained cubic-bezier curve `[0.22, 1, 0.36, 1]`.
- Under `prefers-reduced-motion: reduce`, render the completed state immediately with no movement or delayed reveal.

## Responsive and accessibility requirements

- Values must remain on one line at 390px, 1024px, and 1280px.
- The section must have no horizontal overflow.
- Motion is decorative: dividers are `aria-hidden`, and DOM reading order remains unchanged.
- Text contrast and the four business facts remain unchanged.

## Verification

- Run `npm run build` and `npm run lint`.
- Check 390px, 1024px, and 1280px layouts.
- Confirm the reveal runs once in normal motion mode.
- Emulate reduced motion and confirm the final state renders immediately.
