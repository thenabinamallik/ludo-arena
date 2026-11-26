#!/usr/bin/env pwsh
Set-Location $PSScriptRoot

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  LUDO ARENA - Local Companion Service Launcher" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

if (-not (Test-Path "apps/web/dist/index.html")) {
  Write-Host "Building production bundle..."
  npm run build
}

Start-Process "http://localhost:3001"
npm start
