/**
 * Open-Meteo Interactive Weather Globe
 * 
 * Features:
 * - Real wind arrows (vector field quiver plot)
 * - Precipitation heatmap with particle overlay
 * - Hourly time slider and playback
 * - OpenStreetMap basemap
 */

class WeatherGlobe {
  constructor() {
    this.map = null;
    this.manifest = null;
    this.currentHourData = null;
    this.currentHourIndex = 0;
    this.isPlaying = false;
    this.currentRegion = 'asia';
    
    // Canvas layers for visualization
    this.windArrowLayer = null;
    this.rainHeatmapLayer = null;
    this.rainParticleLayer = null;
    
    // Data storage
    this.windData = null;
    this.precipitationData = null;
    
    // Configuration
    this.config = {
      windArrowScale: 1.2,
      windArrowDensity: 4, // Show every 4th grid point
      rainHeatmapOpacity: 0.6,
      rainParticleCount: 200,
      playbackSpeed: 500, // ms per frame
    };

    this.regionPresets = {
      asia: {
        center: [35, 100],
        zoom: 3,
        bounds: [[5, 25], [80, 180]]
      },
      world: {
        center: [20, 0],
        zoom: 2,
        bounds: null
      }
    };
    
    this.initialize();
  }
  
  async initialize() {
    try {
      console.log('🌍 Initializing Weather Globe...');
      
      // Initialize map
      this.initializeMap();
      
      // Load manifest
      await this.loadManifest();
      
      // Load initial hour
      if (this.manifest && this.manifest.hourly_files.length > 0) {
        await this.loadHourlyData(0);
      }
      
      // Setup controls
      this.setupControls();
      
      console.log('✓ Globe initialized');
    } catch (error) {
      console.error('Failed to initialize globe:', error);
      this.showError(error.message);
    }
  }
  
  initializeMap() {
    // Create map centered on equator
    this.map = L.map('map-container', {
      center: this.regionPresets.asia.center,
      zoom: this.regionPresets.asia.zoom,
      preferCanvas: true,
      maxZoom: 6,
      minZoom: 2,
    });
    
    // OpenStreetMap basemap (free tile layer)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    
    // Add secondary cartodb basemap as fallback
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO',
      maxZoom: 19,
      className: 'basemap-fallback'
    }).addTo(this.map);
    
    // Create canvas layers for custom rendering
    this.windArrowLayer = L.canvas({ attribution: 'Wind vectors' });
    this.rainHeatmapLayer = L.canvas({ attribution: 'Precipitation' });
    this.rainParticleLayer = L.canvas({ attribution: 'Rain particles' });
    
    this.map.addLayer(this.windArrowLayer);
    this.map.addLayer(this.rainHeatmapLayer);
    this.map.addLayer(this.rainParticleLayer);

    this.setMapRegion('asia');
    
    console.log('✓ Map initialized');
  }
  
  async loadManifest() {
    try {
      const response = await fetch('../data/manifest.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      this.manifest = await response.json();
      console.log(`✓ Manifest loaded: ${this.manifest.hourly_files.length} hours available`);
      
      // Update time range display
      document.getElementById('time-range').textContent = 
        `${this.manifest.time_range.start} to ${this.manifest.time_range.end}`;
      
      // Populate hour selector
      this.populateHourSelector();
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }
  
  async loadHourlyData(hourIndex) {
    try {
      if (!this.manifest || hourIndex >= this.manifest.hourly_files.length) {
        throw new Error('Invalid hour index');
      }
      
      const filename = this.manifest.hourly_files[hourIndex];
      const response = await fetch(`../data/streaming/${filename}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      this.currentHourData = data;
      this.currentHourIndex = hourIndex;
      
      // Extract specific variables
      this.windData = data.wind_speed_10m && data.wind_direction_10m 
        ? { speed: data.wind_speed_10m, direction: data.wind_direction_10m }
        : null;
      
      this.precipitationData = data.precipitation || null;
      
      // Update visualization
      this.renderWindArrows();
      this.renderRainHeatmap();
      this.renderRainParticles();
      
      // Update time display
      const timestamp = filename.replace('.json', '');
      const dateStr = `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 8)} ${timestamp.substring(9, 11)}:00 UTC`;
      document.getElementById('current-hour').textContent = dateStr;
      document.getElementById('hour-slider').value = hourIndex;
      document.getElementById('hour-count').textContent = `${hourIndex + 1}/${this.manifest.hourly_files.length}`;
      
      console.log(`✓ Loaded hour ${hourIndex}: ${dateStr}`);
    } catch (error) {
      throw new Error(`Failed to load hourly data: ${error.message}`);
    }
  }
  
  renderWindArrows() {
    if (!this.windData) {
      console.warn('No wind data available');
      return;
    }
    
    const canvas = this.windArrowLayer.getCanvas();
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.8;
    
    // Parse grid data
    const lats = Object.keys(this.windData.speed).map(Number).sort((a, b) => b - a);
    const lons = lats.length > 0 
      ? Object.keys(this.windData.speed[lats[0]]).map(Number).sort((a, b) => a - b)
      : [];
    
    const density = this.config.windArrowDensity;
    
    // Render arrows at sparse grid points
    for (let i = 0; i < lats.length; i += density) {
      const lat = lats[i];
      for (let j = 0; j < lons.length; j += density) {
        const lon = lons[j];
        
        const speed = this.windData.speed[lat] && this.windData.speed[lat][lon];
        const direction = this.windData.direction[lat] && this.windData.direction[lat][lon];
        
        if (speed !== undefined && direction !== undefined) {
          this.drawWindArrow(ctx, lat, lon, speed, direction);
        }
      }
    }
    
    ctx.globalAlpha = 1.0;
    console.log('✓ Wind arrows rendered');
  }
  
  drawWindArrow(ctx, lat, lon, speed, direction) {
    // Convert lat/lon to canvas coordinates
    const point = this.map.latLngToContainerPoint([lat, lon]);
    
    // Arrow length based on wind speed (0-30 m/s mapped to 0-50 px)
    const arrowLength = Math.min((speed / 30) * 50, 50) * this.config.windArrowScale;
    
    // Wind direction to radians (convert from meteorological: 0°=N, 90°=E)
    const angle = (direction * Math.PI / 180);
    
    // Arrow color: blue tint, stronger color for higher speed
    const hue = 200; // Blue
    const lightness = Math.max(30, 70 - (speed / 30) * 40); // Darker for stronger wind
    ctx.strokeStyle = `hsl(${hue}, 100%, ${lightness}%)`;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2;
    
    // Draw arrow line
    const endX = point.x + arrowLength * Math.sin(angle);
    const endY = point.y - arrowLength * Math.cos(angle); // Invert Y for canvas coords
    
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Draw arrowhead
    const arrowHeadLength = 6;
    const arrowHeadAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowHeadLength * Math.sin(angle - arrowHeadAngle),
      endY + arrowHeadLength * Math.cos(angle - arrowHeadAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowHeadLength * Math.sin(angle + arrowHeadAngle),
      endY + arrowHeadLength * Math.cos(angle + arrowHeadAngle)
    );
    ctx.stroke();
  }
  
  renderRainHeatmap() {
    if (!this.precipitationData) {
      console.warn('No precipitation data available');
      return;
    }
    
    const canvas = this.rainHeatmapLayer.getCanvas();
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get grid bounds
    const lats = Object.keys(this.precipitationData).map(Number).sort((a, b) => b - a);
    const lons = lats.length > 0
      ? Object.keys(this.precipitationData[lats[0]]).map(Number).sort((a, b) => a - b)
      : [];
    
    if (lats.length < 2 || lons.length < 2) return;
    
    const lat_step = Math.abs(lats[0] - lats[1]);
    const lon_step = Math.abs(lons[1] - lons[0]);
    
    // Draw heatmap cells
    ctx.globalAlpha = this.config.rainHeatmapOpacity;
    
    for (let i = 0; i < lats.length - 1; i++) {
      for (let j = 0; j < lons.length - 1; j++) {
        const lat = lats[i];
        const lon = lons[j];
        const precip = this.precipitationData[lat] && this.precipitationData[lat][lon];
        
        if (precip !== undefined && precip > 0) {
          // Color: intensity based on precipitation (0-50mm)
          const intensity = Math.min(precip / 50, 1); // Normalize to 0-1
          const hue = 200 - (intensity * 30); // Blue to cyan
          const saturation = 100;
          const lightness = 50 + (intensity * 10);
          
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
          
          // Draw cell
          const nwPoint = this.map.latLngToContainerPoint([lat, lon]);
          const sePoint = this.map.latLngToContainerPoint([lat - lat_step, lon + lon_step]);
          
          const width = sePoint.x - nwPoint.x;
          const height = sePoint.y - nwPoint.y;
          
          if (width > 0 && height > 0) {
            ctx.fillRect(nwPoint.x, nwPoint.y, width, height);
          }
        }
      }
    }
    
    ctx.globalAlpha = 1.0;
    console.log('✓ Rain heatmap rendered');
  }
  
  renderRainParticles() {
    // Simple particle rain effect at high precipitation areas
    const canvas = this.rainParticleLayer.getCanvas();
    if (!canvas || !this.precipitationData) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Find high precipitation areas and add particles there
    const lats = Object.keys(this.precipitationData).map(Number).sort((a, b) => b - a);
    const lons = lats.length > 0
      ? Object.keys(this.precipitationData[lats[0]]).map(Number).sort((a, b) => a - b)
      : [];
    
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = 'rgba(100, 150, 255, 0.6)'; // Blue raindrops
    
    let particleCount = 0;
    
    // Draw particles in high-precipitation cells
    for (const lat of lats) {
      for (const lon of lons) {
        const precip = this.precipitationData[lat] && this.precipitationData[lat][lon];
        
        if (precip !== undefined && precip > 5) { // Only show particles if significant rain
          const point = this.map.latLngToContainerPoint([lat, lon]);
          
          // Number of particles proportional to precipitation
          const particlesHere = Math.min(
            Math.floor((precip / 50) * (this.config.rainParticleCount / lats.length)),
            5
          );
          
          for (let p = 0; p < particlesHere; p++) {
            const x = point.x + (Math.random() - 0.5) * 20;
            const y = point.y + (Math.random() - 0.5) * 20;
            const size = 1 + Math.random() * 2;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            particleCount++;
          }
        }
      }
    }
    
    ctx.globalAlpha = 1.0;
    console.log(`✓ Rain particles rendered (${particleCount} particles)`);
  }
  
  populateHourSelector() {
    const selector = document.getElementById('hour-selector');
    selector.innerHTML = '';
    
    for (let i = 0; i < this.manifest.hourly_files.length; i++) {
      const option = document.createElement('option');
      option.value = i;
      
      const filename = this.manifest.hourly_files[i];
      const timestamp = filename.replace('.json', '');
      const dateStr = `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 8)} ${timestamp.substring(9, 11)}:00`;
      
      option.textContent = dateStr;
      selector.appendChild(option);
    }
    
    // Setup change listener
    selector.addEventListener('change', (e) => {
      const hourIndex = parseInt(e.target.value);
      this.loadHourlyData(hourIndex);
      this.stopPlayback();
    });
  }
  
  setupControls() {
    this.setupRegionControls();

    // Hour slider
    const slider = document.getElementById('hour-slider');
    if (this.manifest) {
      slider.max = this.manifest.hourly_files.length - 1;
      slider.addEventListener('input', (e) => {
        const hourIndex = parseInt(e.target.value);
        this.loadHourlyData(hourIndex);
        this.stopPlayback();
      });
    }
    
    // Playback buttons
    document.getElementById('btn-play').addEventListener('click', () => this.startPlayback());
    document.getElementById('btn-pause').addEventListener('click', () => this.stopPlayback());
    document.getElementById('btn-prev').addEventListener('click', () => this.previousHour());
    document.getElementById('btn-next').addEventListener('click', () => this.nextHour());
    
    // Refresh button
    document.getElementById('btn-refresh').addEventListener('click', async () => {
      try {
        await this.loadManifest();
        await this.loadHourlyData(this.currentHourIndex);
        this.showStatus('✓ Data refreshed');
      } catch (error) {
        this.showError(`Refresh failed: ${error.message}`);
      }
    });
  }

  setupRegionControls() {
    const asiaButton = document.getElementById('btn-region-asia');
    const worldButton = document.getElementById('btn-region-world');

    if (asiaButton) {
      asiaButton.addEventListener('click', () => this.setMapRegion('asia'));
    }

    if (worldButton) {
      worldButton.addEventListener('click', () => this.setMapRegion('world'));
    }

    this.updateRegionButtons();
  }

  setMapRegion(regionName) {
    const region = this.regionPresets[regionName] || this.regionPresets.asia;
    this.currentRegion = regionName in this.regionPresets ? regionName : 'asia';

    if (region.bounds) {
      this.map.fitBounds(region.bounds, { padding: [20, 20] });
    } else {
      this.map.setView(region.center, region.zoom);
    }

    this.updateRegionButtons();
  }

  updateRegionButtons() {
    const asiaButton = document.getElementById('btn-region-asia');
    const worldButton = document.getElementById('btn-region-world');

    if (asiaButton) asiaButton.disabled = this.currentRegion === 'asia';
    if (worldButton) worldButton.disabled = this.currentRegion === 'world';
  }
  
  startPlayback() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    document.getElementById('btn-play').disabled = true;
    document.getElementById('btn-pause').disabled = false;
    
    const playInterval = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(playInterval);
        return;
      }
      
      const nextIndex = this.currentHourIndex + 1;
      if (nextIndex >= this.manifest.hourly_files.length) {
        this.stopPlayback();
        clearInterval(playInterval);
      } else {
        this.loadHourlyData(nextIndex);
      }
    }, this.config.playbackSpeed);
  }
  
  stopPlayback() {
    this.isPlaying = false;
    document.getElementById('btn-play').disabled = false;
    document.getElementById('btn-pause').disabled = true;
  }
  
  previousHour() {
    if (this.currentHourIndex > 0) {
      this.loadHourlyData(this.currentHourIndex - 1);
      this.stopPlayback();
    }
  }
  
  nextHour() {
    if (this.currentHourIndex < this.manifest.hourly_files.length - 1) {
      this.loadHourlyData(this.currentHourIndex + 1);
      this.stopPlayback();
    }
  }
  
  showStatus(message) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = '#2ecc71';
    setTimeout(() => {
      status.textContent = '● Live';
      status.style.color = '#27ae60';
    }, 3000);
  }
  
  showError(message) {
    const status = document.getElementById('status');
    status.textContent = `⚠ ${message}`;
    status.style.color = '#e74c3c';
  }
}

// Initialize globe when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.globe = new WeatherGlobe();
});
