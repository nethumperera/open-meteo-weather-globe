#!/usr/bin/env python3
"""
Open-Meteo 6-Hour Weather Data Ingest Module

Fetches hourly weather data from Open-Meteo free API (archive endpoint) and maintains
a 7-day rolling window of gridded data. Refreshes every 6 hours with jitter.

Data Flow:
1. Fetch last 7 days of hourly data for global 1° grid
2. Post-process to JSON grid files per variable per hour
3. Generate manifest index
4. Commit to GitHub Pages
"""

import json
import os
import sys
import requests
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class OpenMeteoIngest:
    def __init__(self, config_path: str = "config.json"):
        """Initialize ingest module from config."""
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.api_url = self.config['api']['base_url']
        self.variables = self.config['variables']['hourly']
        self.output_dir = Path(self.config['output']['data_directory']).absolute()
        self.manifest_path = Path(self.config['output']['manifest_path'])
        self.grid_res = self.config['geographic_bounds']['grid_resolution_degrees']
        self.window_days = self.config['data_retention']['window_days']
        
        # Create output directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        
    def get_grid_points(self) -> List[Tuple[float, float]]:
        """
        Generate 1-degree global grid points (lat, lon).
        Returns list of (latitude, longitude) tuples.
        """
        lat_min = self.config['geographic_bounds']['latitude']['min']
        lat_max = self.config['geographic_bounds']['latitude']['max']
        lon_min = self.config['geographic_bounds']['longitude']['min']
        lon_max = self.config['geographic_bounds']['longitude']['max']
        
        lats = np.arange(lat_min, lat_max + self.grid_res, self.grid_res)
        lons = np.arange(lon_min, lon_max + self.grid_res, self.grid_res)
        
        points = [(lat, lon) for lat in lats for lon in lons]
        logger.info(f"Generated {len(points)} grid points at {self.grid_res}° resolution")
        return points
    
    def fetch_location_data(self, latitude: float, longitude: float, 
                           start_date: str, end_date: str) -> Dict:
        """
        Fetch hourly weather data for a single location from Open-Meteo.
        
        Args:
            latitude, longitude: Location coordinates
            start_date, end_date: "YYYY-MM-DD" format
            
        Returns:
            Dictionary with hourly data indexed by timestamp
        """
        params = {
            'latitude': latitude,
            'longitude': longitude,
            'start_date': start_date,
            'end_date': end_date,
            'hourly': ','.join(self.variables),
            'timezone': 'UTC'
        }
        
        try:
            response = requests.get(self.api_url, params=params, 
                                  timeout=self.config['api']['timeout_seconds'])
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch data for ({latitude}, {longitude}): {e}")
            return {}
    
    def ingest_7day_window(self) -> bool:
        """
        Fetch last 7 days of hourly data, post-process, and save to grid files.
        
        Returns:
            True if successful
        """
        logger.info("Starting 7-day rolling window ingest...")
        
        # Date range: last 7 days
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=self.window_days - 1)
        
        logger.info(f"Fetching data from {start_date} to {end_date}")
        
        # Initialize grid structure: {timestamp: {variable: {lat: {lon: value}}}}
        grid_data = {}
        grid_points = self.get_grid_points()
        
        # Fetch data for all grid points
        total_points = len(grid_points)
        for idx, (lat, lon) in enumerate(grid_points):
            if (idx + 1) % 50 == 0:
                logger.info(f"Fetching data: {idx + 1}/{total_points} points...")
            
            data = self.fetch_location_data(lat, lon, 
                                           str(start_date), str(end_date))
            
            if not data or 'hourly' not in data:
                logger.warning(f"No data for ({lat}, {lon})")
                continue
            
            # Extract hourly data
            hourly = data['hourly']
            times = hourly.get('time', [])
            
            for time_idx, timestamp in enumerate(times):
                if timestamp not in grid_data:
                    grid_data[timestamp] = {}
                
                # For each variable, store as {variable: {lat: {lon: value}}}
                for var in self.variables:
                    var_data = hourly.get(var, [])
                    if time_idx < len(var_data):
                        value = var_data[time_idx]
                        
                        if var not in grid_data[timestamp]:
                            grid_data[timestamp][var] = {}
                        
                        lat_str = f"{lat:.1f}"
                        if lat_str not in grid_data[timestamp][var]:
                            grid_data[timestamp][var][lat_str] = {}
                        
                        lon_str = f"{lon:.1f}"
                        grid_data[timestamp][var][lat_str][lon_str] = value
        
        if not grid_data:
            logger.error("No data collected from API")
            return False
        
        logger.info(f"Collected data for {len(grid_data)} hourly timestamps")
        
        # Save hourly grid files
        self._save_hourly_grids(grid_data)
        
        # Generate manifest
        self._generate_manifest(grid_data)
        
        logger.info("Ingest completed successfully")
        return True
    
    def _save_hourly_grids(self, grid_data: Dict):
        """Save grid data organized by hour as separate JSON files."""
        for timestamp, data in grid_data.items():
            # Create hour-specific file: YYYY-MM-DDTHH.json
            filename = f"{timestamp.replace(':', '')[:13]}.json"
            filepath = self.output_dir / filename
            
            # Structure: {variable: {latitude: {longitude: value}}}
            hour_data = {}
            for var, lat_data in data.items():
                hour_data[var] = lat_data
            
            with open(filepath, 'w') as f:
                json.dump(hour_data, f, indent=2)
        
        logger.info(f"Saved {len(grid_data)} hourly grid files to {self.output_dir}")
    
    def _generate_manifest(self, grid_data: Dict):
        """Generate manifest.json listing available hourly windows."""
        timestamps = sorted(grid_data.keys())
        
        manifest = {
            "version": "1.0",
            "generated": datetime.utcnow().isoformat() + "Z",
            "data_window_days": self.window_days,
            "variables": self.variables,
            "grid_resolution_degrees": self.grid_res,
            "available_hours": len(timestamps),
            "time_range": {
                "start": timestamps[0] if timestamps else None,
                "end": timestamps[-1] if timestamps else None
            },
            "hourly_files": [
                f"{ts.replace(':', '')[:13]}.json" 
                for ts in timestamps
            ]
        }
        
        with open(self.manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"Generated manifest with {len(timestamps)} hourly files")
    
    def hourly_update(self) -> bool:
        """
        6-hour update: fetch latest 6 hours, delete oldest files if the 7-day window exceeds 168 hours.
        Called every 6 hours via GitHub Actions (with jitter to avoid API blocking).
        
        Returns:
            True if successful
        """
        logger.info("Starting 6-hour rolling window update...")
        
        # Load current manifest
        if not Path(self.manifest_path).exists():
            logger.warning("Manifest not found, performing full 7-day ingest instead")
            return self.ingest_7day_window()
        
        with open(self.manifest_path, 'r') as f:
            manifest = json.load(f)
        
        # Get current hourly files
        current_files = set(manifest.get('hourly_files', []))

        # Fetch the latest 6-hour window
        now_utc = datetime.utcnow()
        window_start = now_utc - timedelta(hours=6)

        logger.info(f"Fetching latest 6 hours starting from {window_start.isoformat()}Z")

        start_date = window_start.date()
        end_date = now_utc.date()
        
        grid_data = {}
        grid_points = self.get_grid_points()
        
        for idx, (lat, lon) in enumerate(grid_points):
            if (idx + 1) % 100 == 0:
                logger.info(f"Fetching hourly data: {idx + 1}/{len(grid_points)} points...")
            
            data = self.fetch_location_data(lat, lon,
                                           str(start_date), str(end_date))
            
            if not data or 'hourly' not in data:
                continue
            
            hourly = data['hourly']
            times = hourly.get('time', [])
            
            for time_idx, timestamp in enumerate(times):
                try:
                    timestamp_dt = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M")
                except ValueError:
                    continue

                if timestamp_dt < window_start:
                    continue

                if timestamp not in grid_data:
                    grid_data[timestamp] = {}

                for var in self.variables:
                    var_data = hourly.get(var, [])
                    if time_idx < len(var_data):
                        value = var_data[time_idx]

                        if var not in grid_data[timestamp]:
                            grid_data[timestamp][var] = {}

                        lat_str = f"{lat:.1f}"
                        if lat_str not in grid_data[timestamp][var]:
                            grid_data[timestamp][var][lat_str] = {}

                        lon_str = f"{lon:.1f}"
                        grid_data[timestamp][var][lat_str][lon_str] = value
        
        if not grid_data:
            logger.warning("No data collected for latest hour")
            return False
        
        # Save new hourly file
        self._save_hourly_grids(grid_data)
        
        # Delete oldest files if we exceed 7 days (168 files)
        existing_files = sorted([f for f in self.output_dir.glob('*.json')])
        while len(existing_files) > 168:
            oldest_file = existing_files.pop(0)
            oldest_file.unlink()
            logger.info(f"Deleted oldest file: {oldest_file.name} (rolling window limit reached)")
        
        # Rebuild manifest from current files
        all_files = sorted([f.stem for f in self.output_dir.glob('*.json')])
        if all_files:
            self._generate_manifest({ts: {} for ts in all_files})
        
        logger.info(f"6-hour update completed. Total files: {len(all_files)}")
        return True


def main():
    """Main entry point."""
    try:
        # Determine if this is initial 7-day ingest or 6-hour update
        manifest_path = Path("../docs/data/manifest.json")
        
        ingest = OpenMeteoIngest("config.json")
        
        if manifest_path.exists():
            logger.info("Manifest found, performing 6-hour update")
            success = ingest.hourly_update()
        else:
            logger.info("First run, performing full 7-day ingest")
            success = ingest.ingest_7day_window()
        
        sys.exit(0 if success else 1)
    
    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
