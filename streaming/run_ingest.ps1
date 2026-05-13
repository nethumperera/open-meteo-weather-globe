#!/usr/bin/env pwsh
# Local testing script for Open-Meteo ingest

Push-Location $PSScriptRoot

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
pip install -r requirements.txt

# Run ingest
Write-Host "Starting ingest..." -ForegroundColor Green
python ingest.py

# Check results
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Ingest completed. Check ../website/data/manifest.json" -ForegroundColor Green
} else {
    Write-Host "✗ Ingest failed" -ForegroundColor Red
}

Pop-Location
