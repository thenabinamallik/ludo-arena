# Deploying LUDO ARENA to Vercel

The repository includes a root [`vercel.json`](../vercel.json) configured for the monorepo frontend (`apps/web`) with SPA route rewrites for all 14 screens.

## Important Architecture Note

Vercel hosts static sites and stateless serverless functions, which **do not** support long-lived Socket.IO WebSocket connections or persistent local SQLite files. All gameplay, Socket.IO rooms, dice generation, and SQLite persistence remain unchanged in `apps/server`.

You can pair the Vercel-hosted frontend with `apps/server` in two ways:

### Option 1: Vercel UI + Local LAN Companion Service (Same Wi-Fi)
1. Deploy the repository to Vercel (Vercel automatically picks up `vercel.json`).
2. On the host laptop/PC, run the companion coordinator locally (`npm start` or `start-host.bat`).
3. On the Vercel site, open **LAN Help** (`/troubleshoot`), set **Coordinator Server URL** to `http://localhost:3001`, and click **Save & Reconnect**.
4. Create a room on the host browser — the QR code automatically uses your PC's LAN IP (`http://<LAN-IP>:3001/join/<ROOM-ID>`) so phones on Wi-Fi load the game directly from your companion service without mixed-content blocks.

### Option 2: Vercel UI + Hosted Node Coordinator (Play Anywhere)
1. Deploy `apps/server` to a persistent Node host (Render, Railway, Fly.io, or a VPS):
   - Build command: `npm install && npm run build --workspace=@ludo-arena/shared-types && npm run build --workspace=@ludo-arena/validation && npm run build --workspace=@ludo-arena/board-config && npm run build --workspace=@ludo-arena/game-engine && npm run build --workspace=@ludo-arena/server`
   - Start command: `npm run start --workspace=@ludo-arena/server`
2. In your Vercel Project **Environment Variables**, set:
   ```
   VITE_SERVER_URL=https://your-node-server.example.com
   ```
3. Redeploy Vercel — all host, player, and spectator devices will connect over `https`/`wss` automatically, and QR codes will point to your Vercel domain.
