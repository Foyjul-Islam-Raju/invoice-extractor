# Ledgerly Invoice Extractor

A Vercel-ready invoice intake app. Upload one PDF or image, extract invoice fields and line items into a typed result, review uncertain or missing values, then copy or download the JSON.

## Run locally

Use Node.js 22 or newer. AI Gateway needs authentication for every extraction request. For local development, choose one of these options:

**Use the Vercel project’s OIDC token** (recommended when this repo is linked to Vercel):

```powershell
npx vercel login
npx vercel link
npx vercel env pull .env.local
npm install
npm run dev
```

The pulled OIDC token expires periodically; run `npx vercel env pull .env.local` again if local extraction stops authenticating.

**Or use an AI Gateway API key** from the Vercel dashboard:

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Set `AI_GATEWAY_API_KEY` in `.env.local` before starting the app. Keep this key server-side; `.env.local` is ignored by Git.

Then open [http://localhost:3000](http://localhost:3000).

`AI_GATEWAY_MODEL` is optional. The app defaults to `openai/gpt-5.4`. Set a different model ID in `provider/model` format if you prefer another model.

## Deploy to Vercel

Set the Vercel project's Root Directory to this app's root (the folder containing `package.json`). AI Gateway uses Vercel OIDC automatically for deployed requests when Secure Backend Access with OIDC is enabled for the project. Alternatively, add `AI_GATEWAY_API_KEY` in the Vercel project's Environment Variables. Add `AI_GATEWAY_MODEL` only if you want to override the default, then redeploy after changing project settings.

## File handling

- Accepts PDF, JPG, PNG, and WebP files up to 4 MB.
- Uploads are kept in request memory; this app has no database, file storage, or invoice history.
- The document is sent to AI Gateway for extraction. Model and provider processing follows your AI Gateway configuration and the selected provider's policies.
- Missing and unclear values remain `null`; ambiguous fields are listed in `uncertain_fields` for review.

## Main routes

- `/` — upload, review, and JSON export UI
- `POST /api/extract` — validates the file and returns schema-validated invoice JSON

