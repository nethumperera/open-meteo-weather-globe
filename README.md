# Open-Meteo Weather Visualization (V2)

Real-time global weather visualization using Open-Meteo free API with hourly 7-day rolling window data.

## Features

- **Real-time Data**: Hourly weather data from Open-Meteo free API
- **7-Day Rolling Window**: Daily updates at 11 AM IST (with jitter to avoid API blocking)
- **Live Visualization**: 
  - Real wind arrow vectors (quiver plot)
  - Rain/precipitation heatmap with particle effects
  - Proper OpenStreetMap basemap
  - Hourly time slider and playback
- **Automated Deployment**: GitHub Actions scheduled ingest → GitHub Pages live globe

## Data Variables

From Open-Meteo free API (hourly):
- Temperature (°C)
- Precipitation (mm)
- Wind Speed (m/s) and Direction (°)
- Relative Humidity (%)
- Weather Code

## Project Structure

```
V2/
├── .github/workflows/
│   └── ingest-openmeteo.yml      # Scheduled ingest workflow (11 AM IST + jitter)
├── streaming/
│   ├── ingest.py                 # Open-Meteo API client & data processor
│   ├── config.json               # API config, bounds, variables, retention
│   ├── requirements.txt           # Python dependencies
│   └── run_ingest.ps1            # Local testing script
├── website/
│   ├── pages/
│   │   └── globe.html            # Interactive map UI
│   ├── assets/
│   │   ├── js/
│   │   │   └── globe.js          # Leaflet map + wind arrows + rain overlay
│   │   └── css/
│   │       └── style.css         # Styling
│   ├── data/
│   │   ├── manifest.json         # Available hourly windows index
│   │   └── streaming/            # Hourly grid data (auto-managed)
│   └── index.html                # Landing page
└── README.md
```

## Setup & Deployment

### Local Testing

```bash
cd streaming
pip install -r requirements.txt
python ingest.py
```

### Scheduled Ingest (GitHub Actions)

The workflow runs every hour with ±10 minute jitter to avoid API blocking:
- Fetches latest hour of data from Open-Meteo
- Maintains 7-day rolling window (168 hours)
- Auto-deletes oldest hour when window is exceeded
- Updates manifest and adds new hourly file
- Commits changes to GitHub Pages

### Live Globe

Visit `website/pages/globe.html` after deployment to GitHub Pages.

## Configuration

Edit `streaming/config.json` to customize:
- Geographic bounds (latitude/longitude)
- API endpoint and free tier rate limits
- Data retention (7 days × 24 hours)
- Variable selection (precipitation, temperature, wind, etc.)

## License

MIT
