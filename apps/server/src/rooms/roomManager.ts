import { getBoardConfig } from '@ludo-arena/board-config';
import {
  applyDiceRoll,
  applyPawnMove,
  applyTurnTimeout,
  createInitialMatchState,
  generateSecureDiceValue,
} from '@ludo-arena/game-engine';
import {
  ALL_PLAYER_COLORS,
  PLAYER_AVATARS,
  RULE_PRESETS,
  type ColorMode,
  type CreateRoomPayload,
  type DiceResultEvent,
  type GameFinishedEvent,
  type GameNotification,
  type GameRulesConfig,
  type JoinRoomPayload,
  type MatchHistoryRecord,
  type PawnMovedEvent,
  type PlayerAvatar,
  type PlayerColor,
  type PlayerInfo,
  type PlayerMatchStats,
  type RoomState,
  type SpectatorInfo,
  type TurnChangedEvent,
} from '@ludo-arena/shared-types';
import {
  generateParticipantId,
  generateRoomId,
  generateSecureToken,
} from '../security/tokens.js';
import type { LudoDatabase } from '../storage/database.js';

export interface RoomCallbacks {
  onRoomState: (roomId: string, state: RoomState) => void;
  onDiceResult: (roomId: string, event: DiceResultEvent) => void;
  onPawnMoved: (roomId: string, event: PawnMovedEvent) => void;
  onTurnChanged: (roomId: string, event: TurnChangedEvent) => void;
  onGameFinished: (roomId: string, event: GameFinishedEvent) => void;
  onPlayerDisconnect: (roomId: string, playerId: string, name: string) => void;
  onRoomClosed: (roomId: string, reason: string) => void;
}

interface InternalRoom {
  state: RoomState;
  hostToken: string;
  hostSocketId: string | null;
  participantTokens: Map<string, { role: 'player' | 'spectator'; participantId: string }>;
  socketToParticipant: Map<string, { role: 'player' | 'spectator'; participantId: string }>;
  turnTimer: NodeJS.Timeout | null;
}

function emptyStats(): PlayerMatchStats {
  return {
    rolls: 0,
    sixes: 0,
    moves: 0,
    captures: 0,
    capturedCount: 0,
    pawnsHome: 0,
    timeouts: 0,
  };
}

function pushNotification(
  room: RoomState,
  type: GameNotification['type'],
  message: string,
  player?: PlayerInfo
): void {
  const notif: GameNotification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    playerId: player?.id,
    color: player?.color ?? undefined,
    timestamp: Date.now(),
  };
  room.notifications.unshift(notif);
  if (room.notifications.length > 40) {
    room.notifications.length = 40;
  }
}

export class RoomManager {
  private rooms = new Map<string, InternalRoom>();

  constructor(
    private db: LudoDatabase,
    private callbacks: RoomCallbacks
  ) {
    this.restorePersistedRooms();
  }

  private restorePersistedRooms(): void {
    const persisted = this.db.loadAllActiveRooms();
    for (const record of persisted) {
      const state = record.roomState;
      state.hostConnected = false;
      for (const p of state.players) {
        p.connected = false;
      }
      for (const s of state.spectators) {
        s.connected = false;
      }
      // Pause active timer safely on server restart until host/players reconnect
      if (state.match && state.match.status === 'playing' && state.match.turnExpiresAt) {
        state.match.pausedRemainingTurnMs = Math.max(
          5000,
          state.match.turnExpiresAt - Date.now()
        );
        state.match.status = 'paused';
      }

      const participantTokens = new Map(Object.entries(record.participantTokens));
      this.rooms.set(record.roomId, {
        state,
        hostToken: record.hostToken,
        hostSocketId: null,
        participantTokens,
        socketToParticipant: new Map(),
        turnTimer: null,
      });
    }
  }

  private persist(internal: InternalRoom): void {
    internal.state.updatedAt = Date.now();
    this.db.saveRoom({
      roomId: internal.state.roomId,
      hostToken: internal.hostToken,
      roomState: internal.state,
      participantTokens: Object.fromEntries(internal.participantTokens.entries()),
      updatedAt: internal.state.updatedAt,
    });
  }

  private emitState(internal: InternalRoom): void {
    internal.state.version += 1;
    this.persist(internal);
    this.callbacks.onRoomState(internal.state.roomId, internal.state);
  }

  private clearTurnTimer(internal: InternalRoom): void {
    if (internal.turnTimer) {
      clearTimeout(internal.turnTimer);
      internal.turnTimer = null;
    }
  }

  private scheduleTurnTimer(internal: InternalRoom): void {
    this.clearTurnTimer(internal);
    const match = internal.state.match;
    if (!match || match.status !== 'playing' || !match.turnExpiresAt) return;

    const delay = Math.max(50, match.turnExpiresAt - Date.now());
    internal.turnTimer = setTimeout(() => {
      this.handleTurnTimeout(internal.state.roomId);
    }, delay);
  }

  private handleTurnTimeout(roomId: string): void {
    const internal = this.rooms.get(roomId);
    if (!internal || !internal.state.match) return;
    if (internal.state.match.status !== 'playing') return;

    const { state: nextMatch, updatedPlayers } = applyTurnTimeout(
      internal.state.match,
      internal.state.players,
      internal.state.rules,
      Date.now()
    );
    internal.state.match = nextMatch;
    internal.state.players = updatedPlayers;

    if (nextMatch.lastEvent) {
      internal.state.notifications.unshift(nextMatch.lastEvent);
      if (internal.state.notifications.length > 40) internal.state.notifications.length = 40;
    }

    this.emitState(internal);
    this.callbacks.onTurnChanged(roomId, {
      roomId,
      activePlayerId: nextMatch.activePlayerId,
      turnPhase: nextMatch.turnPhase,
      turnExpiresAt: nextMatch.turnExpiresAt,
      reason: 'timeout',
      version: nextMatch.version,
    });
    this.scheduleTurnTimer(internal);
  }

  getRoomState(roomId: string): RoomState | null {
    return this.rooms.get(roomId.toUpperCase())?.state ?? null;
  }

  listRooms(): RoomState[] {
    return Array.from(this.rooms.values()).map((r) => r.state);
  }

  createRoom(
    payload: CreateRoomPayload,
    hostSocketId: string | null = null
  ): { roomId: string; hostToken: string; roomState: RoomState } {
    let roomId = generateRoomId(6);
    while (this.rooms.has(roomId)) {
      roomId = generateRoomId(6);
    }

    const hostToken = generateSecureToken(24);
    const board = getBoardConfig(payload.playerCountMode);
    const presetKey =
      payload.rules?.preset && payload.rules.preset !== 'custom'
        ? payload.rules.preset
        : 'classic';
    const baseRules = RULE_PRESETS[presetKey];
    const rules: GameRulesConfig = {
      ...baseRules,
      ...payload.rules,
      preset: payload.rules?.preset ?? baseRules.preset,
    };

    const availableColors: PlayerColor[] =
      payload.availableColors && payload.availableColors.length >= payload.playerCountMode
        ? Array.from(new Set(payload.availableColors))
        : [...board.defaultColors];

    const now = Date.now();
    const state: RoomState = {
      roomId,
      version: 1,
      hostConnected: hostSocketId !== null,
      playerCountMode: payload.playerCountMode,
      maxPlayers: payload.playerCountMode,
      colorMode: payload.colorMode ?? 'auto',
      availableColors,
      rules,
      players: [],
      spectators: [],
      match: null,
      notifications: [],
      createdAt: now,
      updatedAt: now,
    };

    pushNotification(state, 'system', `Room ${roomId} created for ${payload.playerCountMode} players.`);

    const internal: InternalRoom = {
      state,
      hostToken,
      hostSocketId,
      participantTokens: new Map(),
      socketToParticipant: new Map(),
      turnTimer: null,
    };

    this.rooms.set(roomId, internal);
    this.persist(internal);

    return { roomId, hostToken, roomState: state };
  }

  recoverHost(
    roomId: string,
    hostToken: string,
    socketId: string | null
  ): { ok: true; roomState: RoomState } | { ok: false; error: string; code: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) {
      return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Invalid host token', code: 'UNAUTHORIZED_HOST' };
    }

    internal.hostSocketId = socketId;
    internal.state.hostConnected = true;
    pushNotification(internal.state, 'system', 'Host reconnected.');
    this.emitState(internal);
    return { ok: true, roomState: internal.state };
  }

  joinRoom(
    payload: JoinRoomPayload,
    socketId: string | null
  ):
    | {
        ok: true;
        role: 'player' | 'spectator';
        participantId: string;
        sessionToken: string;
        roomState: RoomState;
      }
    | { ok: false; error: string; code: string } {
    const roomId = payload.roomId.toUpperCase();
    const internal = this.rooms.get(roomId);
    if (!internal) {
      return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    }

    const now = Date.now();

    // Check reconnection via sessionToken
    if (payload.sessionToken) {
      const existingAuth = internal.participantTokens.get(payload.sessionToken);
      if (existingAuth) {
        if (existingAuth.role === 'player') {
          const player = internal.state.players.find((p) => p.id === existingAuth.participantId);
          if (player) {
            player.connected = true;
            player.lastSeenAt = now;
            if (socketId) {
              internal.socketToParticipant.set(socketId, existingAuth);
            }
            pushNotification(internal.state, 'system', `${player.name} reconnected.`, player);
            this.emitState(internal);
            return {
              ok: true,
              role: 'player',
              participantId: player.id,
              sessionToken: payload.sessionToken,
              roomState: internal.state,
            };
          }
        } else {
          const spec = internal.state.spectators.find((s) => s.id === existingAuth.participantId);
          if (spec) {
            spec.connected = true;
            if (socketId) {
              internal.socketToParticipant.set(socketId, existingAuth);
            }
            this.emitState(internal);
            return {
              ok: true,
              role: 'spectator',
              participantId: spec.id,
              sessionToken: payload.sessionToken,
              roomState: internal.state,
            };
          }
        }
      }
    }

    // Spectator join
    if (payload.spectator) {
      const specId = generateParticipantId('spec');
      const sessionToken = generateSecureToken(20);
      const spectator: SpectatorInfo = {
        id: specId,
        name: payload.name.trim(),
        connected: true,
        joinedAt: now,
      };
      internal.state.spectators.push(spectator);
      const auth = { role: 'spectator' as const, participantId: specId };
      internal.participantTokens.set(sessionToken, auth);
      if (socketId) internal.socketToParticipant.set(socketId, auth);
      pushNotification(internal.state, 'info', `${spectator.name} joined as spectator.`);
      this.emitState(internal);
      return {
        ok: true,
        role: 'spectator',
        participantId: specId,
        sessionToken,
        roomState: internal.state,
      };
    }

    // Player join
    if (internal.state.match && internal.state.match.status !== 'lobby') {
      return {
        ok: false,
        error: 'Match is already in progress. You can join as a spectator.',
        code: 'MATCH_IN_PROGRESS',
      };
    }

    if (internal.state.players.length >= internal.state.maxPlayers) {
      return {
        ok: false,
        error: 'Room is full. You can join as a spectator.',
        code: 'ROOM_FULL',
      };
    }

    // Prevent duplicate names in the same room
    const normalizedName = payload.name.trim().toLowerCase();
    if (internal.state.players.some((p) => p.name.trim().toLowerCase() === normalizedName)) {
      return {
        ok: false,
        error: 'That player name is already taken in this room.',
        code: 'DUPLICATE_NAME',
      };
    }

    const usedColors = new Set(
      internal.state.players.map((p) => p.color).filter((c): c is PlayerColor => c !== null)
    );

    let assignedColor: PlayerColor | null = null;
    if (payload.preferredColor) {
      if (!internal.state.availableColors.includes(payload.preferredColor)) {
        return {
          ok: false,
          error: 'Selected color is not enabled in this room.',
          code: 'COLOR_NOT_AVAILABLE',
        };
      }
      if (usedColors.has(payload.preferredColor)) {
        return {
          ok: false,
          error: 'Selected color is already taken.',
          code: 'COLOR_TAKEN',
        };
      }
      assignedColor = payload.preferredColor;
    } else if (internal.state.colorMode === 'auto') {
      assignedColor =
        internal.state.availableColors.find((c) => !usedColors.has(c)) ??
        ALL_PLAYER_COLORS.find((c) => !usedColors.has(c)) ??
        null;
    }

    // Determine lowest free seatIndex 0..(maxPlayers - 1)
    const usedSeats = new Set(internal.state.players.map((p) => p.seatIndex));
    let seatIndex = 0;
    while (usedSeats.has(seatIndex)) seatIndex++;

    const playerId = generateParticipantId('pl');
    const sessionToken = generateSecureToken(20);
    const avatar: PlayerAvatar =
      payload.avatar ?? PLAYER_AVATARS[seatIndex % PLAYER_AVATARS.length];

    const player: PlayerInfo = {
      id: playerId,
      name: payload.name.trim(),
      avatar,
      color: assignedColor,
      teamId: seatIndex % 2,
      ready: false,
      connected: true,
      seatIndex,
      joinedAt: now,
      lastSeenAt: now,
      stats: emptyStats(),
    };

    internal.state.players.push(player);
    internal.state.players.sort((a, b) => a.seatIndex - b.seatIndex);

    const auth = { role: 'player' as const, participantId: playerId };
    internal.participantTokens.set(sessionToken, auth);
    if (socketId) internal.socketToParticipant.set(socketId, auth);

    pushNotification(
      internal.state,
      'info',
      `${player.name} joined the lobby${assignedColor ? ` as ${assignedColor.toUpperCase()}` : ''}.`,
      player
    );
    this.emitState(internal);

    return {
      ok: true,
      role: 'player',
      participantId: playerId,
      sessionToken,
      roomState: internal.state,
    };
  }

  leaveRoom(
    roomId: string,
    participantId: string,
    sessionToken: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };

    const auth = internal.participantTokens.get(sessionToken);
    if (!auth || auth.participantId !== participantId) {
      return { ok: false, error: 'Invalid session token', code: 'UNAUTHORIZED' };
    }

    internal.participantTokens.delete(sessionToken);
    for (const [sockId, info] of internal.socketToParticipant.entries()) {
      if (info.participantId === participantId) {
        internal.socketToParticipant.delete(sockId);
      }
    }

    if (auth.role === 'spectator') {
      internal.state.spectators = internal.state.spectators.filter((s) => s.id !== participantId);
      this.emitState(internal);
      return { ok: true };
    }

    const player = internal.state.players.find((p) => p.id === participantId);
    if (!player) return { ok: true };

    if (!internal.state.match || internal.state.match.status === 'lobby') {
      internal.state.players = internal.state.players.filter((p) => p.id !== participantId);
      pushNotification(internal.state, 'info', `${player.name} left the lobby.`);
    } else {
      player.connected = false;
      pushNotification(internal.state, 'info', `${player.name} disconnected from the match.`, player);
    }

    this.emitState(internal);
    return { ok: true };
  }

  handleSocketDisconnect(socketId: string): void {
    for (const internal of this.rooms.values()) {
      if (internal.hostSocketId === socketId) {
        internal.hostSocketId = null;
        internal.state.hostConnected = false;
        this.emitState(internal);
      }

      const auth = internal.socketToParticipant.get(socketId);
      if (!auth) continue;
      internal.socketToParticipant.delete(socketId);

      // Only mark disconnected if no other socket is currently bound to this participant
      const stillConnected = Array.from(internal.socketToParticipant.values()).some(
        (v) => v.participantId === auth.participantId
      );
      if (stillConnected) continue;

      if (auth.role === 'player') {
        const player = internal.state.players.find((p) => p.id === auth.participantId);
        if (player) {
          player.connected = false;
          player.lastSeenAt = Date.now();
          this.emitState(internal);
          this.callbacks.onPlayerDisconnect(internal.state.roomId, player.id, player.name);
        }
      } else {
        const spec = internal.state.spectators.find((s) => s.id === auth.participantId);
        if (spec) {
          spec.connected = false;
          this.emitState(internal);
        }
      }
    }
  }

  setPlayerReady(
    roomId: string,
    playerId: string,
    sessionToken: string,
    ready: boolean
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };

    const auth = internal.participantTokens.get(sessionToken);
    if (!auth || auth.role !== 'player' || auth.participantId !== playerId) {
      return { ok: false, error: 'Unauthorized player session', code: 'UNAUTHORIZED' };
    }

    const player = internal.state.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

    if (ready && !player.color) {
      return {
        ok: false,
        error: 'Select a color before marking ready',
        code: 'COLOR_REQUIRED',
      };
    }

    player.ready = ready;
    this.emitState(internal);
    return { ok: true };
  }

  assignColor(params: {
    roomId: string;
    hostToken?: string;
    sessionToken?: string;
    targetPlayerId: string;
    color: PlayerColor;
  }): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(params.roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };

    if (internal.state.match && internal.state.match.status !== 'lobby') {
      return { ok: false, error: 'Cannot change colors after match starts', code: 'MATCH_STARTED' };
    }

    const isHost = params.hostToken !== undefined && params.hostToken === internal.hostToken;
    let isSelfPlayer = false;
    if (params.sessionToken) {
      const auth = internal.participantTokens.get(params.sessionToken);
      if (auth && auth.role === 'player' && auth.participantId === params.targetPlayerId) {
        isSelfPlayer = true;
      }
    }

    if (!isHost && !(isSelfPlayer && internal.state.colorMode === 'manual')) {
      return {
        ok: false,
        error: 'Not authorized to change this player color',
        code: 'UNAUTHORIZED',
      };
    }

    if (!internal.state.availableColors.includes(params.color)) {
      return { ok: false, error: 'Color is not enabled for this room', code: 'COLOR_NOT_AVAILABLE' };
    }

    const conflict = internal.state.players.find(
      (p) => p.id !== params.targetPlayerId && p.color === params.color
    );
    if (conflict) {
      return {
        ok: false,
        error: `${params.color} is already assigned to ${conflict.name}`,
        code: 'COLOR_TAKEN',
      };
    }

    const target = internal.state.players.find((p) => p.id === params.targetPlayerId);
    if (!target) return { ok: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

    target.color = params.color;
    pushNotification(
      internal.state,
      'info',
      `${target.name} was assigned ${params.color.toUpperCase()}.`,
      target
    );
    this.emitState(internal);
    return { ok: true };
  }

  kickPlayer(
    roomId: string,
    hostToken: string,
    targetPlayerId: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }

    const player = internal.state.players.find((p) => p.id === targetPlayerId);
    if (!player) return { ok: false, error: 'Player not found', code: 'PLAYER_NOT_FOUND' };

    internal.state.players = internal.state.players.filter((p) => p.id !== targetPlayerId);
    for (const [tok, auth] of internal.participantTokens.entries()) {
      if (auth.participantId === targetPlayerId) {
        internal.participantTokens.delete(tok);
      }
    }
    for (const [sockId, auth] of internal.socketToParticipant.entries()) {
      if (auth.participantId === targetPlayerId) {
        internal.socketToParticipant.delete(sockId);
      }
    }

    // Re-index seatIndices if still in lobby
    if (!internal.state.match) {
      internal.state.players.forEach((p, idx) => {
        p.seatIndex = idx;
        p.teamId = idx % 2;
      });
    }

    pushNotification(internal.state, 'system', `${player.name} was removed by the host.`);
    this.emitState(internal);
    return { ok: true };
  }

  updateRules(params: {
    roomId: string;
    hostToken: string;
    rules: Partial<GameRulesConfig>;
    colorMode?: ColorMode;
    availableColors?: PlayerColor[];
  }): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(params.roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== params.hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }

    if (internal.state.match && internal.state.match.status === 'playing') {
      return {
        ok: false,
        error: 'Pause or end the match before changing rules',
        code: 'MATCH_PLAYING',
      };
    }

    internal.state.rules = {
      ...internal.state.rules,
      ...params.rules,
    };

    if (params.availableColors && params.availableColors.length >= internal.state.playerCountMode) {
      internal.state.availableColors = Array.from(new Set(params.availableColors));
    }

    if (params.colorMode) {
      internal.state.colorMode = params.colorMode;
      if (params.colorMode === 'auto') {
        const used = new Set(
          internal.state.players.map((p) => p.color).filter((c): c is PlayerColor => c !== null)
        );
        for (const player of internal.state.players) {
          if (!player.color) {
            const free = internal.state.availableColors.find((c) => !used.has(c));
            if (free) {
              player.color = free;
              used.add(free);
            }
          }
        }
      }
    }

    pushNotification(internal.state, 'system', 'Host updated room configuration.');
    this.emitState(internal);
    return { ok: true };
  }

  startMatch(
    roomId: string,
    hostToken: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }

    if (internal.state.players.length < 2) {
      return { ok: false, error: 'Need at least 2 players to start', code: 'NOT_ENOUGH_PLAYERS' };
    }

    if (internal.state.players.some((p) => !p.color)) {
      return {
        ok: false,
        error: 'All players must have an assigned color before starting',
        code: 'COLORS_UNASSIGNED',
      };
    }

    const colors = internal.state.players.map((p) => p.color);
    if (new Set(colors).size !== colors.length) {
      return { ok: false, error: 'Duplicate player colors detected', code: 'DUPLICATE_COLORS' };
    }

    if (internal.state.players.some((p) => !p.ready)) {
      return {
        ok: false,
        error: 'All joined players must be ready before starting',
        code: 'PLAYERS_NOT_READY',
      };
    }

    // Reset match stats
    for (const p of internal.state.players) {
      p.stats = emptyStats();
    }

    const match = createInitialMatchState(
      internal.state.roomId,
      internal.state.playerCountMode,
      internal.state.players,
      internal.state.rules,
      Date.now()
    );
    internal.state.match = match;

    if (match.lastEvent) {
      internal.state.notifications.unshift(match.lastEvent);
    }

    this.emitState(internal);
    this.callbacks.onTurnChanged(internal.state.roomId, {
      roomId: internal.state.roomId,
      activePlayerId: match.activePlayerId,
      turnPhase: match.turnPhase,
      turnExpiresAt: match.turnExpiresAt,
      reason: 'match_start',
      version: match.version,
    });
    this.scheduleTurnTimer(internal);
    return { ok: true };
  }

  pauseMatch(
    roomId: string,
    hostToken: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }
    if (!internal.state.match || internal.state.match.status !== 'playing') {
      return { ok: false, error: 'No active playing match to pause', code: 'INVALID_STATE' };
    }

    this.clearTurnTimer(internal);
    internal.state.match.pausedRemainingTurnMs = internal.state.match.turnExpiresAt
      ? Math.max(1000, internal.state.match.turnExpiresAt - Date.now())
      : internal.state.rules.turnTimeoutSeconds * 1000;
    internal.state.match.status = 'paused';
    internal.state.match.version += 1;
    pushNotification(internal.state, 'system', 'Match paused by host.');
    this.emitState(internal);
    return { ok: true };
  }

  resumeMatch(
    roomId: string,
    hostToken: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }
    if (!internal.state.match || internal.state.match.status !== 'paused') {
      return { ok: false, error: 'Match is not paused', code: 'INVALID_STATE' };
    }

    const remaining =
      internal.state.match.pausedRemainingTurnMs ??
      internal.state.rules.turnTimeoutSeconds * 1000;
    internal.state.match.status = 'playing';
    internal.state.match.turnExpiresAt = Date.now() + remaining;
    internal.state.match.pausedRemainingTurnMs = null;
    internal.state.match.version += 1;
    pushNotification(internal.state, 'system', 'Match resumed by host.');
    this.emitState(internal);
    this.scheduleTurnTimer(internal);
    return { ok: true };
  }

  restartMatch(
    roomId: string,
    hostToken: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }
    if (internal.state.players.length < 2) {
      return { ok: false, error: 'Need at least 2 players to restart', code: 'NOT_ENOUGH_PLAYERS' };
    }

    this.clearTurnTimer(internal);
    for (const p of internal.state.players) {
      p.stats = emptyStats();
      p.ready = true;
    }

    const match = createInitialMatchState(
      internal.state.roomId,
      internal.state.playerCountMode,
      internal.state.players,
      internal.state.rules,
      Date.now()
    );
    internal.state.match = match;
    pushNotification(internal.state, 'system', 'Match restarted! Fresh board ready.');
    this.emitState(internal);
    this.callbacks.onTurnChanged(internal.state.roomId, {
      roomId: internal.state.roomId,
      activePlayerId: match.activePlayerId,
      turnPhase: match.turnPhase,
      turnExpiresAt: match.turnExpiresAt,
      reason: 'match_start',
      version: match.version,
    });
    this.scheduleTurnTimer(internal);
    return { ok: true };
  }

  endMatch(
    roomId: string,
    hostToken: string
  ): { ok: boolean; error?: string; code?: string } {
    const internal = this.rooms.get(roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };
    if (internal.hostToken !== hostToken) {
      return { ok: false, error: 'Unauthorized host action', code: 'UNAUTHORIZED_HOST' };
    }

    this.clearTurnTimer(internal);
    internal.state.match = null;
    for (const p of internal.state.players) {
      p.ready = false;
      p.stats = emptyStats();
    }
    pushNotification(internal.state, 'system', 'Match ended by host. Returned to lobby.');
    this.emitState(internal);
    return { ok: true };
  }

  rollDice(params: {
    roomId: string;
    playerId: string;
    sessionToken: string;
    actionId: string;
    expectedVersion?: number;
  }): { ok: true; event: DiceResultEvent } | { ok: false; error: string; code: string } {
    const internal = this.rooms.get(params.roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };

    const auth = internal.participantTokens.get(params.sessionToken);
    if (!auth || auth.role !== 'player' || auth.participantId !== params.playerId) {
      return { ok: false, error: 'Unauthorized player session', code: 'UNAUTHORIZED' };
    }

    const match = internal.state.match;
    if (!match) {
      return { ok: false, error: 'Match has not started', code: 'MATCH_NOT_STARTED' };
    }

    if (
      params.expectedVersion !== undefined &&
      params.expectedVersion !== match.version
    ) {
      return { ok: false, error: 'Stale game state version', code: 'VERSION_MISMATCH' };
    }

    const diceValue = generateSecureDiceValue();
    const prevActive = match.activePlayerId;
    const result = applyDiceRoll(
      match,
      internal.state.players,
      internal.state.rules,
      params.playerId,
      diceValue,
      params.actionId,
      Date.now()
    );

    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? 'Failed to roll dice',
        code: result.code ?? 'ROLL_FAILED',
      };
    }

    internal.state.match = result.state;
    internal.state.players = result.updatedPlayers;
    if (result.state.lastEvent) {
      internal.state.notifications.unshift(result.state.lastEvent);
      if (internal.state.notifications.length > 40) internal.state.notifications.length = 40;
    }

    const roller = internal.state.players.find((p) => p.id === params.playerId)!;
    const diceEvent: DiceResultEvent = {
      roomId: internal.state.roomId,
      playerId: params.playerId,
      color: roller.color!,
      diceValue,
      consecutiveSixes: result.state.consecutiveSixes,
      legalMoves: result.legalMoves,
      forfeitedByThreeSixes: result.forfeitedByThreeSixes,
      noLegalMoves: result.noLegalMoves,
      version: result.state.version,
    };

    this.emitState(internal);
    this.callbacks.onDiceResult(internal.state.roomId, diceEvent);

    if (result.forfeitedByThreeSixes || result.noLegalMoves || result.state.activePlayerId !== prevActive) {
      this.callbacks.onTurnChanged(internal.state.roomId, {
        roomId: internal.state.roomId,
        activePlayerId: result.state.activePlayerId,
        turnPhase: result.state.turnPhase,
        turnExpiresAt: result.state.turnExpiresAt,
        reason: result.forfeitedByThreeSixes ? 'three_sixes' : 'no_moves',
        version: result.state.version,
      });
    }

    this.scheduleTurnTimer(internal);
    return { ok: true, event: diceEvent };
  }

  movePawn(params: {
    roomId: string;
    playerId: string;
    sessionToken: string;
    pawnId: string;
    actionId: string;
    expectedVersion?: number;
  }): { ok: true; event: PawnMovedEvent } | { ok: false; error: string; code: string } {
    const internal = this.rooms.get(params.roomId.toUpperCase());
    if (!internal) return { ok: false, error: 'Room not found', code: 'ROOM_NOT_FOUND' };

    const auth = internal.participantTokens.get(params.sessionToken);
    if (!auth || auth.role !== 'player' || auth.participantId !== params.playerId) {
      return { ok: false, error: 'Unauthorized player session', code: 'UNAUTHORIZED' };
    }

    const match = internal.state.match;
    if (!match) {
      return { ok: false, error: 'Match has not started', code: 'MATCH_NOT_STARTED' };
    }

    if (
      params.expectedVersion !== undefined &&
      params.expectedVersion !== match.version
    ) {
      return { ok: false, error: 'Stale game state version', code: 'VERSION_MISMATCH' };
    }

    const prevActive = match.activePlayerId;
    const result = applyPawnMove(
      match,
      internal.state.players,
      internal.state.rules,
      params.playerId,
      params.pawnId,
      params.actionId,
      Date.now()
    );

    if (!result.ok || !result.moveOption) {
      return {
        ok: false,
        error: result.error ?? 'Illegal pawn move',
        code: result.code ?? 'MOVE_FAILED',
      };
    }

    internal.state.match = result.state;
    internal.state.players = result.updatedPlayers;
    if (result.state.lastEvent) {
      internal.state.notifications.unshift(result.state.lastEvent);
      if (internal.state.notifications.length > 40) internal.state.notifications.length = 40;
    }

    const movedEvent: PawnMovedEvent = {
      roomId: internal.state.roomId,
      playerId: params.playerId,
      pawnId: params.pawnId,
      fromProgress: result.moveOption.fromProgress,
      toProgress: result.moveOption.toProgress,
      capturedPawnIds: result.moveOption.capturedPawnIds,
      reachedHome: result.moveOption.willReachHome,
      grantsExtraTurn: result.moveOption.grantsExtraTurn,
      version: result.state.version,
    };

    this.emitState(internal);
    this.callbacks.onPawnMoved(internal.state.roomId, movedEvent);

    if (result.matchFinished) {
      this.clearTurnTimer(internal);
      const historyRecord = this.recordCompletedMatch(internal);
      this.callbacks.onGameFinished(internal.state.roomId, {
        roomId: internal.state.roomId,
        winnerId: result.state.rankings[0] ?? null,
        winningTeamId: result.state.winningTeamId,
        rankings: result.state.rankings,
        historyRecord,
      });
    } else {
      this.callbacks.onTurnChanged(internal.state.roomId, {
        roomId: internal.state.roomId,
        activePlayerId: result.state.activePlayerId,
        turnPhase: result.state.turnPhase,
        turnExpiresAt: result.state.turnExpiresAt,
        reason:
          result.state.activePlayerId === prevActive && result.moveOption.grantsExtraTurn
            ? 'extra_turn'
            : 'next_player',
        version: result.state.version,
      });
      this.scheduleTurnTimer(internal);
    }

    return { ok: true, event: movedEvent };
  }

  private recordCompletedMatch(internal: InternalRoom): MatchHistoryRecord {
    const match = internal.state.match!;
    const playerMap = new Map(internal.state.players.map((p) => [p.id, p]));
    const winnerId = match.rankings[0] ?? null;
    const winner = winnerId ? playerMap.get(winnerId) : undefined;
    const startedAt = match.startedAt ?? internal.state.createdAt;
    const finishedAt = match.finishedAt ?? Date.now();

    const record: MatchHistoryRecord = {
      id: `match-${internal.state.roomId}-${finishedAt}`,
      roomId: internal.state.roomId,
      playerCountMode: internal.state.playerCountMode,
      teamMode: internal.state.rules.teamMode,
      winnerId,
      winnerName: winner?.name ?? null,
      winnerColor: winner?.color ?? null,
      winningTeamId: match.winningTeamId,
      rankings: match.rankings.map((pid, idx) => {
        const p = playerMap.get(pid)!;
        return {
          playerId: p.id,
          name: p.name,
          color: p.color ?? 'red',
          avatar: p.avatar,
          rank: idx + 1,
          teamId: p.teamId,
          stats: p.stats,
        };
      }),
      turnCount: match.turnCount,
      durationMs: Math.max(0, finishedAt - startedAt),
      rules: internal.state.rules,
      startedAt,
      finishedAt,
    };

    this.db.saveMatchHistory(record);
    return record;
  }

  destroy(): void {
    for (const internal of this.rooms.values()) {
      this.clearTurnTimer(internal);
    }
  }
}
