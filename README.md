# vchat — the single chat interface + doc editor for Mark's brain

One app, two jobs:

- **Chat** — talk to your second brain. Retrieves ranked context from the brain
  and answers via Claude Sonnet 5, streamed. Built on **prompt-kit**.
- **Docs** — open any **Workspace Doc** in **MDXEditor** (rich markdown) and
  **Save** writes straight back to the brain.

The AI key never touches the browser: the app talks to brain **edge functions**
(`chat`, `docs-read`, `docs-upsert`) using a server-side token.

## Stack
Next.js (App Router) · Tailwind · prompt-kit · MDXEditor · Supabase brain.

## Environment
Set these (locally in `.env.local`, on Vercel as Project Settings -> Environment Variables):

| Var | What |
|-----|------|
| `BRAIN_BASE` | `https://oqduxjquzbvetkcllymd.supabase.co/functions/v1` |
|  `BRAIN_INGEST_TOKEN` | the vchat **scoped grant key** (server-side only, never `NEXT_PUBLIC_`) — minted in the brain’s grants table (S7); the old shared ingest token still works until S8 re-keys |

## Run locally
```bash
npm install
# create .env.local with the two vars above
npm run dev   # http://localhost:3000
```

## Deploy (Vercel)
1. Import this repo in Vercel (New Project -> pick the repo).
2. Add the two Environment Variables above.
3. Deploy.

## Brain functions it uses
- `chat` — retrieval + Claude Sonnet 5, SSE stream
- `docs-read` — list / get Workspace Docs
- `docs-upsert` — save a doc back
- `docs-index` — (re)chunk docs so chat can find them
