# Deploy GapCity

## Vercel with a public GitHub repository

1. Create a public repository for GapCity. Upload this folder's source, including the lockfile, README and docs. Do not upload `node_modules`, `.next`, `.env.local`, recordings or personal data.
2. Import the repository into Vercel. If this folder is nested in a larger repo, select it as the Root Directory. Choose the Next.js preset and a supported Node version of at least 22.13. Do not select static export.
3. Initially deploy with live mode disabled. Check the sample flow and the map's browser console and network requests.
4. Add the server-only variables from `.env.example`. Set a long random signing secret, keep it consistent across server instances, and enable both `GAPCITY_LIVE_ENABLED` and `GAPCITY_PUBLIC_LIVE`. Public visitors need no access code. Keep the SerpApi key and signing secret server-only.
5. Run a real search around Vijayawada, then open a scored zone and an individual competitor. Confirm that the signed snapshot supports evidence requests even if a different server instance handles them.
6. Check phone and desktop layouts, keyboard navigation, source links, exports and error states. Confirm map attribution is visible.

The code sets a 90-second maximum for search and 180 seconds for review evidence. Check the host's actual plan/runtime duration support. Requests use up to three sequential search calls or six sequential review calls. Host limits can still terminate a request. No hosting plan or payment is required by this source package; use a plan whose limits suit the demo.

Public users can explore samples and select Live search without an access code when `GAPCITY_PUBLIC_LIVE=true`. To run a private demo instead, disable that flag and configure `GAPCITY_LIVE_ACCESS_TOKEN`. Never commit credentials to the repo. Per-process caps are not a global account limit on Vercel. Keep your account credit usage under observation and disable live mode when the demo is over.

Official deployment guide: https://vercel.com/docs/frameworks/full-stack/nextjs

## Run on a Node host

Install dependencies, run `npm run build`, set the server environment, then run:

```sh
npm start -- --hostname 0.0.0.0 --port 3000
```

Terminate HTTPS at your host's reverse proxy. A single continuously running process has a process-local call ceiling; restarts still reset it. There is no database or durable shared cache in this version.

## Repository commands

After creating an empty public repository, run from the GapCity folder:

```sh
git init
git add .
git commit -m "Build GapCity local market explorer"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

Replace the placeholder with the actual repository URL. Check `git status` before committing. No repository or deployment was created by these instructions.
