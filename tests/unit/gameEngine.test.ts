import { describe, expect, it } from 'vitest';
import {
  applyDiceRoll,
  applyPawnMove,
  applyTurnTimeout,
  createInitialMatchState,
  generateSecureDiceValue,
  getLegalMoves,
} from '@ludo-arena/game-engine';
import {
  RULE_PRESETS,
  type GameRulesConfig,
  type PlayerColor,
  type PlayerCountMode,
  type PlayerInfo,
} from '@ludo-arena/shared-types';

function makePlayers(count: number, colors: PlayerColor[]): PlayerInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    avatar: 'crown',
    color: colors[i],
    teamId: i % 2,
    ready: true,
    connected: true,
    seatIndex: i,
    joinedAt: 1000,
    lastSeenAt: 1000,
    stats: {
      rolls: 0,
      sixes: 0,
      moves: 0,
      captures: 0,
      capturedCount: 0,
      pawnsHome: 0,
      timeouts: 0,
    },
  }));
}

describe('Ludo Game Engine', () => {
  it('generates cryptographically valid dice rolls between 1 and 6', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const val = generateSecureDiceValue();
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(6);
      seen.add(val);
    }
    expect(seen.size).toBe(6);
  });

  it('requires a 6 to leave base by default and skips turn when no legal moves exist', () => {
    const players = makePlayers(4, ['red', 'green', 'yellow', 'blue']);
    const state = createInitialMatchState('ROOM01', 4, players, RULE_PRESETS.classic, 1000);

    const roll3 = applyDiceRoll(state, players, RULE_PRESETS.classic, 'p1', 3, 'act-1', 1100);
    expect(roll3.ok).toBe(true);
    expect(roll3.noLegalMoves).toBe(true);
    expect(roll3.legalMoves).toHaveLength(0);
    expect(roll3.state.activePlayerId).toBe('p2');
    expect(roll3.state.turnPhase).toBe('waiting_for_roll');
  });

  it('allows leaving base on 6, grants extra turn, and enforces three-sixes forfeit rule', () => {
    const players = makePlayers(4, ['red', 'green', 'yellow', 'blue']);
    const s0 = createInitialMatchState('ROOM01', 4, players, RULE_PRESETS.classic, 1000);

    // 1st six -> move pawn 1 out of base -> extra turn
    const r1 = applyDiceRoll(s0, players, RULE_PRESETS.classic, 'p1', 6, 'r1', 1100);
    expect(r1.legalMoves).toHaveLength(4);
    const m1 = applyPawnMove(
      r1.state,
      r1.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      'p1-p1',
      'm1',
      1200
    );
    expect(m1.ok).toBe(true);
    expect(m1.state.pawns['p1-p1'].zone).toBe('track');
    expect(m1.state.pawns['p1-p1'].trackIndex).toBe(0);
    expect(m1.state.activePlayerId).toBe('p1');

    // 2nd six -> move pawn 1 forward 6 -> extra turn
    const r2 = applyDiceRoll(
      m1.state,
      m1.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      6,
      'r2',
      1300
    );
    const m2 = applyPawnMove(
      r2.state,
      r2.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      'p1-p1',
      'm2',
      1400
    );
    expect(m2.state.activePlayerId).toBe('p1');
    expect(m2.state.consecutiveSixes).toBe(2);

    // 3rd six -> forfeits turn to p2!
    const r3 = applyDiceRoll(
      m2.state,
      m2.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      6,
      'r3',
      1500
    );
    expect(r3.forfeitedByThreeSixes).toBe(true);
    expect(r3.state.activePlayerId).toBe('p2');
    expect(r3.state.consecutiveSixes).toBe(0);
  });

  it('captures opponent on unprotected cell, protects on safe cell, and prevents friendly fire in team mode', () => {
    const players = makePlayers(4, ['red', 'green', 'yellow', 'blue']);
    const s0 = createInitialMatchState('ROOM01', 4, players, RULE_PRESETS.classic, 1000);

    // Place p2 pawn on trackIndex 5 (unprotected) and p1 pawn on trackIndex 2
    s0.pawns['p2-p1'] = {
      ...s0.pawns['p2-p1'],
      zone: 'track',
      progress: 44,
      trackIndex: 5,
    };
    s0.pawns['p1-p1'] = {
      ...s0.pawns['p1-p1'],
      zone: 'track',
      progress: 2,
      trackIndex: 2,
    };

    const r = applyDiceRoll(s0, players, RULE_PRESETS.classic, 'p1', 3, 'cap-r1', 1100);
    const moveOpt = r.legalMoves.find((m) => m.pawnId === 'p1-p1');
    expect(moveOpt?.willCapture).toBe(true);
    expect(moveOpt?.capturedPawnIds).toEqual(['p2-p1']);

    const moved = applyPawnMove(
      r.state,
      r.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      'p1-p1',
      'cap-m1',
      1200
    );
    expect(moved.state.pawns['p2-p1'].zone).toBe('base');
    expect(moved.state.pawns['p2-p1'].progress).toBe(-1);
    expect(moved.state.activePlayerId).toBe('p1'); // Extra turn on capture

    // Now test star safe cell (index 8) protects p2 pawn
    const sSafe = createInitialMatchState('ROOM01', 4, players, RULE_PRESETS.classic, 1000);
    sSafe.pawns['p2-p1'] = { ...sSafe.pawns['p2-p1'], zone: 'track', progress: 47, trackIndex: 8 };
    sSafe.pawns['p1-p1'] = { ...sSafe.pawns['p1-p1'], zone: 'track', progress: 5, trackIndex: 5 };
    const safeMoves = getLegalMoves(sSafe, players, RULE_PRESETS.classic, 'p1', 3);
    expect(safeMoves[0].willCapture).toBe(false);

    // Test Team Mode prevents p1 (teamId 0) capturing p3 (teamId 0)
    const teamRules: GameRulesConfig = RULE_PRESETS.team_battle;
    const sTeam = createInitialMatchState('ROOM01', 4, players, teamRules, 1000);
    sTeam.pawns['p3-p1'] = { ...sTeam.pawns['p3-p1'], zone: 'track', progress: 31, trackIndex: 5 };
    sTeam.pawns['p1-p1'] = { ...sTeam.pawns['p1-p1'], zone: 'track', progress: 2, trackIndex: 2 };
    const teamMoves = getLegalMoves(sTeam, players, teamRules, 'p1', 3);
    expect(teamMoves[0].willCapture).toBe(false);
  });

  it('requires exact dice roll to enter Home and declares winner when all 4 pawns reach Home', () => {
    const players = makePlayers(4, ['red', 'green', 'yellow', 'blue']);
    const s0 = createInitialMatchState('ROOM01', 4, players, RULE_PRESETS.classic, 1000);

    // 3 pawns already home, 4th pawn at progress 54 (needs exact 2 to reach 56)
    s0.pawns['p1-p1'] = { ...s0.pawns['p1-p1'], zone: 'home', progress: 56 };
    s0.pawns['p1-p2'] = { ...s0.pawns['p1-p2'], zone: 'home', progress: 56 };
    s0.pawns['p1-p3'] = { ...s0.pawns['p1-p3'], zone: 'home', progress: 56 };
    s0.pawns['p1-p4'] = {
      ...s0.pawns['p1-p4'],
      zone: 'home_stretch',
      progress: 54,
      homeStretchIndex: 3,
    };

    // Rolling 4 cannot move pawn 4 (overshoots 56)
    const tooHigh = getLegalMoves(s0, players, RULE_PRESETS.classic, 'p1', 4);
    expect(tooHigh).toHaveLength(0);

    // Rolling 2 enters home and wins the match
    const rWin = applyDiceRoll(s0, players, RULE_PRESETS.classic, 'p1', 2, 'win-r', 1100);
    const mWin = applyPawnMove(
      rWin.state,
      rWin.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      'p1-p4',
      'win-m',
      1200
    );
    expect(mWin.matchFinished).toBe(true);
    expect(mWin.state.status).toBe('finished');
    expect(mWin.state.rankings[0]).toBe('p1');
  });

  it('rejects duplicate actions, out-of-turn rolls, and unauthorized pawn moves', () => {
    const players = makePlayers(2, ['red', 'yellow']);
    const s0 = createInitialMatchState('ROOM02', 2, players, RULE_PRESETS.classic, 1000);

    const wrongTurn = applyDiceRoll(s0, players, RULE_PRESETS.classic, 'p2', 6, 'bad-1', 1050);
    expect(wrongTurn.ok).toBe(false);
    expect(wrongTurn.code).toBe('NOT_YOUR_TURN');

    const r1 = applyDiceRoll(s0, players, RULE_PRESETS.classic, 'p1', 6, 'dup-id', 1100);
    expect(r1.ok).toBe(true);

    const dup = applyDiceRoll(r1.state, r1.updatedPlayers, RULE_PRESETS.classic, 'p1', 6, 'dup-id', 1150);
    expect(dup.ok).toBe(false);
    expect(dup.code).toBe('DUPLICATE_ACTION');

    const stealPawn = applyPawnMove(
      r1.state,
      r1.updatedPlayers,
      RULE_PRESETS.classic,
      'p1',
      'p2-p1',
      'steal-1',
      1200
    );
    expect(stealPawn.ok).toBe(false);
    expect(stealPawn.code).toBe('UNAUTHORIZED_PAWN');
  });

  it('handles turn timeout and automatic turn skipping cleanly', () => {
    const players = makePlayers(4, ['red', 'green', 'yellow', 'blue']);
    const s0 = createInitialMatchState('ROOM01', 4, players, RULE_PRESETS.classic, 1000);
    const timedOut = applyTurnTimeout(s0, players, RULE_PRESETS.classic, 32000);
    expect(timedOut.state.activePlayerId).toBe('p2');
    expect(timedOut.updatedPlayers[0].stats.timeouts).toBe(1);
  });

  it('supports deterministic transitions across 2P, 4P, 6P, and 8P modes', () => {
    const modes: Array<{ mode: PlayerCountMode; colors: PlayerColor[] }> = [
      { mode: 2, colors: ['red', 'yellow'] },
      { mode: 4, colors: ['red', 'green', 'yellow', 'blue'] },
      { mode: 6, colors: ['red', 'green', 'yellow', 'blue', 'orange', 'purple'] },
      {
        mode: 8,
        colors: ['red', 'green', 'yellow', 'blue', 'orange', 'purple', 'pink', 'cyan'],
      },
    ];

    for (const { mode, colors } of modes) {
      const players = makePlayers(mode, colors);
      const a = createInitialMatchState('DET1', mode, players, RULE_PRESETS.classic, 5000);
      const b = createInitialMatchState('DET1', mode, players, RULE_PRESETS.classic, 5000);

      const ra = applyDiceRoll(a, players, RULE_PRESETS.classic, 'p1', 6, 'a1', 5100);
      const rb = applyDiceRoll(b, players, RULE_PRESETS.classic, 'p1', 6, 'a1', 5100);

      expect(ra.state.pawns).toEqual(rb.state.pawns);
      expect(ra.legalMoves).toEqual(rb.legalMoves);
    }
  });
});
