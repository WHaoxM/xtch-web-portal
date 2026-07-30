# `app/api/lib` — compatibility shims only

Prefer importing from `app/api/domains/*` or `app/api/platform/*`.

Do **not** add new business logic here. Existing one-line re-exports remain
until remaining call sites migrate; new code must not depend on this folder.
