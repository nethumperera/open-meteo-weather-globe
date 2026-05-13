# GitHub Pages Configuration for Open-Meteo Weather Globe

This repository is configured to serve from the `website/` folder via GitHub Pages.

## Enabling GitHub Pages

**Manual Setup (if not already enabled):**

1. Go to https://github.com/nethumperera/open-meteo-weather-globe/settings/pages
2. Under **Source**, select:
   - **Branch:** `main`
   - **Folder:** `website/` (not root or docs)
3. Click **Save**
4. GitHub will deploy within 1-2 minutes

**Live URL:** https://nethumperera.github.io/open-meteo-weather-globe/

## How It Works

- **Landing Page:** `website/index.html`
- **Interactive Globe:** `website/pages/globe.html`
- **Data Storage:** `website/data/manifest.json` + `website/data/streaming/*.json`
- **Assets:** `website/assets/js/` and `website/assets/css/`

## Automated Updates

GitHub Actions workflow (`.github/workflows/ingest-openmeteo.yml`):
- **Schedule:** Every 6 hours at :00 UTC with ±10 minute jitter
- **Action:** Fetches latest 6 hours from Open-Meteo API
- **Storage:** Updates `website/data/streaming/` directory
- **Deployment:** Auto-commits to `main` branch → Pages redeploys

## Access After Enabling

- **Website:** https://nethumperera.github.io/open-meteo-weather-globe/
- **Globe:** https://nethumperera.github.io/open-meteo-weather-globe/pages/globe.html
