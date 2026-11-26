# LUDO ARENA — LAN Hosting, QR Joining & Troubleshooting Guide

## Why a Local Companion Service?

Ordinary browser JavaScript cannot open a raw TCP/WebSocket server for other devices on your Wi-Fi network. LUDO ARENA solves this cleanly with a lightweight Node.js **Local Companion Service** (`apps/server`) that runs on the host computer:

1. Host starts the companion service (`npm start` or `start-host.bat`).
2. The companion service binds to `0.0.0.0:3001`, serves the entire web app statically (no internet needed!), and detects the host's active LAN IPv4 address.
3. Host opens `http://localhost:3001` in any modern browser and creates a room.
4. A **Room ID** and **QR Code** pointing to `http://<HOST-LAN-IP>:3001/join/<ROOM-ID>` are generated.
5. Players scan the QR code with their phone cameras and instantly load their mobile controllers over Wi-Fi.

## Step-by-Step QR Joining Instructions

1. Ensure the host laptop/PC and all player phones/tablets are connected to the **same Wi-Fi network** (or a single phone's Wi-Fi hotspot).
2. On the Host Dashboard, verify the **LAN IP** shown above the QR code (if you have VPN/Docker/VirtualBox adapters, select your Wi-Fi IP from the dropdown).
3. Players open their phone Camera app (or QR scanner) and scan the QR code.
4. Enter a display name, pick an avatar (and colour if Manual Colour Mode is enabled), and tap **Ready Up**.
5. Host clicks **Start Match**.

## Troubleshooting

### Phones cannot open the QR link
- **Windows Firewall**: Allow inbound TCP port `3001` on Private networks by running PowerShell as Administrator:
  ```powershell
  New-NetFirewallRule -DisplayName "LUDO ARENA LAN" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
  ```
- **Wrong Network Interface**: If the QR code shows a virtual adapter IP (such as `172.x.x.x` from WSL/Docker or `192.168.56.x` from VirtualBox), use the IP selector dropdown in the Host Dashboard's QR card to pick your Wi-Fi IP (`192.168.x.x` or `10.x.x.x`).
- **AP Isolation / Guest Wi-Fi**: Some public or guest routers isolate connected clients from talking to each other. Switch to a home/private Wi-Fi network or create a Wi-Fi hotspot on one device.

### Host browser accidentally refreshed during a match
- Reopen `http://localhost:3001/host/<ROOM-ID>` on the same browser.
- The host token stored in `localStorage` automatically calls `host:recover` and restores the entire board, player list, timers, and match controls from SQLite.

### Player lost Wi-Fi or refreshed phone browser
- Reopen the tab or scan the QR code again — if your browser still holds its session token, it automatically reconnects you to your exact seat and pawns.
