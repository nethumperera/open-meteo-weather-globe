# Deployment and GitHub Pages Guide

## Quick Start

The V2 project is now fully configured and pushed to GitHub. To activate GitHub Pages and go live:

### Step 1: Enable GitHub Pages

Visit: https://github.com/nethumperera/open-meteo-weather-globe/settings/pages

**Configure:**
- **Source:** Deploy from branch
- **Branch:** `main`
- **Folder:** `/ (website)` — Select the `website` folder

Click **Save**

GitHub will deploy within 1-2 minutes.

### Step 2: Verify Deployment

After 1-2 minutes, your site will be live at:
```
https://nethumperera.github.io/open-meteo-weather-globe/
```

### Step 3: Access the Globe

Once deployed, access the interactive globe at:
```
https://nethumperera.github.io/open-meteo-weather-globe/pages/globe.html
```

## What Happens Next

### Daily Automated Updates

The GitHub Actions workflow **`ingest-openmeteo.yml`** runs automatically:

**Schedule:** 11 AM IST (5:30 AM UTC) with randomized ±10 minute jitter

**What it does:**
1. Activates every day at 11:00 AM IST
2. Applies random 0-10 minute delay (prevents API blocking)
3. Fetches latest 24 hours of weather data from Open-Meteo free API
4. Processes data into hourly grid files (~1° resolution, global)
5. Updates `website/data/manifest.json` and hourly grid files
6. Auto-commits changes to `main` branch
7. GitHub Pages automatically redeploys

**Result:** Your globe stays updated with the latest weather data 24/7

## Data Retention

- **7-day rolling window:** Always maintains last 168 hours (7 days × 24 hours)
- **Daily eviction:** Oldest 24-hour batch deleted each day
- **Fresh data:** Newest 24 hours added from Open-Meteo API

## Manual Testing (Optional)

To test the ingest locally before relying on automation:

```powershell
cd C:\Users\HP\Documents\1 - Contracts\1 -  Research\V2\streaming
.\run_ingest.ps1
```

This will:
- Fetch 7 days of data from Open-Meteo
- Generate hourly grid files
- Create manifest
- Test everything locally

## Data Variables Available

From Open-Meteo free API (hourly):
- **Temperature:** °C at 2m
- **Precipitation:** mm per hour
- **Wind:** Speed (m/s) + Direction (°) at 10m
- **Humidity:** % relative at 2m
- **Weather Code:** WMO codes (0=sunny, 1-3=cloudy, etc.)

## Troubleshooting

### Pages not deploying?
- Ensure `website/` folder is selected (not root)
- Wait 2-3 minutes after enabling
- Check Actions tab for workflow logs

### Ingest failing?
- Check `.github/workflows/ingest-openmeteo.yml` in Actions tab
- Open-Meteo free tier allows ~60 requests/min
- Jitter prevents blocking; should always succeed

### No data showing?
- First ingest takes 5-10 minutes (large initial dataset)
- Subsequent daily updates take 1-2 minutes
- Check `website/data/manifest.json` exists and has content

## Repository Information

- **Type:** Open-source weather visualization
- **Data Source:** Open-Meteo free historical API
- **Architecture:** Client-side Leaflet globe, server-side data automation
- **License:** MIT
- **Deployment:** GitHub Pages + GitHub Actions
- **Update Frequency:** Daily at 11 AM IST

## Next Steps

1. ✅ Repository created
2. ✅ Code pushed
3. **→ Enable GitHub Pages** (visit settings/pages link)
4. ✅ Workflow will auto-run daily
5. ✅ Site goes live!
