import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@ludo-arena/shared-types';
import { generateJoinQrDataUrl, getLanNetworkInfo } from './networking/lan.js';
import { registerSocketHandlers } from './networking/socketHandler.js';
import { RoomManager } from './rooms/roomManager.js';
import { LudoDatabase } from './storage/database.js';

export interface CreateServerOptions {
  port?: number;
  dbPath?: string;
  staticDir?: string;
}

export interface LudoServerInstance {
  app: express.Express;
  httpServer: HttpServer;
  io: ServerType;
  db: LudoDatabase;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

type ServerType = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

export function createLudoServer(options: CreateServerOptions = {}): LudoServerInstance {
  const port = options.port ?? Number(process.env.PORT || 3001);
  const dbPath =
    options.dbPath ??
    process.env.LUDO_DB_PATH ??
    path.resolve(process.cwd(), 'data', 'ludo-arena.db');

  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = createServer(app);
  const io: ServerType = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 20000,
  });

  const db = new LudoDatabase(dbPath);
  const roomManager = new RoomManager(db, {
    onRoomState: (roomId, state) => {
      io.to(roomId).emit('room:state', state);
    },
    onDiceResult: (roomId, event) => {
      io.to(roomId).emit('dice:result', event);
    },
    onPawnMoved: (roomId, event) => {
      io.to(roomId).emit('pawn:moved', event);
    },
    onTurnChanged: (roomId, event) => {
      io.to(roomId).emit('turn:changed', event);
    },
    onGameFinished: (roomId, event) => {
      io.to(roomId).emit('game:finished', event);
    },
    onPlayerDisconnect: (roomId, playerId, name) => {
      io.to(roomId).emit('player:disconnect', { roomId, playerId, name });
    },
    onRoomClosed: (roomId, reason) => {
      io.to(roomId).emit('room:closed', { roomId, reason });
    },
  });

  registerSocketHandlers(io, roomManager);

  // REST API endpoints for companion status, LAN IP discovery, QR generation, and history
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'ludo-arena-companion',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      activeRooms: roomManager.listRooms().length,
    });
  });

  app.get('/api/lan-info', (_req, res) => {
    const addr = httpServer.address();
    const activePort = typeof addr === 'object' && addr ? addr.port : port;
    res.json(getLanNetworkInfo(activePort));
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const room = roomManager.getRoomState(req.params.roomId);
    if (!room) {
      res.status(404).json({ ok: false, error: 'Room not found' });
      return;
    }
    res.json({
      ok: true,
      room: {
        roomId: room.roomId,
        playerCountMode: room.playerCountMode,
        maxPlayers: room.maxPlayers,
        colorMode: room.colorMode,
        availableColors: room.availableColors,
        takenColors: room.players.map((p) => p.color).filter(Boolean),
        playerCount: room.players.length,
        spectatorCount: room.spectators.length,
        status: room.match?.status ?? 'lobby',
        teamMode: room.rules.teamMode,
      },
    });
  });

  app.get('/api/qr/:roomId', async (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const addr = httpServer.address();
    const activePort = typeof addr === 'object' && addr ? addr.port : port;
    const lanInfo = getLanNetworkInfo(activePort);
    const customOrigin =
      typeof req.query.origin === 'string' && /^https?:\/\//i.test(req.query.origin)
        ? req.query.origin.replace(/\/+$/, '')
        : null;
    const preferredIp =
      (typeof req.query.ip === 'string' && req.query.ip) ||
      lanInfo.primaryIp ||
      'localhost';
    const webPort =
      typeof req.query.webPort === 'string' && req.query.webPort
        ? Number(req.query.webPort)
        : activePort;
    const joinUrl = customOrigin
      ? `${customOrigin}/join/${roomId}`
      : `http://${preferredIp}:${webPort}/join/${roomId}`;
    const qrDataUrl = await generateJoinQrDataUrl(joinUrl);
    res.json({ ok: true, roomId, joinUrl, qrDataUrl, lanInfo });
  });

  app.get('/api/history', (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    res.json({ ok: true, records: db.listMatchHistory(limit) });
  });

  app.delete('/api/history', (_req, res) => {
    db.clearMatchHistory();
    res.json({ ok: true });
  });

  app.get('/api/settings', (_req, res) => {
    res.json({
      ok: true,
      settings: db.getSetting('defaultPreferences', {
        theme: 'dark',
        soundEnabled: true,
        musicEnabled: false,
      }),
    });
  });

  app.put('/api/settings', (req, res) => {
    db.setSetting('defaultPreferences', req.body);
    res.json({ ok: true });
  });

  // Serve built React frontend in production so LAN clients only need one port!
  if (options.staticDir && existsSync(options.staticDir)) {
    app.use(express.static(options.staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(options.staticDir!, 'index.html'));
    });
  }

  return {
    app,
    httpServer,
    io,
    db,
    roomManager,
    close: async () => {
      roomManager.destroy();
      await new Promise<void>((resolve) => {
        io.close(() => {
          if (httpServer.listening) {
            httpServer.close(() => resolve());
          } else {
            resolve();
          }
        });
      });
      db.close();
    },
  };
}
