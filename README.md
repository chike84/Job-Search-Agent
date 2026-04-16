# Job Search Agent — Vercel Deploy Guide

## What this is
A self-hosted job search agent powered by Claude, with live web search and Notion pipeline sync. 
The Vercel proxy solves the CORS restriction that blocks direct API calls from browser UIs.

## File structure
```
job-search-agent/
├── api/
│   └── proxy.js      ← Vercel edge function (the CORS proxy)
├── index.html         ← The full agent UI
├── vercel.json        ← Vercel config (CORS headers, function timeout)
├── package.json       ← Minimal package file
└── README.md
```

## Deploy steps

### 1. Create a GitHub repo
- Go to github.com and create a new repo (e.g. "job-search-agent")
- Upload all files from this folder, preserving the folder structure
- The `api/` folder must stay as-is — Vercel auto-detects it as serverless functions

### 2. Connect to Vercel
- Go to vercel.com and sign in with your GitHub account (free)
- Click "Add New Project"
- Import your GitHub repo
- Framework preset: leave as "Other" (no framework needed)
- Click Deploy — Vercel will detect the api/ folder automatically

### 3. Add your Anthropic API key
- In Vercel dashboard, go to your project > Settings > Environment Variables
- Add a new variable:
  - Name:  ANTHROPIC_API_KEY
  - Value: your key from console.anthropic.com
- Click Save, then go to Deployments and click "Redeploy" to apply the env var

### 4. Update the proxy URL in index.html
- After deploying, Vercel gives you a URL like: https://job-search-agent-abc123.vercel.app
- Open index.html and find this line near the top of the script:
  const PROXY_URL = 'https://YOUR_VERCEL_APP.vercel.app/api/proxy';
- Replace YOUR_VERCEL_APP with your actual Vercel subdomain
- Commit and push — Vercel auto-redeploys

### 5. Test the proxy
- Open your Vercel URL in a browser
- The badge at the top should say "proxy connected" in green
- Run a search in the Target Companies tab

## Getting your Anthropic API key
- Go to console.anthropic.com
- Sign in or create an account
- Navigate to API Keys
- Create a new key and copy it

## Notes
- The free Vercel tier gives you 100GB bandwidth/month and serverless function execution — more than enough
- The proxy uses the Edge Runtime for fast cold starts (under 300ms typically)
- Your API key is stored as a Vercel environment variable and never exposed to the browser
- The Notion pipeline tab connects to your existing Job Pipeline Tracker database
- Notion DB collection ID (pre-configured): 45ecc169-634b-49c2-9042-9e4fee1c0750
- Notion hub URL: https://app.notion.com/p/34262cd4a7c581df9b17e0b907877dc6
