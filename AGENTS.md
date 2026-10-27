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

## Rules
- All app pages live under src/routes/_authenticated; its layout loads the user family and wraps pages in StoreProvider (src/lib/demo-store.tsx) — keeps family-scoped data access in one place.
- Family data access is enforced by RLS via public.e_membro(); joining/creating families only through security-definer RPCs — users cannot insert memberships directly.
