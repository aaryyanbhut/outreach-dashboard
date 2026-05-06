# AK Reliance Outreach Dashboard — Cloud Tier Project

This is the cloud-sync version of your Outreach Dashboard.

## Included

- Premium Outreach Dashboard
- Supabase login/signup
- Cloud sync across devices
- PWA manifest + service worker
- Netlify deploy config
- Supabase SQL schema with Row Level Security
- Tier 3 scaffolding notes and webhook placeholder

## Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Go to Supabase Project Settings → API.
5. Copy Project URL and anon public key.
6. Paste them into `config.js`.
7. Deploy the folder to Netlify.

## Deploy

Drag this whole folder to Netlify Drop, or push to GitHub and import into Netlify.

## How users use it

1. Open the deployed URL.
2. Click Cloud Login.
3. Create account or log in.
4. Use the app on laptop and phone.
5. Data syncs to Supabase.

## Important

This is Tier 1 fully set up as a project, plus Tier 3 scaffolding.
Real Gmail/Instagram/AI integrations require additional provider setup and cannot be safely faked in a static app.
