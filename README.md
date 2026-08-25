# merava-website

## Local setup

The site is static (no bundler), but the Supabase URL/key are kept out of
git and generated into `js/config.js` at build time:

```bash
cp .env.example .env   # fill in real SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY
npm run build           # writes js/config.js from .env
```

Re-run `npm run build` any time `.env` changes. `js/config.js` is gitignored.

## Deploying

Whatever static host you use needs to run `npm run build` with
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` set as environment variables
before serving the site, so that `js/config.js` exists.