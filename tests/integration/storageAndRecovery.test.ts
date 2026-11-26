import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LudoDatabase, RoomManager } from '@ludo-arena/server';

const noopCallbacks = {
  onRoomState: vi.fn(),
  onDiceResult: vi.fn(),
  onPawnMoved: vi.fn(),
  onTurnChanged: vi.fn(),
  onGameFinished: vi.fn(),
  onPlayerDisconnect: vi.fn(),
  onRoomClosed: vi.fn(),
};

describe('SQLite Persistence & Host Recovery', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const d of tempDirs) {
      rmSync(d, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('persists active room, match state, and recovers after coordinator restart', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ludo-test-'));
    tempDirs.push(dir);
    const dbPath = path.join(dir, 'test.db');

    // Phase 1: Create room, join players, start match
    const db1 = new LudoDatabase(dbPath);
    const rm1 = new RoomManager(db1, noopCallbacks);
    const created = rm1.createRoom({ playerCountMode: 4 }, 'host-sock-1');

    const p1 = rm1.joinRoom({ roomId: created.roomId, name: 'Alice' }, 'sock-p1');
    const p2 = rm1.joinRoom({ roomId: created.roomId, name: 'Bob' }, 'sock-p2');
    expect(p1.ok && p2.ok).toBe(true);
    if (!p1.ok || !p2.ok) return;

    rm1.setPlayerReady(created.roomId, p1.participantId, p1.sessionToken, true);
    rm1.setPlayerReady(created.roomId, p2.participantId, p2.sessionToken, true);
    const started = rm1.startMatch(created.roomId, created.hostToken);
    expect(started.ok).toBe(true);

    rm1.destroy();
    db1.close();

    // Phase 2: Simulate process restart by opening the same SQLite DB
    const db2 = new LudoDatabase(dbPath);
    const rm2 = new RoomManager(db2, noopCallbacks);

    // Wrong host token must be rejected
    const badRecover = rm2.recoverHost(created.roomId, 'wrong-token-123456', 'host-sock-2');
    expect(badRecover.ok).toBe(false);

    // Valid host token recovers exact room & match state
    const goodRecover = rm2.recoverHost(created.roomId, created.hostToken, 'host-sock-2');
    expect(goodRecover.ok).toBe(true);
    if (goodRecover.ok) {
      expect(goodRecover.roomState.players).toHaveLength(2);
      expect(goodRecover.roomState.match).not.toBeNull();
      expect(goodRecover.roomState.hostConnected).toBe(true);
    }

    // Player reconnection with saved sessionToken also succeeds
    const p1Rejoin = rm2.joinRoom(
      { roomId: created.roomId, name: 'Alice', sessionToken: p1.sessionToken },
      'sock-p1-new'
    );
    expect(p1Rejoin.ok).toBe(true);
    if (p1Rejoin.ok) {
      expect(p1Rejoin.participantId).toBe(p1.participantId);
    }

    rm2.destroy();
    db2.close();
  });

  it('persists and retrieves match history records and settings', () => {
    const db = new LudoDatabase(':memory:');
    db.setSetting('defaultPreferences', { theme: 'light', soundEnabled: false });
    expect(db.getSetting('defaultPreferences', null)).toEqual({
      theme: 'light',
      soundEnabled: false,
    });

    db.saveMatchHistory({
      id: 'm1',
      roomId: 'ROOM01',
      playerCountMode: 4,
      teamMode: false,
      winnerId: 'p1',
      winnerName: 'Alice',
      winnerColor: 'red',
      winningTeamId: null,
      rankings: [],
      turnCount: 42,
      durationMs: 120000,
      rules: {
        preset: 'classic',
        requireSixToLeaveBase: true,
        extraTurnOnSix: true,
        extraTurnOnCapture: true,
        extraTurnOnHome: true,
        threeConsecutiveSixesRule: true,
        safeZoneMode: 'standard',
        turnTimeoutSeconds: 30,
        teamMode: false,
      },
      startedAt: 1000,
      finishedAt: 121000,
    });

    const history = db.listMatchHistory();
    expect(history).toHaveLength(1);
    expect(history[0].winnerName).toBe('Alice');
    db.close();
  });
});
