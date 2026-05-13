# Deployment and GitHub Pages Guide

## 🎉 Quick Start

Your site is live and running!

- **Home:** https://nethumperera.github.io/open-meteo-weather-globe/
- **Globe:** https://nethumperera.github.io/open-meteo-weather-globe/pages/globe.html

## ⏰ Automated Hourly Updates

GitHub Actions workflow **runs every hour automatically**:

**Schedule:** Every hour at :00 UTC with ±10 minute random jitter

**What it does:**
1. Activates hourly
2. Applies random 0-10 minute delay (prevents API blocking)
3. Fetches latest hour of weather from Open-Meteo API
4. Processes data into hourly grid file (~1° global resolution)
5. Updates `docs/data/manifest.json`
6. Auto-commits to GitHub → Pages redeploys

**Result:** Fresh weather data every hour, 24/7! 🌍

## 📊 Data Retention

- **7-day rolling window:** Always 168 hours (7 days)
- **Hourly updates:** One new hour each hour
- **Auto-cleanup:** Oldest hour deleted when exceeding 168 files

## 🧪 Manual Testing (Optional)

```powershell
cd C:\Users\HP\Documents\1 - Contracts\1 -  Research\V2\streaming
.\run_ingest.ps1
```

Fetches 7 days of data locally (~5-10 min), then:

```powershell
cd ..
git add docs/data/
git commit -m "data: add initial 7-day weather"
git push origin main
```

## Data Variables Available

From Open-Meteo free API (hourly):
- **Temperature:** °C at 2m
- **Precipitation:** mm per hour
- **Wind:** Speed (m/s) + Direction (°) at 10m
- **Humidity:** % relative at 2m
- **Weather Code:** WMO codes (0=sunny, 1-3=cloudy, etc.)

## 🔧 Troubleshooting

### No data on globe?
- Initial ingest takes 5-10 minutes
- Check `docs/data/manifest.json` has content
- Monitor: https://github.com/nethumperera/open-meteo-weather-globe/actions

### Workflow not running?
- Check Actions tab for errors
- Verify `.github/workflows/ingest-openmeteo.yml` exists
- Free tier should never block with jitter enabled

### Data not updating?
- Runs every hour at :00 UTC + jitter
- Give it <20 minutes after the hour
- Check workflow logs for status

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
