import { randomInt } from 'node:crypto';
import { getBoardConfig, getSafeTrackIndices } from '@ludo-arena/board-config';
import type {
  GameNotification,
  GameRulesConfig,
  MatchState,
  MoveOption,
  PawnNumber,
  PawnState,
  PlayerCountMode,
  PlayerInfo,
} from '@ludo-arena/shared-types';

const MAX_PROCESSED_ACTIONS = 200;

export function generateSecureDiceValue(): number {
  return randomInt(1, 7);
}

export function cloneMatchState(state: MatchState): MatchState {
  return structuredClone(state);
}

function recordActionId(state: MatchState, actionId: string): void {
  state.processedActionIds.push(actionId);
  if (state.processedActionIds.length > MAX_PROCESSED_ACTIONS) {
    state.processedActionIds.splice(0, state.processedActionIds.length - MAX_PROCESSED_ACTIONS);
  }
}

function createNotification(
  type: GameNotification['type'],
  message: string,
  now: number,
  player?: PlayerInfo
): GameNotification {
  return {
    id: `notif-${now}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    message,
    playerId: player?.id,
    color: player?.color ?? undefined,
    timestamp: now,
  };
}

export function createInitialMatchState(
  roomId: string,
  playerCountMode: PlayerCountMode,
  players: PlayerInfo[],
  rules: GameRulesConfig,
  now = Date.now()
): MatchState {
  const orderedPlayers = [...players].sort((a, b) => a.seatIndex - b.seatIndex);
  if (orderedPlayers.length < 2) {
    throw new Error('At least 2 players are required to start a match');
  }
  for (const player of orderedPlayers) {
    if (!player.color) {
      throw new Error(`Player ${player.name} does not have an assigned color`);
    }
  }

  const pawns: Record<string, PawnState> = {};
  for (const player of orderedPlayers) {
    for (let n = 1; n <= 4; n++) {
      const pawnNumber = n as PawnNumber;
      const id = `${player.id}-p${pawnNumber}`;
      pawns[id] = {
        id,
        pawnNumber,
        playerId: player.id,
        color: player.color!,
        zone: 'base',
        progress: -1,
        trackIndex: null,
        homeStretchIndex: null,
      };
    }
  }

  const firstPlayer = orderedPlayers[0];
  const turnTimeoutMs = rules.turnTimeoutSeconds * 1000;
  const startNotif = createNotification(
    'system',
    `Match started! ${firstPlayer.name} rolls first.`,
    now,
    firstPlayer
  );

  return {
    roomId,
    version: 1,
    status: 'playing',
    playerCountMode,
    turnPhase: 'waiting_for_roll',
    activePlayerId: firstPlayer.id,
    turnOrder: orderedPlayers.map((p) => p.id),
    currentDiceValue: null,
    consecutiveSixes: 0,
    legalMoves: [],
    turnStartedAt: now,
    turnExpiresAt: now + turnTimeoutMs,
    pausedRemainingTurnMs: null,
    pawns,
    rankings: [],
    winningTeamId: null,
    turnCount: 1,
    startedAt: now,
    finishedAt: null,
    processedActionIds: [],
    lastEvent: startNotif,
  };
}

export function getPlayerPawns(state: MatchState, playerId: string): PawnState[] {
  return Object.values(state.pawns)
    .filter((p) => p.playerId === playerId)
    .sort((a, b) => a.pawnNumber - b.pawnNumber);
}

export function getLegalMoves(
  state: MatchState,
  players: PlayerInfo[],
  rules: GameRulesConfig,
  playerId: string,
  diceValue: number
): MoveOption[] {
  if (diceValue < 1 || diceValue > 6) {
    return [];
  }

  const player = players.find((p) => p.id === playerId);
  if (!player) return [];

  const board = getBoardConfig(state.playerCountMode);
  const seat = board.seats[player.seatIndex];
  if (!seat) return [];

  const safeIndices = getSafeTrackIndices(board, rules.safeZoneMode);
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const playerPawns = getPlayerPawns(state, playerId);
  const options: MoveOption[] = [];

  for (const pawn of playerPawns) {
    if (pawn.zone === 'home') {
      continue;
    }

    if (pawn.zone === 'base') {
      if (rules.requireSixToLeaveBase && diceValue !== 6) {
        continue;
      }
      const targetTrackIndex = seat.startTrackIndex;
      const capturedPawnIds = findCapturablePawns(
        state,
        playerMap,
        player,
        targetTrackIndex,
        safeIndices,
        rules.teamMode
      );
      const willCapture = capturedPawnIds.length > 0;
      const grantsExtraTurn =
        (diceValue === 6 && rules.extraTurnOnSix) ||
        (willCapture && rules.extraTurnOnCapture);

      options.push({
        pawnId: pawn.id,
        pawnNumber: pawn.pawnNumber,
        fromZone: 'base',
        toZone: 'track',
        fromProgress: -1,
        toProgress: 0,
        willCapture,
        capturedPawnIds,
        willReachHome: false,
        grantsExtraTurn,
      });
      continue;
    }

    const nextProgress = pawn.progress + diceValue;
    if (nextProgress > board.totalStepsToHome) {
      continue;
    }

    if (nextProgress === board.totalStepsToHome) {
      const grantsExtraTurn =
        (diceValue === 6 && rules.extraTurnOnSix) || rules.extraTurnOnHome;
      options.push({
        pawnId: pawn.id,
        pawnNumber: pawn.pawnNumber,
        fromZone: pawn.zone,
        toZone: 'home',
        fromProgress: pawn.progress,
        toProgress: nextProgress,
        willCapture: false,
        capturedPawnIds: [],
        willReachHome: true,
        grantsExtraTurn,
      });
      continue;
    }

    if (nextProgress >= board.mainTrackLength - 1) {
      const grantsExtraTurn = diceValue === 6 && rules.extraTurnOnSix;
      options.push({
        pawnId: pawn.id,
        pawnNumber: pawn.pawnNumber,
        fromZone: pawn.zone,
        toZone: 'home_stretch',
        fromProgress: pawn.progress,
        toProgress: nextProgress,
        willCapture: false,
        capturedPawnIds: [],
        willReachHome: false,
        grantsExtraTurn,
      });
      continue;
    }

    const targetTrackIndex = (seat.startTrackIndex + nextProgress) % board.mainTrackLength;
    const capturedPawnIds = findCapturablePawns(
      state,
      playerMap,
      player,
      targetTrackIndex,
      safeIndices,
      rules.teamMode
    );
    const willCapture = capturedPawnIds.length > 0;
    const grantsExtraTurn =
      (diceValue === 6 && rules.extraTurnOnSix) ||
      (willCapture && rules.extraTurnOnCapture);

    options.push({
      pawnId: pawn.id,
      pawnNumber: pawn.pawnNumber,
      fromZone: pawn.zone,
      toZone: 'track',
      fromProgress: pawn.progress,
      toProgress: nextProgress,
      willCapture,
      capturedPawnIds,
      willReachHome: false,
      grantsExtraTurn,
    });
  }

  return options;
}

function findCapturablePawns(
  state: MatchState,
  playerMap: Map<string, PlayerInfo>,
  attacker: PlayerInfo,
  targetTrackIndex: number,
  safeIndices: Set<number>,
  teamMode: boolean
): string[] {
  if (safeIndices.has(targetTrackIndex)) {
    return [];
  }

  const captured: string[] = [];
  for (const other of Object.values(state.pawns)) {
    if (other.playerId === attacker.id) continue;
    if (other.zone !== 'track' || other.trackIndex !== targetTrackIndex) continue;
    if (teamMode) {
      const otherPlayer = playerMap.get(other.playerId);
      if (otherPlayer && attacker.teamId !== null && otherPlayer.teamId === attacker.teamId) {
        continue;
      }
    }
    captured.push(other.id);
  }
  return captured;
}

function advanceTurn(
  next: MatchState,
  players: PlayerInfo[],
  rules: GameRulesConfig,
  now: number
): string | null {
  const currentIdx = next.activePlayerId ? next.turnOrder.indexOf(next.activePlayerId) : -1;
  const total = next.turnOrder.length;

  for (let offset = 1; offset <= total; offset++) {
    const candidateId = next.turnOrder[(currentIdx + offset) % total];
    if (!next.rankings.includes(candidateId)) {
      next.activePlayerId = candidateId;
      next.turnPhase = 'waiting_for_roll';
      next.currentDiceValue = null;
      next.consecutiveSixes = 0;
      next.legalMoves = [];
      next.turnStartedAt = now;
      next.turnExpiresAt = now + rules.turnTimeoutSeconds * 1000;
      next.turnCount += 1;
      return candidateId;
    }
  }

  // Fallback if all finished
  next.activePlayerId = null;
  next.turnPhase = 'finished';
  next.turnExpiresAt = null;
  return null;
}

export interface DiceRollTransitionResult {
  ok: boolean;
  error?: string;
  code?: string;
  state: MatchState;
  updatedPlayers: PlayerInfo[];
  forfeitedByThreeSixes: boolean;
  noLegalMoves: boolean;
  legalMoves: MoveOption[];
}

export function applyDiceRoll(
  state: MatchState,
  players: PlayerInfo[],
  rules: GameRulesConfig,
  playerId: string,
  diceValue: number,
  actionId: string,
  now = Date.now()
): DiceRollTransitionResult {
  const clonedPlayers = structuredClone(players);

  if (state.processedActionIds.includes(actionId)) {
    return {
      ok: false,
      error: 'Duplicate dice roll request',
      code: 'DUPLICATE_ACTION',
      state,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: false,
      noLegalMoves: false,
      legalMoves: [],
    };
  }

  if (state.status !== 'playing') {
    return {
      ok: false,
      error: 'Match is not currently playing',
      code: 'MATCH_NOT_PLAYING',
      state,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: false,
      noLegalMoves: false,
      legalMoves: [],
    };
  }

  if (state.activePlayerId !== playerId) {
    return {
      ok: false,
      error: 'It is not your turn',
      code: 'NOT_YOUR_TURN',
      state,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: false,
      noLegalMoves: false,
      legalMoves: [],
    };
  }

  if (state.turnPhase !== 'waiting_for_roll') {
    return {
      ok: false,
      error: 'Dice has already been rolled this turn',
      code: 'INVALID_TURN_PHASE',
      state,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: false,
      noLegalMoves: false,
      legalMoves: [],
    };
  }

  if (!Number.isInteger(diceValue) || diceValue < 1 || diceValue > 6) {
    return {
      ok: false,
      error: 'Dice value must be an integer between 1 and 6',
      code: 'INVALID_DICE_VALUE',
      state,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: false,
      noLegalMoves: false,
      legalMoves: [],
    };
  }

  const next = cloneMatchState(state);
  recordActionId(next, actionId);
  next.version += 1;

  const activePlayer = clonedPlayers.find((p) => p.id === playerId)!;
  activePlayer.stats.rolls += 1;
  if (diceValue === 6) {
    activePlayer.stats.sixes += 1;
  }

  const nextSixCount = diceValue === 6 ? next.consecutiveSixes + 1 : 0;
  next.currentDiceValue = diceValue;
  next.consecutiveSixes = nextSixCount;

  // Check 3 consecutive sixes penalty
  if (rules.threeConsecutiveSixesRule && nextSixCount >= 3) {
    const nextPlayerId = advanceTurn(next, clonedPlayers, rules, now);
    const nextPlayer = clonedPlayers.find((p) => p.id === nextPlayerId);
    next.lastEvent = createNotification(
      'penalty',
      `${activePlayer.name} rolled three 6s in a row! Turn forfeited.${nextPlayer ? ` ${nextPlayer.name}'s turn.` : ''}`,
      now,
      activePlayer
    );
    return {
      ok: true,
      state: next,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: true,
      noLegalMoves: false,
      legalMoves: [],
    };
  }

  const legalMoves = getLegalMoves(next, clonedPlayers, rules, playerId, diceValue);
  next.legalMoves = legalMoves;

  if (legalMoves.length === 0) {
    const nextPlayerId = advanceTurn(next, clonedPlayers, rules, now);
    const nextPlayer = clonedPlayers.find((p) => p.id === nextPlayerId);
    next.lastEvent = createNotification(
      'roll',
      `${activePlayer.name} rolled ${diceValue} — no legal moves.${nextPlayer ? ` ${nextPlayer.name}'s turn.` : ''}`,
      now,
      activePlayer
    );
    return {
      ok: true,
      state: next,
      updatedPlayers: clonedPlayers,
      forfeitedByThreeSixes: false,
      noLegalMoves: true,
      legalMoves: [],
    };
  }

  next.turnPhase = 'waiting_for_move';
  next.turnStartedAt = now;
  next.turnExpiresAt = now + rules.turnTimeoutSeconds * 1000;
  next.lastEvent = createNotification(
    'roll',
    `${activePlayer.name} rolled a ${diceValue}! Choose a pawn to move.`,
    now,
    activePlayer
  );

  return {
    ok: true,
    state: next,
    updatedPlayers: clonedPlayers,
    forfeitedByThreeSixes: false,
    noLegalMoves: false,
    legalMoves,
  };
}

export interface PawnMoveTransitionResult {
  ok: boolean;
  error?: string;
  code?: string;
  state: MatchState;
  updatedPlayers: PlayerInfo[];
  moveOption?: MoveOption;
  matchFinished: boolean;
}

export function applyPawnMove(
  state: MatchState,
  players: PlayerInfo[],
  rules: GameRulesConfig,
  playerId: string,
  pawnId: string,
  actionId: string,
  now = Date.now()
): PawnMoveTransitionResult {
  const clonedPlayers = structuredClone(players);

  if (state.processedActionIds.includes(actionId)) {
    return {
      ok: false,
      error: 'Duplicate pawn move request',
      code: 'DUPLICATE_ACTION',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  if (state.status !== 'playing') {
    return {
      ok: false,
      error: 'Match is not currently playing',
      code: 'MATCH_NOT_PLAYING',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  if (state.activePlayerId !== playerId) {
    return {
      ok: false,
      error: 'It is not your turn',
      code: 'NOT_YOUR_TURN',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  if (state.turnPhase !== 'waiting_for_move') {
    return {
      ok: false,
      error: 'Roll the dice before moving a pawn',
      code: 'INVALID_TURN_PHASE',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  const pawn = state.pawns[pawnId];
  if (!pawn) {
    return {
      ok: false,
      error: 'Pawn not found',
      code: 'PAWN_NOT_FOUND',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  if (pawn.playerId !== playerId) {
    return {
      ok: false,
      error: 'You cannot move another player’s pawn',
      code: 'UNAUTHORIZED_PAWN',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  const moveOption = state.legalMoves.find((m) => m.pawnId === pawnId);
  if (!moveOption) {
    return {
      ok: false,
      error: 'Selected pawn does not have a legal move',
      code: 'ILLEGAL_MOVE',
      state,
      updatedPlayers: clonedPlayers,
      matchFinished: false,
    };
  }

  const next = cloneMatchState(state);
  recordActionId(next, actionId);
  next.version += 1;

  const board = getBoardConfig(next.playerCountMode);
  const activePlayer = clonedPlayers.find((p) => p.id === playerId)!;
  const seat = board.seats[activePlayer.seatIndex];
  const nextPawn = next.pawns[pawnId];

  nextPawn.zone = moveOption.toZone;
  nextPawn.progress = moveOption.toProgress;
  if (moveOption.toZone === 'track') {
    nextPawn.trackIndex = (seat.startTrackIndex + moveOption.toProgress) % board.mainTrackLength;
    nextPawn.homeStretchIndex = null;
  } else if (moveOption.toZone === 'home_stretch') {
    nextPawn.trackIndex = null;
    nextPawn.homeStretchIndex = moveOption.toProgress - (board.mainTrackLength - 1);
  } else if (moveOption.toZone === 'home') {
    nextPawn.trackIndex = null;
    nextPawn.homeStretchIndex = null;
    activePlayer.stats.pawnsHome += 1;
  }

  activePlayer.stats.moves += 1;

  // Handle captures
  for (const capturedId of moveOption.capturedPawnIds) {
    const capPawn = next.pawns[capturedId];
    if (capPawn) {
      capPawn.zone = 'base';
      capPawn.progress = -1;
      capPawn.trackIndex = null;
      capPawn.homeStretchIndex = null;
      activePlayer.stats.captures += 1;
      const victim = clonedPlayers.find((p) => p.id === capPawn.playerId);
      if (victim) {
        victim.stats.capturedCount += 1;
      }
    }
  }

  // Check if activePlayer has all 4 pawns home
  const activePlayerPawns = getPlayerPawns(next, playerId);
  const playerCompletedAll = activePlayerPawns.every((p) => p.zone === 'home');
  if (playerCompletedAll && !next.rankings.includes(playerId)) {
    next.rankings.push(playerId);
  }

  // Check match completion (individual or team)
  const winCheck = evaluateWinCondition(next, clonedPlayers, rules);
  if (winCheck.finished) {
    next.status = 'finished';
    next.turnPhase = 'finished';
    next.activePlayerId = null;
    next.currentDiceValue = null;
    next.legalMoves = [];
    next.turnExpiresAt = null;
    next.finishedAt = now;
    next.winningTeamId = winCheck.winningTeamId;
    next.rankings = winCheck.rankings;

    const winner = clonedPlayers.find((p) => p.id === winCheck.rankings[0]);
    next.lastEvent = createNotification(
      'victory',
      winCheck.winningTeamId !== null
        ? `Team ${winCheck.winningTeamId + 1} wins the match!`
        : `${winner?.name ?? 'Winner'} wins the match!`,
      now,
      winner
    );

    return {
      ok: true,
      state: next,
      updatedPlayers: clonedPlayers,
      moveOption,
      matchFinished: true,
    };
  }

  // Determine next turn
  if (moveOption.grantsExtraTurn && !playerCompletedAll) {
    next.turnPhase = 'waiting_for_roll';
    next.currentDiceValue = null;
    next.legalMoves = [];
    next.turnStartedAt = now;
    next.turnExpiresAt = now + rules.turnTimeoutSeconds * 1000;

    const reasonText = moveOption.willCapture
      ? 'captured an opponent'
      : moveOption.willReachHome
        ? 'reached Home'
        : 'rolled a 6';
    next.lastEvent = createNotification(
      moveOption.willCapture ? 'capture' : moveOption.willReachHome ? 'home' : 'extra_turn',
      `${activePlayer.name} ${reasonText} and earns an extra turn!`,
      now,
      activePlayer
    );
  } else {
    const nextPlayerId = advanceTurn(next, clonedPlayers, rules, now);
    const nextPlayer = clonedPlayers.find((p) => p.id === nextPlayerId);
    const eventType = moveOption.willCapture
      ? 'capture'
      : moveOption.willReachHome
        ? 'home'
        : 'move';
    const actionDesc = moveOption.willCapture
      ? `${activePlayer.name} captured an opponent pawn!`
      : moveOption.willReachHome
        ? `${activePlayer.name}’s pawn reached Home!`
        : `${activePlayer.name} moved pawn #${moveOption.pawnNumber}.`;

    next.lastEvent = createNotification(
      eventType,
      `${actionDesc}${nextPlayer ? ` ${nextPlayer.name}'s turn.` : ''}`,
      now,
      activePlayer
    );
  }

  return {
    ok: true,
    state: next,
    updatedPlayers: clonedPlayers,
    moveOption,
    matchFinished: false,
  };
}

function getPlayerProgressScore(state: MatchState, playerId: string): number {
  const pawns = getPlayerPawns(state, playerId);
  return pawns.reduce((sum, p) => {
    if (p.zone === 'home') return sum + 1000;
    if (p.zone === 'base') return sum;
    return sum + p.progress + 1;
  }, 0);
}

function evaluateWinCondition(
  state: MatchState,
  players: PlayerInfo[],
  rules: GameRulesConfig
): { finished: boolean; winningTeamId: number | null; rankings: string[] } {
  const rankRemaining = (alreadyRanked: string[]): string[] => {
    const remaining = state.turnOrder
      .filter((id) => !alreadyRanked.includes(id))
      .sort((a, b) => getPlayerProgressScore(state, b) - getPlayerProgressScore(state, a));
    return [...alreadyRanked, ...remaining];
  };

  if (rules.teamMode) {
    const teamIds = Array.from(
      new Set(players.map((p) => p.teamId).filter((t): t is number => t !== null))
    );
    for (const teamId of teamIds) {
      const teamMembers = players.filter((p) => p.teamId === teamId);
      if (
        teamMembers.length > 0 &&
        teamMembers.every((m) => getPlayerPawns(state, m.id).every((p) => p.zone === 'home'))
      ) {
        const teamIdsOrdered = teamMembers
          .map((m) => m.id)
          .sort((a, b) => (state.rankings.indexOf(a) === -1 ? 99 : state.rankings.indexOf(a)));
        const others = state.turnOrder
          .filter((id) => !teamIdsOrdered.includes(id))
          .sort((a, b) => getPlayerProgressScore(state, b) - getPlayerProgressScore(state, a));
        return {
          finished: true,
          winningTeamId: teamId,
          rankings: [...teamIdsOrdered, ...others],
        };
      }
    }
    return { finished: false, winningTeamId: null, rankings: state.rankings };
  }

  if (state.rankings.length >= 1) {
    return {
      finished: true,
      winningTeamId: null,
      rankings: rankRemaining(state.rankings),
    };
  }

  return { finished: false, winningTeamId: null, rankings: state.rankings };
}

export function applyTurnTimeout(
  state: MatchState,
  players: PlayerInfo[],
  rules: GameRulesConfig,
  now = Date.now()
): { state: MatchState; updatedPlayers: PlayerInfo[] } {
  const clonedPlayers = structuredClone(players);
  if (state.status !== 'playing' || !state.activePlayerId) {
    return { state, updatedPlayers: clonedPlayers };
  }

  const next = cloneMatchState(state);
  next.version += 1;

  const timedOutPlayer = clonedPlayers.find((p) => p.id === state.activePlayerId);
  if (timedOutPlayer) {
    timedOutPlayer.stats.timeouts += 1;
  }

  const nextPlayerId = advanceTurn(next, clonedPlayers, rules, now);
  const nextPlayer = clonedPlayers.find((p) => p.id === nextPlayerId);
  next.lastEvent = createNotification(
    'timeout',
    `${timedOutPlayer?.name ?? 'Player'} ran out of time!${nextPlayer ? ` ${nextPlayer.name}'s turn.` : ''}`,
    now,
    timedOutPlayer
  );

  return { state: next, updatedPlayers: clonedPlayers };
}
