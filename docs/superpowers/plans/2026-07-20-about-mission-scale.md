# About Mission & Vision Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the About page Mission & Vision section's visual scale and give its three text roles a consistent, refined font treatment.

**Architecture:** Make one local JSX class/style adjustment inside the existing About section. Reuse the fonts already loaded by `index.css`; do not introduce CSS selectors, font files, dependencies, or component abstractions.

**Tech Stack:** React, TypeScript, Tailwind CSS, existing Google Fonts import.

## Global Constraints

- Modify only the Mission & Vision section in `app/src/pages/About.tsx`.
- Preserve centered layout, copy, colors, scroll animation, images, and adjacent sections.
- Use Playfair Display 400 for the heading, Archivo 600 for the eyebrow, and Manrope 400 for body copy.
- Mobile values: 56px vertical padding, 12px eyebrow, 30px heading, 16px body.
- Desktop values: 72px vertical padding, 12px eyebrow, 42px heading, 17px body.
- Extra-wide values: 88px vertical padding and 46px heading.
- Add no dependency and change no global font token.

---

### Task 1: Refine the Mission & Vision section

**Files:**
- Modify: `app/src/pages/About.tsx:103-117`
- Verify: `app/src/pages/About.tsx`

**Interfaces:**
- Consumes: existing `--font-display`, `--font-serif`, and `--font-sans` CSS variables from `app/src/index.css`.
- Produces: no new interface; only responsive presentation changes in the existing section.

- [x] **Step 1: Record the current visual baseline**

Open `/about` at 1024px and 390px widths. Confirm the current desktop classes resolve to 128px vertical padding, 24px eyebrow, 58px heading, and 30px body copy.

- [x] **Step 2: Apply the approved local typography and spacing**

Replace the Mission & Vision section markup classes and local font-family styles with:

```tsx
<section className="bg-[#fbfbfb] px-6 py-14 text-center md:px-10 md:py-[72px] xl:py-[88px]">
  <div className="about-replica-anim animate-fade-up mx-auto max-w-[1040px]">
    <p
      className="text-[12px] font-semibold uppercase tracking-[0.32em] text-[#786076]"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      Our Mission &amp; Vision
    </p>
    <h2
      className="mx-auto mt-[18px] max-w-[900px] text-[30px] font-normal leading-[1.14] tracking-[-0.012em] text-[#55585b] md:text-[42px] xl:text-[46px]"
      style={{ fontFamily: 'var(--font-serif)' }}
    >
      <span className="md:block">In the Name of Nature, Embark</span>{' '}
      <span className="md:block">on a Grand Journey of the Soul</span>
    </h2>
    <p
      className="mx-auto mt-6 max-w-[780px] text-[16px] leading-[1.7] text-[#888a98] md:text-[17px]"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      We strive to make private travel feel calm, personal, and deeply connected to place.
      Through careful planning and local insight, we create China itineraries that balance
      iconic sights, hidden moments, comfort, and meaningful discovery.
    </p>
  </div>
</section>
```

- [x] **Step 3: Run static verification**

Run from `app/`:

```powershell
npm run build
npm run lint
```

Expected: both commands exit successfully with no new TypeScript or ESLint errors.

- [x] **Step 4: Verify responsive presentation**

Open `/about` at 390px, 1024px, and a width at or above 1280px.

Confirm:

- 390px: 56px vertical padding, 12px eyebrow, 30px heading, 16px body.
- 1024px: 72px vertical padding, 12px eyebrow, 42px heading, 17px body.
- 1280px+: 88px vertical padding and 46px heading.
- Heading uses Playfair Display; eyebrow uses Archivo; body uses Manrope.
- Copy, colors, images, adjacent sections, and entrance animation are unchanged.

- [x] **Step 5: Update collaboration records**

Mark `Coordinator (about-mission-scale)` done in `docs/agent-task-board.md` and add the completed build/lint/browser checks to `docs/agent-progress.md`.
