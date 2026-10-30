# Ledgerly Invoice Extractor

A Vercel-ready invoice intake app. Upload one PDF or image, extract invoice fields and line items into a typed result, review uncertain or missing values, then copy or download the JSON.

## Run locally

Use Node.js 22 or newer. Copy `.env.example` to `.env.local` and add an AI Gateway key:

```powershell
Copy-Item .env.example .env.local
```

Then set `AI_GATEWAY_API_KEY` in `.env.local` and start the app:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`AI_GATEWAY_MODEL` is optional. The app defaults to `openai/gpt-5.4`, which currently accepts images and PDFs and supports structured output. Set a different current model ID in `provider/model` format if you prefer another model.

## Deploy to Vercel

Import the `outputs/invoice-extractor` folder as the project root. Add `AI_GATEWAY_API_KEY` in the Vercel project's Environment Variables, or configure Vercel OIDC for AI Gateway. Add `AI_GATEWAY_MODEL` only if you want to override the default. Redeploy after setting variables.

## File handling

- Accepts PDF, JPG, PNG, and WebP files up to 4 MB.
- Uploads are kept in request memory; this app has no database, file storage, or invoice history.
- The document is sent to AI Gateway for extraction. Model and provider processing follows your AI Gateway configuration and the selected provider's policies.
- Missing and unclear values remain `null`; ambiguous fields are listed in `uncertain_fields` for review.

## Main routes

- `/` — upload, review, and JSON export UI
- `POST /api/extract` — validates the file and returns schema-validated invoice JSON

