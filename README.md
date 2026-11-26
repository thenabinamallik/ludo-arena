# LUDO ARENA — LAN Multiplayer Ludo Web Application

**LUDO ARENA** is a production-quality, offline-first local Wi-Fi multiplayer Ludo game with a **Host Board + Mobile Player Controllers** architecture supporting **2, 4, 6, and 8 players** plus live **Spectator Mode**.

## Architecture

- **Host Display (`apps/web`)**: React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, and custom SVG boards (15×15 classic cross for 2P/4P, 6-arm hexagonal board for 6P, 8-arm octagonal board for 8P).
- **Local Companion Service (`apps/server`)**: Node.js, Express, Socket.IO, QRCode generator, cryptographic dice (`node:crypto`), and SQLite (`node:sqlite`) persistence for host recovery and match history.
- **Shared Packages**:
  - `packages/shared-types`: Core state, rule, player, and Socket.IO event contracts.
  - `packages/validation`: Zod validation schemas for all network payloads.
  - `packages/board-config`: Exact coordinate & path geometries for 2, 4, 6, and 8-player boards.
  - `packages/game-engine`: Pure, deterministic, server-authoritative Ludo engine.

## Quick Start (Production / LAN Hosting)

1. **Install dependencies** (requires Node.js 22.5+ / Node 24 LTS):
   ```bash
   npm install
   ```
2. **Build all packages & frontend**:
   ```bash
   npm run build
   ```
3. **Start the Local Companion Coordinator**:
   - Windows: double-click `start-host.bat` (or run `.\start-host.ps1`)
   - macOS / Linux: run `./start-host.sh`
   - Or manually:
     ```bash
     npm start
     ```
4. Open `http://localhost:3001` in the host browser, click **Host a Game**, select **2, 4, 6, or 8 players**, and display the generated **QR Code** for players to scan on their phones!

## Development Mode

Run both the companion coordinator (`:3001`) and Vite dev server (`:5173` with LAN binding & proxy):
```bash
npm run dev
```

## Automated Tests

Run all unit, integration, SQLite persistence, host recovery, and real Socket.IO multiplayer tests:
```bash
npm test
```

## Documentation

- [LAN Hosting, QR Joining & Troubleshooting Guide](docs/LAN_HOSTING_GUIDE.md)
- [Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT.md)
- [Architecture & Game Engine Reference](docs/ARCHITECTURE.md)
