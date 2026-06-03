# IGEL Web Defender 1.0

A CVE research app that lets you search NVD and compare likely impact between Windows and IGEL OS.

## Features

- Search CVEs by keyword or direct CVE ID
- Pull official CVE metadata from NVD
- AI-assisted plain-English exploit summary
- Side-by-side Windows vs IGEL impact and mitigation guidance
- Basic cache and request timeout guardrails

## Run Locally

1. Copy environment template:

```bash
cp .env.example .env
```

2. Add your `OPENAI_API_KEY` to `.env`.

3. Install dependencies:

```bash
npm install
```

4. Start the server:

```bash
npm start
```

5. Open:

- http://localhost:8833

## Notes

- AI output is advisory and should be validated with vendor advisories.
- NVD can rate limit; the app includes response timeout handling.
