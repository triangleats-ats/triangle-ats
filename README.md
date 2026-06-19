# Triangle Transports ATS

CDL Class A Driver Applicant Tracking System — connected to Google Sheets.

## Setup (Vercel)

### Environment Variables (Settings → Environment Variables)

| Variable | Value |
|---|---|
| `GOOGLE_SHEETS_ID` | `1JhbYyQuf7yvJcOdDv05LyuLtdvZZJ44ZepcN9pJAoT8` |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | *(paste full contents of your JSON key file)* |

### Deploy
1. Push this repo to GitHub
2. Import in Vercel → it auto-detects Vite + API routes
3. Add environment variables
4. Redeploy

## Local development
```bash
npm install
# Create .env.local with the two variables above
npm run dev
```
