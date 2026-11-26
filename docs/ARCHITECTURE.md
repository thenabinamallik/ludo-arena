# LUDO ARENA — System Architecture

## Monorepo Layout

```
ludo-arena/
  apps/
    web/         # React 19 + Vite + Tailwind CSS + Framer Motion UI & SVG Boards
    server/      # Express + Socket.IO + node:sqlite Companion Coordinator
  packages/
    shared-types/  # Shared TypeScript interfaces, colors, presets, Socket.IO contracts
    validation/    # Zod runtime validation schemas
    board-config/  # Independent 2P, 4P, 6P, and 8P board geometries & paths
    game-engine/   # Pure deterministic Ludo state machine & cryptographic dice
  tests/
    unit/          # Board config, Zod validation, and game engine unit tests
    integration/   # SQLite persistence & host recovery tests
    multiplayer/   # Live Socket.IO client-server synchronization & security tests
  docs/            # Hosting & architecture documentation
```

## Board Topologies

| Mode | Outer Track Cells | Home Stretch | Safe Cells | Center Home |
|------|-------------------|--------------|------------|-------------|
| **2-Player** | 52 (Classic 15×15, opposite seats 0 & 26) | 5 per seat | 2 active starts + 4 stars | Square (2 active triangles) |
| **4-Player** | 52 (Classic 15×15 cross) | 5 per seat | 4 starts + 4 stars | Square (4 triangles) |
| **6-Player** | 78 (6 symmetrical arms × 13 cells) | 5 per seat | 6 starts + 6 stars | Regular Hexagon (6 triangles) |
| **8-Player** | 104 (8 symmetrical arms × 13 cells) | 5 per seat | 8 starts + 8 stars | Regular Octagon (8 triangles) |

## Security & Determinism

- Dice values are generated strictly on the server via `node:crypto` `randomInt(1, 7)`.
- Every `dice:roll` and `pawn:move` requires a valid `sessionToken`, active turn ownership, matching `turnPhase`, and a unique `actionId` (idempotency guard against duplicate taps).
- Host administrative actions (`game:start`, `game:pause`, `game:resume`, `game:restart`, `game:end`, `player:kick`, `room:update_rules`) verify the server-issued `hostToken`.
- Spectators receive read-only `room:state`, `dice:result`, `pawn:moved`, and `game:finished` broadcasts and are blocked from mutating game state.
