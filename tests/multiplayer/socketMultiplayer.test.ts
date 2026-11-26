import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  CreateRoomResponse,
  DiceResultEvent,
  JoinRoomResponse,
  RoomState,
  ServerToClientEvents,
  SocketAck,
} from '@ludo-arena/shared-types';
import { createLudoServer, type LudoServerInstance } from '@ludo-arena/server';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function emitAsync<T>(socket: ClientSocket, event: keyof ClientToServerEvents, payload: unknown): Promise<SocketAck<T>> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(event, payload, (res: SocketAck<T>) => resolve(res));
  });
}

describe('Real-Time Socket.IO Multiplayer Synchronization & Security', () => {
  let server: LudoServerInstance;
  let baseUrl: string;
  const sockets: ClientSocket[] = [];

  function connectClient(): Promise<ClientSocket> {
    return new Promise((resolve) => {
      const sock: ClientSocket = ioc(baseUrl, {
        transports: ['websocket'],
        forceNew: true,
      });
      sockets.push(sock);
      sock.on('connect', () => resolve(sock));
    });
  }

  beforeEach(async () => {
    server = createLudoServer({ port: 0, dbPath: ':memory:' });
    await new Promise<void>((resolve) => {
      server.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.httpServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3001;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const s of sockets) {
      s.disconnect();
    }
    sockets.length = 0;
    await server.close();
  });

  it('supports room creation, QR endpoint, manual color picking, duplicate rejection, and live sync', async () => {
    const host = await connectClient();
    const p1 = await connectClient();
    const p2 = await connectClient();
    const spectator = await connectClient();

    // 1. Host creates 6-player room with manual color mode
    const created = await emitAsync<CreateRoomResponse>(host, 'room:create', {
      playerCountMode: 6,
      colorMode: 'manual',
    });
    expect(created.ok).toBe(true);
    const { roomId, hostToken } = created.data!;

    // Verify REST QR & room summary endpoints work offline on LAN
    const qrRes = await fetch(`${baseUrl}/api/qr/${roomId}`);
    const qrJson = (await qrRes.json()) as { ok: boolean; qrDataUrl: string; joinUrl: string };
    expect(qrJson.ok).toBe(true);
    expect(qrJson.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(qrJson.joinUrl).toContain(`/join/${roomId}`);

    // 2. Players join and choose unique colors (duplicate color rejected)
    const j1 = await emitAsync<JoinRoomResponse>(p1, 'room:join', {
      roomId,
      name: 'Alice',
      preferredColor: 'orange',
    });
    expect(j1.ok).toBe(true);

    const j2DupColor = await emitAsync<JoinRoomResponse>(p2, 'room:join', {
      roomId,
      name: 'Bob',
      preferredColor: 'orange',
    });
    expect(j2DupColor.ok).toBe(false);
    expect(j2DupColor.code).toBe('COLOR_TAKEN');

    const j2 = await emitAsync<JoinRoomResponse>(p2, 'room:join', {
      roomId,
      name: 'Bob',
      preferredColor: 'purple',
    });
    expect(j2.ok).toBe(true);

    // Spectator joins
    const jSpec = await emitAsync<JoinRoomResponse>(spectator, 'room:join', {
      roomId,
      name: 'Watcher',
      spectator: true,
    });
    expect(jSpec.ok).toBe(true);
    expect(jSpec.data?.role).toBe('spectator');

    // Ready up both players
    await emitAsync(p1, 'player:ready', {
      roomId,
      playerId: j1.data!.participantId,
      sessionToken: j1.data!.sessionToken,
      ready: true,
    });
    await emitAsync(p2, 'player:ready', {
      roomId,
      playerId: j2.data!.participantId,
      sessionToken: j2.data!.sessionToken,
      ready: true,
    });

    // Non-host cannot start match
    const unauthorizedStart = await emitAsync(p1, 'game:start', {
      roomId,
      hostToken: 'fake-token-0000',
    });
    expect(unauthorizedStart.ok).toBe(false);

    // Host starts match; listen for room:state on spectator
    const spectatorStatePromise = new Promise<RoomState>((resolve) => {
      spectator.on('room:state', (st) => {
        if (st.match?.status === 'playing') resolve(st);
      });
    });

    const started = await emitAsync(host, 'game:start', { roomId, hostToken });
    expect(started.ok).toBe(true);

    const specState = await spectatorStatePromise;
    expect(specState.match?.activePlayerId).toBe(j1.data!.participantId);

    // Security: Spectator cannot roll dice
    const specRoll = await emitAsync(spectator, 'dice:roll', {
      roomId,
      playerId: jSpec.data!.participantId,
      sessionToken: jSpec.data!.sessionToken,
      actionId: 'spec-act-1',
    });
    expect(specRoll.ok).toBe(false);
    expect(specRoll.code).toBe('UNAUTHORIZED');

    // Security: Out-of-turn player (p2) cannot roll dice
    const p2Roll = await emitAsync(p2, 'dice:roll', {
      roomId,
      playerId: j2.data!.participantId,
      sessionToken: j2.data!.sessionToken,
      actionId: 'p2-act-1',
    });
    expect(p2Roll.ok).toBe(false);
    expect(p2Roll.code).toBe('NOT_YOUR_TURN');

    // Active player (p1) rolls dice; host & spectator receive dice:result
    const hostDicePromise = new Promise<DiceResultEvent>((resolve) => {
      host.once('dice:result', resolve);
    });

    const p1Roll = await emitAsync<DiceResultEvent>(p1, 'dice:roll', {
      roomId,
      playerId: j1.data!.participantId,
      sessionToken: j1.data!.sessionToken,
      actionId: 'p1-roll-1',
    });
    expect(p1Roll.ok).toBe(true);
    expect(p1Roll.data!.diceValue).toBeGreaterThanOrEqual(1);
    expect(p1Roll.data!.diceValue).toBeLessThanOrEqual(6);

    const hostDice = await hostDicePromise;
    expect(hostDice.diceValue).toBe(p1Roll.data!.diceValue);

    // Duplicate actionId is rejected
    const dupRoll = await emitAsync(p1, 'dice:roll', {
      roomId,
      playerId: j1.data!.participantId,
      sessionToken: j1.data!.sessionToken,
      actionId: 'p1-roll-1',
    });
    expect(dupRoll.ok).toBe(false);
  });

  it('handles player disconnect, reconnection, and host recovery seamlessly', async () => {
    const host = await connectClient();
    const p1 = await connectClient();
    const p2 = await connectClient();

    const created = await emitAsync<CreateRoomResponse>(host, 'room:create', {
      playerCountMode: 8,
    });
    const { roomId, hostToken } = created.data!;

    const j1 = await emitAsync<JoinRoomResponse>(p1, 'room:join', { roomId, name: 'PlayerOne' });
    const j2 = await emitAsync<JoinRoomResponse>(p2, 'room:join', { roomId, name: 'PlayerTwo' });

    await emitAsync(p1, 'player:ready', {
      roomId,
      playerId: j1.data!.participantId,
      sessionToken: j1.data!.sessionToken,
      ready: true,
    });
    await emitAsync(p2, 'player:ready', {
      roomId,
      playerId: j2.data!.participantId,
      sessionToken: j2.data!.sessionToken,
      ready: true,
    });
    await emitAsync(host, 'game:start', { roomId, hostToken });

    // Disconnect p1 and verify host receives disconnect notice
    const disconnectNotice = new Promise<{ playerId: string }>((resolve) => {
      host.once('player:disconnect', resolve);
    });
    p1.disconnect();
    const disc = await disconnectNotice;
    expect(disc.playerId).toBe(j1.data!.participantId);

    // Reconnect p1 from a new socket using sessionToken
    const p1New = await connectClient();
    const rejoin = await emitAsync<JoinRoomResponse>(p1New, 'room:join', {
      roomId,
      name: 'PlayerOne',
      sessionToken: j1.data!.sessionToken,
    });
    expect(rejoin.ok).toBe(true);
    expect(rejoin.data!.participantId).toBe(j1.data!.participantId);
    expect(rejoin.data!.roomState.players.find((p) => p.id === j1.data!.participantId)?.connected).toBe(true);

    // Host disconnects and recovers from a fresh socket
    host.disconnect();
    const hostNew = await connectClient();
    const recovered = await emitAsync<{ roomState: RoomState }>(hostNew, 'host:recover', {
      roomId,
      hostToken,
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.data!.roomState.hostConnected).toBe(true);

    // Recovered host can pause and resume match
    const paused = await emitAsync(hostNew, 'game:pause', { roomId, hostToken });
    expect(paused.ok).toBe(true);
    const resumed = await emitAsync(hostNew, 'game:resume', { roomId, hostToken });
    expect(resumed.ok).toBe(true);
  });

  it('completes a full 2-player match over Socket.IO, records SQLite history, and supports rematch', async () => {
    const host = await connectClient();
    const p1 = await connectClient();
    const p2 = await connectClient();

    const created = await emitAsync<CreateRoomResponse>(host, 'room:create', {
      playerCountMode: 2,
      rules: {
        preset: 'quick',
        requireSixToLeaveBase: false,
        extraTurnOnSix: true,
        extraTurnOnCapture: true,
        extraTurnOnHome: true,
        threeConsecutiveSixesRule: false,
        safeZoneMode: 'standard',
        turnTimeoutSeconds: 30,
        teamMode: false,
      },
    });
    const { roomId, hostToken } = created.data!;

    const j1 = await emitAsync<JoinRoomResponse>(p1, 'room:join', { roomId, name: 'WinnerCandidate' });
    const j2 = await emitAsync<JoinRoomResponse>(p2, 'room:join', { roomId, name: 'RunnerUp' });
    const p1Id = j1.data!.participantId;
    const p2Id = j2.data!.participantId;

    await emitAsync(p1, 'player:ready', {
      roomId,
      playerId: p1Id,
      sessionToken: j1.data!.sessionToken,
      ready: true,
    });
    await emitAsync(p2, 'player:ready', {
      roomId,
      playerId: p2Id,
      sessionToken: j2.data!.sessionToken,
      ready: true,
    });

    let latestState: RoomState | null = null;
    host.on('room:state', (st) => {
      latestState = st;
    });

    const finishedPromise = new Promise<{ winnerId: string | null }>((resolve) => {
      host.once('game:finished', resolve);
    });

    await emitAsync(host, 'game:start', { roomId, hostToken });

    // Drive real dice:roll and pawn:move turns until victory
    let step = 0;
    while (step < 600) {
      step++;
      const state = latestState ?? server.roomManager.getRoomState(roomId);
      const match = state?.match;
      if (!match || match.status === 'finished') break;

      const activeId = match.activePlayerId;
      const isP1 = activeId === p1Id;
      const sock = isP1 ? p1 : p2;
      const tok = isP1 ? j1.data!.sessionToken : j2.data!.sessionToken;

      const rollRes = await emitAsync<DiceResultEvent>(sock, 'dice:roll', {
        roomId,
        playerId: activeId!,
        sessionToken: tok,
        actionId: `sim-roll-${step}`,
      });
      expect(rollRes.ok).toBe(true);

      if (rollRes.data && rollRes.data.legalMoves.length > 0) {
        const moveRes = await emitAsync(sock, 'pawn:move', {
          roomId,
          playerId: activeId!,
          sessionToken: tok,
          pawnId: rollRes.data.legalMoves[0].pawnId,
          actionId: `sim-move-${step}`,
        });
        expect(moveRes.ok).toBe(true);
      }
    }

    const finished = await finishedPromise;
    expect(finished.winnerId).toBeTruthy();

    // Verify match recorded in /api/history
    const histRes = await fetch(`${baseUrl}/api/history`);
    const histJson = (await histRes.json()) as { ok: boolean; records: Array<{ roomId: string }> };
    expect(histJson.ok).toBe(true);
    expect(histJson.records.some((r) => r.roomId === roomId)).toBe(true);

    // Host triggers rematch
    const rematch = await emitAsync(host, 'game:restart', { roomId, hostToken });
    expect(rematch.ok).toBe(true);
    expect(server.roomManager.getRoomState(roomId)?.match?.status).toBe('playing');
  });
});
