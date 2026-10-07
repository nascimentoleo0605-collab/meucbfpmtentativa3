<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisions
- The site name is MEUCBFPM; use it consistently in visible branding and page titles.
- Only admins create accounts (public signup disabled); account creation runs in server functions in src/lib/admin.functions.ts — needs privileged access.
- First admin is created via /auth setup form, only while no admin exists.
- Question options stored as a JSON array of strings (2–6) so formats can grow later.
- Admin parses and reviews PDFs locally before saving; source files stay private.
- AI-generated questions run through an authenticated admin-only server function and are reviewed client-side before insertion, protecting prompts and access.
- The router-derived sitemap includes only explicitly public routes and excludes the authenticated subtree, preventing private app pages from being indexed.
- Question images use a private Storage bucket with admin-only writes; signed-in users receive short-lived image links through a server function only for images attached to readable questions, preventing broad object listing.
- Image question intake runs OCR locally in the admin browser and requires review before insertion, keeping source photos private until the admin saves them.
- Ranking totals are assembled in an authenticated server function with only display names and aggregate counts returned, avoiding exposing individual attempts across accounts.
- Study filters passed between pages live in typed URL search parameters, preserving browser history and direct navigation.
- Study AI runs in authenticated server functions; PROVÃO persists 10-question blocks per user and hides gabaritos until completion.
- Pasted question sheets are parsed in the admin browser and reviewed before insertion, keeping source text local until confirmed.
- Paginate question-bank reads up to 1,500 to bypass the per-request row ceiling.
- Shuffle questions per filter, not answer. Export summaries as local PDFs with Unicode fonts for privacy and accents.
- Each account may stay signed in on at most 2 devices; session ids are tracked server-side and the oldest is signed out on check, limiting account sharing.
