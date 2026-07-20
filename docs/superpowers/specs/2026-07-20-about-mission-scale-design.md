# About Mission & Vision Scale Design

Status: Approved

## Goal

Make the About page's “Mission & Vision” section feel smaller and more refined at desktop and mobile sizes.

## Scope

- Change only the Mission & Vision section in `app/src/pages/About.tsx`.
- Preserve its centered layout, copy, colors, typeface roles, and scroll animation.
- Do not change images or any other About section.

## Visual specification

- Set section padding to 56px on mobile, 72px on desktop, and 88px on extra-wide screens.
- Set the uppercase eyebrow to 12px at all widths.
- Set the heading to 30px on mobile, 42px on desktop, and 46px on extra-wide screens, with a 900px maximum width.
- Balance the desktop heading as two controlled lines: “In the Name of Nature, Embark” / “on a Grand Journey of the Soul”.
- Set body copy to 16px on mobile and 17px from the desktop breakpoint, with a 780px maximum width.
- Use 18px between eyebrow and heading, and 24px between heading and body copy.
- Use the already-loaded Playfair Display at weight 400 for the heading, Archivo at weight 600 for the uppercase eyebrow, and Manrope at weight 400 for body copy.
- Apply these families locally to this section; do not change global font tokens or add a font dependency.
- Keep mobile typography readable rather than applying the desktop reductions mechanically.
- Preserve the existing quiet gray palette and centered editorial hierarchy.

## Responsive behavior

- Mobile: 56px padding, 12px eyebrow, 30px heading, and 16px body copy.
- Desktop: 72px padding, 12px eyebrow, 42px heading, and 17px body copy.
- Extra-wide desktop: 88px padding and a 46px heading; other type sizes remain at desktop values.

## Verification

- Run `npm run build` and `npm run lint`.
- Visually inspect `/about` on desktop and mobile widths.
- Confirm no changes to copy, images, adjacent sections, or the section's entrance animation.
