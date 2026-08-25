# merava-website

## Running locally

The site is plain static HTML/CSS/JS (no bundler), but the Supabase
URL/key are kept out of git and generated into `js/config.js` at build
time instead of being hardcoded.

1. **Install Node.js** if you don't have it (v18+): https://nodejs.org

2. **Create a `.env` file** in the project root (this file is gitignored
   and never pushed) with:

   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   ```

   Ask a teammate for the project's real values, or find them in the
   Supabase dashboard under Project Settings → API.

3. **Generate the config file:**

   ```bash
   npm run build
   ```

   This writes `js/config.js` (also gitignored) from `.env`. Re-run it
   any time `.env` changes.

4. **Serve the folder** with any static file server, for example:

   ```bash
   python -m http.server 4173
   ```

   Then open http://localhost:4173 in a browser. (Opening `index.html`
   directly via `file://` won't work — the pages use ES module
   `<script type="module">` tags, which browsers block from `file://`.)

## Deploying

Whatever static host you use needs to run `npm run build` with
`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` set as
environment variables before serving the site, so that `js/config.js`
exists at request time.