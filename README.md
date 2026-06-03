# Edge Defender: Sector Wars (IGEL Web Defender)

Interactive browser game for conference booths. Players defend industry-specific edge environments from cyber threats using IGEL capabilities.

## 1.0 Features

- Lead capture form (first name, last name, company, email, opt-in, optional role)
- Mission selection:
  - Healthcare: Save the Hospital
  - Finance: Protect the Bank
  - Government: Secure the Agency
  - Military: Defend the Base
  - Legal: Protect the Law Firm
- 75-second real-time defense round
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

Open: http://localhost:8833

## API

- `GET /api/healthz`
- `GET /api/leaderboard?mission=healthcare|finance|government|military|legal`
- `POST /api/submit-score`

Score data persists in:

- `data/scores.json`
