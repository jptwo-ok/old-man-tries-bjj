# Old Man Tries BJJ — setup

## What you're getting
A Next.js site with:
- Homepage: IG-style grid, profile header, "+N new clips added" banner
- UNRATED overlay on any clip with zero votes; a colored dot showing the leading grade once it has votes
- "NEW" tag on clips added within the last N days (edit N in the admin theme page)
- Clip page: self-hosted video playback (no YouTube), LEGIT/SITUATIONAL/TRASH voting (one vote per visitor, can change their vote), open comments
- `/creators`: public leaderboard of content creators by highest/lowest rated
- `/admin` panel (password-protected, just for you): bulk-import clips, add clips one at a time, tag/retag creators, hide/delete clips, edit the color palette and fonts, edit the bio/name/handle, post manual announcements

## Video hosting — this is NOT YouTube
Clips are self-hosted. The site plays a direct mp4 URL through a plain HTML5 `<video>` tag — no YouTube
account, no YouTube copyright exposure. Storage is **Cloudflare R2** — S3-compatible, no egress fees, and
easy to put a custom domain in front of.

**R2 setup (do this later, after the site is built — see the checklist at the bottom of this file):**
1. Cloudflare account → **R2** → Create bucket (e.g. `omtb-clips`).
2. Bucket → **Settings → Public access** → connect a custom domain (e.g. `cdn.oldmantriesbjj.com`) so files are servable over plain HTTPS URLs. Cloudflare gives you the DNS record to add.
3. Upload clips into the bucket (drag-and-drop in the dashboard works fine for smaller batches; for 500 files, the `rclone` or AWS CLI — R2 is S3-compatible — is faster: R2 gives you an access key pair under **Manage R2 API Tokens**).
4. Each clip's public URL ends up as `https://cdn.oldmantriesbjj.com/<filename>.mp4` — that's what goes in the `video_url` field.
5. Thumbnails go in the same bucket (or a second one) the same way, set as `thumbnail_url`. No auto-generated thumbnail from the video — if you leave it blank, the grid shows a text tile with the clip's title instead of a broken image.

R2 serves range requests by default, so scrubbing/seeking in the video player works out of the box.

Your existing plan to also run a YouTube channel (@OldManTriesBJJ) for discovery/reach is separate and unaffected — that's just for getting people to find you and click through to the site, the site itself never depends on or embeds YouTube.

## 1. Create the Supabase project
1. Go to supabase.com → New project.
2. Once it's created, go to **SQL Editor** → New query, paste in the contents of `schema.sql` (included in this project), and run it. This creates all the tables and inserts the starting theme/copy.
3. Go to **Project Settings → API**. You'll need three values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this one secret — never put it in the browser, it's only used server-side)

## 2. Set your environment variables
Copy `.env.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=pick-your-own-password
NEXT_PUBLIC_SITE_URL=https://oldmantriesbjj.com
```

## 3. Run it locally to check everything
```
npm install
npm run dev
```
Visit `http://localhost:3000` for the site, `http://localhost:3000/admin` to log in with your `ADMIN_PASSWORD` and start importing clips.

## 4. Import your first 500
In `/admin/clips`, use the bulk import box. One line per clip:
```
Knee on belly escape, https://cdn.oldmantriesbjj.com/clips/001.mp4, John Danaher
Butterfly sweep from guard, , 
```
Format is `title, video_url, creator`. If a clip's mp4 isn't uploaded to your storage yet, leave the video URL blank — you can fill it in later inline in the admin clip list. Paste up to a few hundred lines at once; if 500 in one paste is unreliable, split into 2–3 batches — each batch automatically posts a "+N new clips added" banner on the homepage.

## 5. Push to GitHub and deploy on Vercel
1. Create a new GitHub repo, push this project to it.
2. On vercel.com, sign in with GitHub → New Project → import the repo.
3. Add the same environment variables from `.env.local` in Vercel's project settings (Environment Variables).
4. Deploy.

## 6. Point your domain at it
In Vercel: Project → Settings → Domains → add `oldmantriesbjj.com`. Vercel gives you the DNS records to add at your registrar (usually an A record or CNAME). Add them there — propagation is usually fast, sometimes up to a few hours.

## Changing the look after launch
Go to `/admin/theme` any time — colors, fonts, name, handle, bio, and the NEW-badge window are all editable there, and changes show up on the live site within about a minute. No code changes or redeploy needed for those.

For bigger layout/structure changes (not just colors/fonts), that's a code change — come back and I'll make it and you redeploy (Vercel redeploys automatically on every push to GitHub).
