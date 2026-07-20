# About Stats Editorial Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the About statistics section's dashboard-like typography and ineffective fade class with a responsive editorial layout and one-time restrained reveal.

**Architecture:** Keep all work local to `About.tsx`. Add a focused `AboutStatsSection` component that uses the existing `motion/react` dependency, local font variables, declarative variants, and responsive Tailwind classes.

**Tech Stack:** React, TypeScript, Tailwind CSS, Motion for React.

## Global Constraints

- Preserve the four approved facts and pale blue background.
- Display values as `60K+`, `50+`, `100%`, and `15 Years` without wrapping.
- Use Playfair Display 500 for values and Manrope 500 for labels.
- Use a two-column grid below `lg` and four columns from `lg`.
- Trigger once at `viewport.amount = 0.3`; stagger items by 90ms.
- Disable movement and delayed reveal under reduced motion.
- Add no dependency and change no global CSS or font token.

---

### Task 1: Build the editorial statistics component

**Files:**
- Modify: `app/src/pages/About.tsx:1-3,49-66,129-146`

**Interfaces:**
- Consumes: `motion`, `useReducedMotion`, `--font-serif`, and `--font-sans`.
- Produces: local `AboutStatsSection(): JSX.Element`; no exported API.

- [x] **Step 1: Add Motion imports and variants**

Add:

```tsx
import { motion, useReducedMotion, type Variants } from 'motion/react';

const editorialEase = [0.22, 1, 0.36, 1] as const;

const statsGridVariants: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.05, staggerChildren: 0.09 } },
};

const statItemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: editorialEase } },
};

const statValueVariants: Variants = {
  hidden: { y: '115%' },
  visible: { y: 0, transition: { duration: 0.65, ease: editorialEase } },
};

const statLabelVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.12, duration: 0.5, ease: editorialEase },
  },
};

const verticalDividerVariants: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: { duration: 0.7, ease: editorialEase } },
};

const horizontalDividerVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.7, ease: editorialEase } },
};
```

- [x] **Step 2: Normalize visible value strings**

Change only value spacing:

```tsx
const aboutStats = [
  { value: '60K+', label: 'Guests Served Worldwide' },
  { value: '50+', label: 'Countries Served Worldwide' },
  { value: '100%', label: 'China-Based Expert Team' },
  { value: '15 Years', label: 'Deep China Expertise' },
];
```

- [x] **Step 3: Add `AboutStatsSection`**

Add:

```tsx
function AboutStatsSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="bg-[#f5fafc] px-6 py-14 md:px-10 md:py-16 xl:px-20 xl:py-[72px]">
      <motion.div
        className="mx-auto grid max-w-[1280px] grid-cols-2 text-center lg:grid-cols-4"
        variants={statsGridVariants}
        initial={reduceMotion ? false : 'hidden'}
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        {aboutStats.map((stat, index) => (
          <motion.article
            key={stat.label}
            className="relative flex min-h-[145px] flex-col items-center justify-center px-2 py-7 md:min-h-[165px] md:px-6 md:py-8"
            variants={statItemVariants}
          >
            {index > 0 && (
              <motion.span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-3 left-0 w-px bg-[#cbd8de] ${
                  index === 2 ? 'hidden lg:block' : 'block'
                }`}
                variants={verticalDividerVariants}
                style={{ transformOrigin: 'center' }}
              />
            )}
            {index >= 2 && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-[#cbd8de] lg:hidden"
                variants={horizontalDividerVariants}
                style={{ transformOrigin: 'center' }}
              />
            )}
            <div className="overflow-hidden py-1">
              <motion.p
                className="whitespace-nowrap text-[40px] font-medium leading-none tracking-[-0.03em] text-[#142f3a] md:text-[50px] xl:text-[60px]"
                variants={statValueVariants}
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {stat.value}
              </motion.p>
            </div>
            <motion.p
              className="mt-4 max-w-[160px] text-[13px] font-medium leading-[1.45] tracking-[0.015em] text-[#35515d] md:text-[14px]"
              variants={statLabelVariants}
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              {stat.label}
            </motion.p>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
```

- [x] **Step 4: Replace the existing statistics markup**

Replace the existing section at `About.tsx:129-146` with:

```tsx
<AboutStatsSection />
```

- [x] **Step 5: Run static verification**

Run from `app/`:

```powershell
npm run build
npm run lint
```

Expected: both commands exit successfully with no new errors.

- [x] **Step 6: Verify browser behavior**

At 390px, 1024px, and 1280px confirm:

- values remain on one line;
- 2-column/4-column layouts switch at `lg`;
- no horizontal overflow;
- normal motion reveals each item once with dividers;
- reduced-motion mode renders the final state immediately.

- [x] **Step 7: Update collaboration records**

Mark the task done in `docs/agent-task-board.md`, update `docs/agent-progress.md`, and check off this plan.
