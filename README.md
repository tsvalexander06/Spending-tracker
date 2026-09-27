# Was It Worth It — Spending Tracker

A dead-simple, phone-first spending tracker built around one question: **was this purchase worth it?**

Every time you spend, you log it in a couple of taps and tag it as one of three buckets:

- ✅ **Necessity** — you actually needed it
- 🤔 **Want** — a treat, no regrets required
- 💀 **Stupid buy** — money you probably shouldn't have spent

The **Insights** tab then shows, front and center, how much you've wasted on stupid buys this week / month / all time.

## Live app

Installable PWA (works offline): **https://tsvalexander06.github.io/Spending-tracker/**

On a phone: open the link in Safari/Chrome → **Add to Home Screen** → it runs like a native app.

## Features

- **Fast logging** — big amount keypad, three bucket buttons, optional note + category.
- **History** — grouped by day, filterable by bucket, delete-with-undo.
- **Insights** — a "stupid spending" hero number, a Need/Want/Stupid split bar, a 7-day chart, quick stats.
- **Private** — all data lives in your browser's `localStorage`; nothing is sent anywhere.
- **Backup / restore** — export/import your data as JSON.
- **Currency picker** and installable, offline-capable PWA.

## Run locally

Static site — no build step:

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

(The home-screen icons are generated at deploy time by `scripts/genicons.js`; run `mkdir -p icons && node scripts/genicons.js icons` if you want them locally.)

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app — UI, logic and styles, self-contained. |
| `manifest.webmanifest` | PWA metadata (name, icons, theme, id). |
| `sw.js` | Service worker: network-first for app code, cache for offline. |
| `scripts/genicons.js` | Pure-Node PNG icon generator (no deps), run in CI. |
| `.github/workflows/deploy-pages.yml` | Builds icons and publishes to GitHub Pages. |

## Data model

```json
{ "id": "…", "amount": 12.5, "bucket": "stupid", "note": "Impulse hoodie", "cat": "Shopping", "ts": 1700000000000 }
```

`bucket` is one of `need`, `want`, `stupid`.
