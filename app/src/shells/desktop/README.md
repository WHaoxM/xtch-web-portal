# Desktop shell

Phase 3 keeps most desktop pages in `app/src/pages/`. Shared chrome lives here:

- `components/Navbar.tsx`
- `components/Footer.tsx`
- `components/Seo.tsx`
- `components/ScrollToTop.tsx`

Compatibility shims remain at `app/src/components/{Navbar,Footer,Seo,ScrollToTop}.tsx`.

Future phases may move page modules under this shell without changing public routes.
