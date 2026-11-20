# FRAME — Netflix-style YouTube video library

A static, responsive video-library starter. Videos are embedded from YouTube; this project does not upload or store video files.

## Run locally
Open `index.html` in a modern browser. For best results, use a local static server (for example VS Code Live Server).

## Current demo Admin Panel
- Click **Admin** → **ডেমো Admin Panel খুলুন**
- Add videos using a YouTube URL or 11-character video ID.
- Categories are generated automatically.
- Export/import the video catalogue as JSON.

**Important limitation:** this first version stores the catalogue in the current browser's `localStorage`. It is not a secure production admin system, does not sync between devices, and should not be exposed as a public admin tool.

## Free deployment: Cloudflare Pages
1. Create a GitHub account and a repository; upload these project files.
2. In Cloudflare, open Workers & Pages → Create → Pages → Connect to Git.
3. Select the repository. Choose no framework; build command blank; output directory `/`.
4. Deploy. Cloudflare assigns a free `*.pages.dev` address.
5. Every later Git push can trigger a new deployment.

## Production admin upgrade (recommended before public launch)
Connect Supabase:
- Supabase Auth for administrator sign-in.
- Supabase Postgres table for video metadata.
- Row Level Security (RLS): public read access for published videos; only authenticated admin can insert/update/delete.
- Keep the Supabase service-role key out of browser code. Use only the public anon/publishable key in the client with correctly configured RLS, or route privileged writes through a server-side function.

Suggested table:
```sql
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  youtube_id text not null,
  thumbnail_url text,
  description text,
  featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
```
Do not deploy the demo admin as a real authenticated admin. The demo has no password and local browser storage is editable by visitors.

## YouTube notes
- Use videos you own or are authorized to embed.
- A video owner may disable embedding; private/restricted videos may not play for all visitors.
- Unlisted does not mean access-controlled: anyone with the link can view/share it.
- YouTube branding, controls, ads, and applicable platform terms may appear.
