# Consolidation System

A standalone app for the welcome/consolidation team to log First Timers &amp; VIPs
at TRCF and assign them to a network leader for follow-up — replacing the paper
logbook. This is the **data-entry** counterpart to the read-only Consolidation tab
inside the Pastors' Overview dashboard: anything added or edited here shows up
there automatically, since both apps read/write the same Google Sheet backend.

## What you can do here

- **Add First Timer** — log a new visitor: name, contact info, address, decision
  made, and which network leader they're assigned to for follow-up.
- **Edit** — fix or fill in details on an existing record (pencil icon).
- **Update follow-up status** — move a record through Not Yet Contacted →
  Contacted → Invited to Cell → Attending Cell (or Inactive) right from the list.
- **Filter** — by date, follow-up status, or by assigned network.
- **Network Leaders tab** — one row per leader showing how many First Timers
  they're assigned in total and how many are still waiting on follow-up, with a
  **Send Notification** button. Tapping it opens your phone's own SMS app with
  a reminder message pre-filled to that leader's number — you just tap Send.
  No SMS gateway or subscription needed, since it uses your device's own
  messaging app; this only works when opened on a phone (not desktop).

### Setting up leader phone numbers

Send Notification is disabled until a leader has a phone number on file. Open
`src/App.jsx`, find the `NETWORKS` array near the top, and fill in each
`boysPhone` / `girlsPhone` field, e.g.:
```js
{ id:"abraham", label:"Abraham Network", boys:"Deonie Abraham", boysPhone:"09171234567", girls:"Elva Abraham", girlsPhone:"09179876543" },
```
Rebuild and redeploy after adding numbers.

## Setup

This app shares its backend with the Pastors' Overview dashboard's Consolidation
tab, so you only need to set the backend up once (skip this if it's already
deployed for that dashboard — just reuse the same Web App URL).

1. Create a new Google Sheet (any name, e.g. "TRCF Consolidation System").
2. Extensions → Apps Script → paste in `ConsolidationBackend.gs` (included in
   this project).
3. Run the `setup` function once (creates the "FirstTimers" tab, asks you to
   authorize — normal).
4. Deploy → New deployment → **Web app** → Execute as **Me** → Who has access
   **Anyone** → Deploy. Copy the URL it gives you.
5. Open `src/App.jsx`, find the line near the top:
   ```js
   const CONSOLIDATION_SCRIPT_URL = "...";
   ```
   and make sure it matches the URL you copied (it should already match the
   Pastors' Overview dashboard's URL — update both if you redeploy the backend).
6. Rebuild (`npm run build`) and deploy.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build (outputs to dist/)
```

Deploy the `dist/` folder anywhere that serves static files (Vercel, Netlify,
GitHub Pages, etc.). Give this link to whoever's on welcome/consolidation duty;
give the Pastors' Overview dashboard link to the pastors.

## Updating the network list

If a network leader changes, edit the `NETWORKS` array near the top of
`src/App.jsx` — keep it in sync with the same array in the Pastors' Overview
dashboard's `src/App.jsx` so assignments line up correctly.
