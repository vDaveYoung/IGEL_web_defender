# Edge Defender: Sector Wars (IGEL Web Defender)

Interactive browser game for conference booths. Players defend industry-specific edge environments from cyber threats using IGEL capabilities.

## 1.0 Features

- Lead capture form (first name, last name, company, email, opt-in, optional role)
- Badge-aware lead capture (optional badge ID, phone, raw badge scan text with auto-fill)
- Optional camera-based badge scan (QR/PDF417 where browser supports BarcodeDetector)
- Consent-first flow: follow-up consent is required before entering mission selection
- Mission selection:
  - Healthcare: Save the Hospital
  - Finance: Protect the Bank
  - Government: Secure the Agency
  - Military: Defend the Base
  - Legal: Protect the Law Firm
- 75-second real-time defense round
- Mobile/tablet optimized controls:
  - Drag on arena to aim
  - Tap arena to fire
  - Dedicated on-screen `FIRE` button with hold-to-auto-fire for one-handed play
- Threat waves plus boss encounter
- IGEL capabilities as power-ups:
  - Immutable Fortress
  - UMS Command Center
  - App Portal Deployment
  - Adaptive Secure Desktop
  - Disaster Recovery Rollback
- Scoring:
  - +100 threat eliminated
  - +250 endpoint saved
  - +1000 boss defeated
  - +2000 perfect defense bonus
- Result summary + leaderboard (mission and event views)

## Run

```bash
cd /home/dgyoungjr/dev/IGEL_web_defender
npm install
npm start
```

Open: <http://localhost:8833>

## Launching From GitHub

This project has an Express backend (`server.js`) for shared leaderboard persistence.

- Running directly as a static site (for example, GitHub Pages) now works for gameplay.
- In static mode, scores are saved in browser `localStorage` and are not shared across devices.
- For shared/event leaderboard, run the Node server (`npm start`) or deploy this app to a Node-capable host.
- A GitHub Pages workflow is included at `.github/workflows/pages.yml` and publishes the `public/` folder on pushes to `main`.

Conference display mode:

- <http://localhost:8833/display.html>

## API

- `GET /api/healthz`
- `GET /api/leaderboard?mission=healthcare|finance|government|military|legal`
- `POST /api/submit-score`

## Conference Flow

1. Capture or paste badge details in Step 1.
2. Optional: tap **Scan Badge With Camera** to capture badge barcode data.
3. Use **Auto-Fill From Badge Text** to populate lead fields.
4. Check consent for follow-up communications.
5. Continue to mission selection and play the game.

If camera barcode scanning is unavailable in a browser, use paste-based badge input or a scanner wedge device.

## Display Mode

- Rotates between event-wide and per-sector leaderboards every 10 seconds.
- Designed for booth TV or wallboard usage.
- Refreshes automatically and highlights the current top defender.

Score data persists in:

- `data/scores.json`
