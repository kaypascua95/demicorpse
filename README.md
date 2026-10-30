# DemiCorpse

The existing React/Vite living archive, deployed through Netlify. The cinematic
entrance, film, wordmark, persistent header, More menu, and existing room animations
remain in place. Journal, Fragments, Play and Archive now load published content
from a dedicated Supabase project. Empty collections retain Coming Soon.

## Publish your first entry

1. Open **https://demicorpse.com/admin** and sign in with your publishing account
   (the Auth user created inside the DemiCorpse project, not your Supabase dashboard login).
2. Choose **Journal → New entry**. Add a title, date and writing. Markdown supports
   paragraphs, headings, emphasis, lists and links. Raw HTML is not supported.
3. Select **Use title for address** to create a readable URL. Set an excerpt/tags if desired.
4. **Save draft**. Upload images/audio/video as desired; choose **Use as cover** on an image.
   Uploads also save the current edits. Maximum 25 MB/file, 30 attachments/entry.
5. **Preview → Back to writing → Publish**. The public site reads the database on page
   load/navigation; no code change or deployment is required for posts.

Published entries support **Save published changes**, **Unpublish** (returns them to
private drafts), and confirmed permanent deletion. Fragments use writing/date and optional
photos, audio, or video; add a short caption before publishing. The public Fragments
feed shows the cover (or first attachment), with a link to the complete entry.
Play adds a game; Archive adds type/description. Close the tab or Sign out to end
the tab-scoped session. Account recovery is handled by the Supabase project administrator.

## Development

Node 22+ and npm. `npm ci`, copy `.env.example` to `.env.local`, supply the two public
Supabase values, then `npm run dev`. No service-role secret is used by this app.

`npm run build` and `npm run preview` reproduce the deployed SPA routing. Historical
HTML files are retained in the repository; Vite's dev server can serve those when
opening an old directory URL directly. The production build contains the root SPA
and public assets, with Netlify's existing catch-all rewrite.

Checks: `npm run typecheck`, `npm test`, `npx playwright install chromium`,
`npm run test:e2e`. Browser tests use isolated simulated API responses, never your
live posts. Security tests execute both migrations and actual PostgreSQL RLS in PGlite,
with minimal Supabase platform tables. Hosted Auth/Storage checks are separate.

## Backend and deployment

See [CMS setup and security](docs/CMS.md) for the owner binding, schema, architecture
decision, test scope and recovery. Netlify builds the GitHub `main` branch with
`npm run build` and publishes `dist`. The public Supabase URL/publishable key are
already in `netlify.toml`; these are safe to expose and cannot authorize writes.
The database policies are the authority. Never replace the publishable key with a
service-role or secret key.

## The Unmaking (preview branch)

The novella has a distinct branded entrance at `/the-unmaking/`, with a single
GSAP ScrollTrigger-driven ink reveal, accessible static reduced-motion mode,
six-part chapter index, and quiet reading templates at
`/the-unmaking/chapter-01` through `chapter-06`.

These are **layout previews, not published chapters**. The six titles reflect
the working manuscript; no manuscript body text is shipped in this branch.
A future step can connect approved chapter content to the existing owner-only CMS.
The original `/demicorpse-logo.png` remains in the novella header; the main
DemiCorpse entrance and other collections are unchanged.

The hero uses Peter Herrmann's photograph from Unsplash, served via
`images.unsplash.com`; Netlify CSP permits that one image domain. WebGL
textures fall back to a regular image on unsupported devices, and the entire
reveal becomes static when reduced motion is preferred. No Lenis instance or
extra npm dependency is installed.

### October 2026 preview revision

The main site's top-level LIKAS link is replaced with The Unmaking; LIKAS is
still available under the More menu. The novella entrance starts as a blank
black stage with an animated, keyboard-activatable **Scroll to Reveal** cue.
The branded novella header stays hidden until the scene has developed.
The byline and actions now read **a novella by DemiCorpse**, **Begin Reading**,
and **Chapter Index**. The index includes an original self-contained SVG cover
at `public/the-unmaking-cover.svg`; this is a cover **study**, not a finalized
print-ready paperback wrap. Reduced-motion visitors see the complete scene
and working navigation immediately.
