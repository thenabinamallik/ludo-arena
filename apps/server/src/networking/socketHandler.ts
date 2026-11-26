import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@ludo-arena/shared-types';
import {
  assignColorSchema,
  createRoomSchema,
  diceRollSchema,
  hostActionSchema,
  joinRoomSchema,
  leaveRoomSchema,
  pawnMoveSchema,
  playerReadySchema,
  reconnectHostSchema,
  removePlayerSchema,
  updateRulesSchema,
} from '@ludo-arena/validation';
import type { RoomManager } from '../rooms/roomManager.js';

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: TypedIO, roomManager: RoomManager): void {
  io.on('connection', (socket: TypedSocket) => {
    socket.on('room:create', (rawPayload, cb) => {
      const parsed = createRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message ?? 'Invalid room configuration',
        });
      }
      const created = roomManager.createRoom(parsed.data, socket.id);
      socket.join(created.roomId);
      cb({ ok: true, data: created });
    });

    socket.on('host:recover', (rawPayload, cb) => {
      const parsed = reconnectHostSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message ?? 'Invalid host credentials',
        });
      }
      const result = roomManager.recoverHost(
        parsed.data.roomId,
        parsed.data.hostToken,
        socket.id
      );
      if (!result.ok) {
        return cb({ ok: false, code: result.code, error: result.error });
      }
      socket.join(parsed.data.roomId);
      cb({ ok: true, data: { roomState: result.roomState } });
    });

    socket.on('room:join', (rawPayload, cb) => {
      const parsed = joinRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({
          ok: false,
          code: 'VALIDATION_ERROR',
          error: parsed.error.issues[0]?.message ?? 'Invalid join request',
        });
      }
      const result = roomManager.joinRoom(parsed.data, socket.id);
      if (!result.ok) {
        return cb({ ok: false, code: result.code, error: result.error });
      }
      socket.join(parsed.data.roomId);
      cb({
        ok: true,
        data: {
          roomId: parsed.data.roomId,
          role: result.role,
          participantId: result.participantId,
          sessionToken: result.sessionToken,
          roomState: result.roomState,
        },
      });
    });

    socket.on('room:leave', (rawPayload, cb) => {
      const parsed = leaveRoomSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid leave payload' });
      }
      const res = roomManager.leaveRoom(
        parsed.data.roomId,
        parsed.data.participantId,
        parsed.data.sessionToken
      );
      socket.leave(parsed.data.roomId);
      cb(res);
    });

    socket.on('player:ready', (rawPayload, cb) => {
      const parsed = playerReadySchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid ready payload' });
      }
      cb(
        roomManager.setPlayerReady(
          parsed.data.roomId,
          parsed.data.playerId,
          parsed.data.sessionToken,
          parsed.data.ready
        )
      );
    });

    socket.on('player:assign_color', (rawPayload, cb) => {
      const parsed = assignColorSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid color request' });
      }
      cb(roomManager.assignColor(parsed.data));
    });

    socket.on('player:kick', (rawPayload, cb) => {
      const parsed = removePlayerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid kick request' });
      }
      cb(
        roomManager.kickPlayer(
          parsed.data.roomId,
          parsed.data.hostToken,
          parsed.data.targetPlayerId
        )
      );
    });

    socket.on('room:update_rules', (rawPayload, cb) => {
      const parsed = updateRulesSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid rules update' });
      }
      cb(roomManager.updateRules(parsed.data));
    });

    socket.on('game:start', (rawPayload, cb) => {
      const parsed = hostActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid start request' });
      }
      cb(roomManager.startMatch(parsed.data.roomId, parsed.data.hostToken));
    });

    socket.on('game:pause', (rawPayload, cb) => {
      const parsed = hostActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid pause request' });
      }
      cb(roomManager.pauseMatch(parsed.data.roomId, parsed.data.hostToken));
    });

    socket.on('game:resume', (rawPayload, cb) => {
      const parsed = hostActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid resume request' });
      }
      cb(roomManager.resumeMatch(parsed.data.roomId, parsed.data.hostToken));
    });

    socket.on('game:restart', (rawPayload, cb) => {
      const parsed = hostActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid restart request' });
      }
      cb(roomManager.restartMatch(parsed.data.roomId, parsed.data.hostToken));
    });

    socket.on('game:end', (rawPayload, cb) => {
      const parsed = hostActionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid end request' });
      }
      cb(roomManager.endMatch(parsed.data.roomId, parsed.data.hostToken));
    });

    socket.on('dice:roll', (rawPayload, cb) => {
      const parsed = diceRollSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid dice roll payload' });
      }
      const res = roomManager.rollDice(parsed.data);
      if (!res.ok) {
        return cb({ ok: false, code: res.code, error: res.error });
      }
      cb({ ok: true, data: res.event });
    });

    socket.on('pawn:move', (rawPayload, cb) => {
      const parsed = pawnMoveSchema.safeParse(rawPayload);
      if (!parsed.success) {
        return cb({ ok: false, code: 'VALIDATION_ERROR', error: 'Invalid pawn move payload' });
      }
      const res = roomManager.movePawn(parsed.data);
      if (!res.ok) {
        return cb({ ok: false, code: res.code, error: res.error });
      }
      cb({ ok: true, data: res.event });
    });

    socket.on('disconnect', () => {
      roomManager.handleSocketDisconnect(socket.id);
    });
  });
}
