import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CLASSIC_4_INACTIVE_QUARTERS,
  getBoardConfig,
  type Point2D,
} from '@ludo-arena/board-config';
import {
  COLOR_PALETTE,
  type MatchState,
  type MoveOption,
  type PawnState,
  type PlayerColor,
  type PlayerCountMode,
  type PlayerInfo,
} from '@ludo-arena/shared-types';

interface LudoBoardProps {
  mode: PlayerCountMode;
  players: PlayerInfo[];
  match: MatchState | null;
  legalMoves?: MoveOption[];
  interactivePlayerId?: string | null;
  onSelectPawn?: (pawnId: string) => void;
  safeZoneMode?: 'standard' | 'starts_only' | 'none';
}

function pointsToString(pts: Point2D[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function StarGlyph({ x, y, size = 16 }: { x: number; y: number; size?: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(x + r * Math.cos(angle)).toFixed(1)},${(y + r * Math.sin(angle)).toFixed(1)}`);
  }
  return (
    <polygon
      points={pts.join(' ')}
      fill="none"
      stroke="#64748B"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
  );
}

function getPointAtProgress(
  progress: number,
  pawnNumber: number,
  seatIndex: number,
  mode: PlayerCountMode
): Point2D {
  const board = getBoardConfig(mode);
  const seat = board.seats[seatIndex] ?? board.seats[0];

  if (progress < 0) {
    return seat.baseSlots[pawnNumber - 1] ?? seat.baseCenter;
  }
  if (progress < board.mainTrackLength - 1) {
    const trackIdx = (seat.startTrackIndex + progress) % board.mainTrackLength;
    const cell = board.trackCells[trackIdx];
    return cell ? { x: cell.x, y: cell.y } : seat.baseCenter;
  }
  if (progress < board.totalStepsToHome) {
    const hsIdx = progress - (board.mainTrackLength - 1);
    const cell = seat.homeStretchCells[hsIdx];
    return cell ? { x: cell.x, y: cell.y } : seat.homeGoalCenter;
  }
  return seat.homeGoalCenter;
}

function getPawnTargetPoint(
  pawn: PawnState,
  player: PlayerInfo | undefined,
  mode: PlayerCountMode
): Point2D {
  const board = getBoardConfig(mode);
  const seatIdx = player?.seatIndex ?? 0;
  const seat = board.seats[seatIdx] ?? board.seats[0];

  if (pawn.zone === 'base') {
    return seat.baseSlots[pawn.pawnNumber - 1] ?? seat.baseCenter;
  }
  if (pawn.zone === 'track' && pawn.trackIndex !== null) {
    const cell = board.trackCells[pawn.trackIndex];
    return cell ? { x: cell.x, y: cell.y } : seat.baseCenter;
  }
  if (pawn.zone === 'home_stretch' && pawn.homeStretchIndex !== null) {
    const cell = seat.homeStretchCells[pawn.homeStretchIndex];
    return cell ? { x: cell.x, y: cell.y } : seat.homeGoalCenter;
  }
  return seat.homeGoalCenter;
}

interface AnimatedPawnTokenProps {
  pawn: PawnState;
  seatIndex: number;
  mode: PlayerCountMode;
  targetX: number;
  targetY: number;
  targetScale: number;
  pawnRadius: number;
  isLegal: boolean;
  onSelectPawn?: (pawnId: string) => void;
}

function AnimatedPawnToken({
  pawn,
  seatIndex,
  mode,
  targetX,
  targetY,
  targetScale,
  pawnRadius,
  isLegal,
  onSelectPawn,
}: AnimatedPawnTokenProps) {
  const prevProgressRef = useRef<number>(pawn.progress);
  const targetRef = useRef<Point2D>({ x: targetX, y: targetY });
  targetRef.current = { x: targetX, y: targetY };

  const [stepPoint, setStepPoint] = useState<(Point2D & { hop: boolean }) | null>(null);
  const [trailPoints, setTrailPoints] = useState<Point2D[]>([]);

  useEffect(() => {
    const prev = prevProgressRef.current;
    const curr = pawn.progress;
    prevProgressRef.current = curr;

    // Only step cell-by-cell when moving forward along the board path
    if (curr <= prev || curr - prev > 12) {
      setStepPoint(null);
      setTrailPoints([]);
      return;
    }

    const waypoints: Array<Point2D & { hop: boolean }> = [];
    const startStep = prev < 0 ? 0 : prev + 1;
    for (let p = startStep; p < curr; p++) {
      const pt = getPointAtProgress(p, pawn.pawnNumber, seatIndex, mode);
      waypoints.push({ x: pt.x, y: pt.y, hop: true });
    }
    waypoints.push({ x: targetRef.current.x, y: targetRef.current.y, hop: true });

    if (waypoints.length <= 1) {
      setStepPoint(null);
      setTrailPoints([]);
      return;
    }

    let idx = 0;
    const startOrigin = getPointAtProgress(prev, pawn.pawnNumber, seatIndex, mode);
    setTrailPoints([startOrigin, { x: waypoints[0].x, y: waypoints[0].y }]);
    setStepPoint(waypoints[0]);

    const timer = window.setInterval(() => {
      idx += 1;
      if (idx >= waypoints.length) {
        window.clearInterval(timer);
        setStepPoint(null);
        setTrailPoints([]);
      } else {
        const nextPt = waypoints[idx];
        setStepPoint(nextPt);
        setTrailPoints((old) => [...old, { x: nextPt.x, y: nextPt.y }]);
      }
    }, 135);

    return () => {
      window.clearInterval(timer);
    };
  }, [pawn.progress, pawn.pawnNumber, seatIndex, mode]);

  const x = stepPoint ? stepPoint.x : targetX;
  const y = stepPoint ? stepPoint.y : targetY;
  const scale = stepPoint ? 1.2 : targetScale;
  const palette = COLOR_PALETTE[pawn.color];
  const numberFontSize = mode === 8 ? 15 : mode === 6 ? 17 : 22;

  return (
    <>
      {trailPoints.length > 1 && (
        <polyline
          points={pointsToString(trailPoints)}
          fill="none"
          stroke={palette.primary}
          strokeWidth={mode >= 6 ? 5 : 7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 6"
          opacity="0.7"
        />
      )}
      <motion.g
        initial={false}
        animate={{ x, y, scale }}
        transition={{
          type: 'spring',
          stiffness: stepPoint ? 440 : 280,
          damping: stepPoint ? 24 : 22,
        }}
        onClick={() => {
          if (isLegal && onSelectPawn) onSelectPawn(pawn.id);
        }}
        style={{ cursor: isLegal && onSelectPawn ? 'pointer' : 'default' }}
        filter="url(#pawn-shadow)"
      >
        {isLegal && (
          <circle
            cx={0}
            cy={0}
            r={pawnRadius + 7}
            fill="none"
            stroke="#FACC15"
            strokeWidth="3.5"
            className="animate-pulse-ring"
          />
        )}
        <circle
          cx={0}
          cy={0}
          r={pawnRadius}
          fill={palette.primary}
          stroke="#FFFFFF"
          strokeWidth="3"
        />
        <circle
          cx={0}
          cy={0}
          r={pawnRadius * 0.68}
          fill={palette.dark}
          opacity="0.32"
        />
        <circle
          cx={-pawnRadius * 0.3}
          cy={-pawnRadius * 0.3}
          r={pawnRadius * 0.2}
          fill="#FFFFFF"
          opacity="0.6"
        />
        <text
          x={0}
          y={1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={numberFontSize}
          fontWeight="900"
          fill={palette.textOnPrimary}
          stroke={palette.textOnPrimary === '#FFFFFF' ? 'rgba(15,23,42,0.55)' : 'rgba(255,255,255,0.6)'}
          strokeWidth="2.5"
          paintOrder="stroke"
        >
          {pawn.pawnNumber}
        </text>
      </motion.g>
    </>
  );
}

export function LudoBoard({
  mode,
  players,
  match,
  legalMoves = [],
  interactivePlayerId = null,
  onSelectPawn,
  safeZoneMode = 'standard',
}: LudoBoardProps) {
  const board = getBoardConfig(mode);
  const seatToPlayer = new Map<number, PlayerInfo>();
  const playerMap = new Map<string, PlayerInfo>();
  for (const p of players) {
    seatToPlayer.set(p.seatIndex, p);
    playerMap.set(p.id, p);
  }

  const getSeatColor = (seatIndex: number): PlayerColor => {
    return seatToPlayer.get(seatIndex)?.color ?? board.seats[seatIndex]?.defaultColor ?? 'red';
  };

  const legalPawnIds = new Set(legalMoves.map((m) => m.pawnId));

  // Build list of pawns to render (either live match pawns or preview base pawns in lobby)
  const allPawns: PawnState[] = match
    ? Object.values(match.pawns)
    : players.flatMap((p) =>
        [1, 2, 3, 4].map((num) => ({
          id: `${p.id}-p${num}`,
          pawnNumber: num as 1 | 2 | 3 | 4,
          playerId: p.id,
          color: p.color ?? 'red',
          zone: 'base' as const,
          progress: -1,
          trackIndex: null,
          homeStretchIndex: null,
        }))
      );

  // Group pawns occupying the same board point to apply clean micro-offsets
  const coordGroups = new Map<string, PawnState[]>();
  const rawPositions = new Map<string, Point2D>();
  for (const pawn of allPawns) {
    const pt = getPawnTargetPoint(pawn, playerMap.get(pawn.playerId), mode);
    rawPositions.set(pawn.id, pt);
    const key = `${Math.round(pt.x)}_${Math.round(pt.y)}`;
    const group = coordGroups.get(key) ?? [];
    group.push(pawn);
    coordGroups.set(key, group);
  }

  const pawnRadius = mode === 8 ? 12.5 : mode === 6 ? 14.5 : 20;
  const activePlayerId = match?.activePlayerId ?? null;

  return (
    <div className="relative w-full max-w-[780px] aspect-square mx-auto select-none">
      <svg
        viewBox={`0 0 ${board.viewBoxSize} ${board.viewBoxSize}`}
        className="w-full h-full rounded-3xl shadow-2xl border-4 border-slate-700/80 bg-[#0F172A]"
      >
        <defs>
          <radialGradient id="board-bg-glow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </radialGradient>
          <filter id="pawn-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Background */}
        {mode === 2 || mode === 4 ? (
          <rect x="0" y="0" width="900" height="900" fill="#F8FAFC" rx="24" />
        ) : (
          <rect x="0" y="0" width="1000" height="1000" fill="url(#board-bg-glow)" rx="28" />
        )}

        {/* Inactive quarters for 2-player classic board */}
        {mode === 2 &&
          CLASSIC_4_INACTIVE_QUARTERS.map((q, idx) => (
            <g key={`inactive-${idx}`}>
              <rect
                x={q.baseBounds.x}
                y={q.baseBounds.y}
                width={q.baseBounds.width}
                height={q.baseBounds.height}
                fill="#CBD5E1"
                stroke="#94A3B8"
                strokeWidth="2"
              />
              <rect
                x={q.baseBounds.x + 56}
                y={q.baseBounds.y + 56}
                width={q.baseBounds.width - 112}
                height={q.baseBounds.height - 112}
                rx="24"
                fill="#E2E8F0"
              />
            </g>
          ))}

        {/* Main outer track cells */}
        {board.trackCells.map((cell) => {
          const isStart = cell.startSeatIndex !== null;
          const seatColor = isStart ? getSeatColor(cell.startSeatIndex!) : null;
          const palette = seatColor ? COLOR_PALETTE[seatColor] : null;
          const showStar =
            safeZoneMode === 'standard' && cell.isStarSafe && !isStart;

          return (
            <g
              key={`track-${cell.index}`}
              transform={`translate(${cell.x}, ${cell.y}) rotate(${cell.angleDeg})`}
            >
              <rect
                x={-cell.width / 2}
                y={-cell.height / 2}
                width={cell.width}
                height={cell.height}
                rx={mode >= 6 ? 5 : 2}
                fill={palette ? palette.primary : '#FFFFFF'}
                stroke={mode >= 6 ? '#334155' : '#94A3B8'}
                strokeWidth={mode >= 6 ? 1.8 : 1.5}
              />
              {isStart && safeZoneMode !== 'none' && (
                <circle
                  cx={0}
                  cy={0}
                  r={Math.min(cell.width, cell.height) * 0.24}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2.2"
                  opacity="0.85"
                />
              )}
              {showStar && (
                <StarGlyph x={0} y={0} size={Math.min(cell.width, cell.height) * 0.3} />
              )}
            </g>
          );
        })}

        {/* Seat Home Bases, Home Stretch Columns, and Center Goal Triangles */}
        {board.seats.map((seat) => {
          const color = getSeatColor(seat.seatIndex);
          const palette = COLOR_PALETTE[color];
          const player = seatToPlayer.get(seat.seatIndex);
          const isActiveTurn = player && player.id === activePlayerId;

          return (
            <g key={`seat-${seat.seatIndex}`}>
              {/* Home Base */}
              {seat.baseBounds ? (
                <g>
                  <rect
                    x={seat.baseBounds.x}
                    y={seat.baseBounds.y}
                    width={seat.baseBounds.width}
                    height={seat.baseBounds.height}
                    fill={palette.primary}
                    stroke="#0F172A"
                    strokeWidth="2.5"
                  />
                  {isActiveTurn && (
                    <rect
                      x={seat.baseBounds.x + 6}
                      y={seat.baseBounds.y + 6}
                      width={seat.baseBounds.width - 12}
                      height={seat.baseBounds.height - 12}
                      rx="26"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="6"
                      opacity="0.9"
                    />
                  )}
                  <rect
                    x={seat.baseBounds.x + 54}
                    y={seat.baseBounds.y + 54}
                    width={seat.baseBounds.width - 108}
                    height={seat.baseBounds.height - 108}
                    rx="28"
                    fill="#FFFFFF"
                    stroke={palette.dark}
                    strokeWidth="3"
                  />
                </g>
              ) : (
                <g>
                  <circle
                    cx={seat.baseCenter.x}
                    cy={seat.baseCenter.y}
                    r={seat.baseRadius}
                    fill={palette.primary}
                    stroke={isActiveTurn ? '#FFFFFF' : '#0F172A'}
                    strokeWidth={isActiveTurn ? 5 : 3}
                  />
                  <circle
                    cx={seat.baseCenter.x}
                    cy={seat.baseCenter.y}
                    r={seat.baseRadius * 0.74}
                    fill="#FFFFFF"
                    stroke={palette.dark}
                    strokeWidth="2.5"
                  />
                </g>
              )}

              {/* 4 circular pawn base slots */}
              {seat.baseSlots.map((slot, idx) => (
                <circle
                  key={`slot-${seat.seatIndex}-${idx}`}
                  cx={slot.x}
                  cy={slot.y}
                  r={mode === 8 ? 14 : mode === 6 ? 17 : 26}
                  fill={palette.light}
                  stroke={palette.primary}
                  strokeWidth="2.5"
                />
              ))}

              {/* Player label on base */}
              {player && (
                <g>
                  <rect
                    x={seat.baseCenter.x - 62}
                    y={
                      seat.baseBounds
                        ? seat.baseBounds.y + seat.baseBounds.height - 42
                        : seat.baseCenter.y + seat.baseRadius - 12
                    }
                    width={124}
                    height={28}
                    rx={14}
                    fill="#0F172A"
                    opacity="0.88"
                  />
                  <text
                    x={seat.baseCenter.x}
                    y={
                      (seat.baseBounds
                        ? seat.baseBounds.y + seat.baseBounds.height - 42
                        : seat.baseCenter.y + seat.baseRadius - 12) + 19
                    }
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="#FFFFFF"
                  >
                    {player.name.slice(0, 12)}
                  </text>
                </g>
              )}

              {/* Home Stretch Cells */}
              {seat.homeStretchCells.map((hc) => (
                <g
                  key={`hc-${seat.seatIndex}-${hc.index}`}
                  transform={`translate(${hc.x}, ${hc.y}) rotate(${hc.angleDeg})`}
                >
                  <rect
                    x={-hc.width / 2}
                    y={-hc.height / 2}
                    width={hc.width}
                    height={hc.height}
                    rx={mode >= 6 ? 5 : 2}
                    fill={palette.primary}
                    stroke="#0F172A"
                    strokeWidth="1.6"
                  />
                </g>
              ))}

              {/* Center Home Goal Triangle */}
              <polygon
                points={pointsToString(seat.homeTrianglePoints)}
                fill={palette.primary}
                stroke="#0F172A"
                strokeWidth="2.5"
              />
            </g>
          );
        })}

        {/* Inactive triangles for 2-player center goal */}
        {mode === 2 &&
          CLASSIC_4_INACTIVE_QUARTERS.map((q, idx) => (
            <polygon
              key={`in-tri-${idx}`}
              points={pointsToString(q.homeTrianglePoints)}
              fill="#CBD5E1"
              stroke="#0F172A"
              strokeWidth="2"
            />
          ))}

        {/* Center Crown Emblem */}
        <circle
          cx={board.center.x}
          cy={board.center.y}
          r={mode >= 6 ? 26 : 30}
          fill="#0F172A"
          stroke="#FACC15"
          strokeWidth="3"
        />
        <text
          x={board.center.x}
          y={board.center.y + 6}
          textAnchor="middle"
          fontSize="14"
          fontWeight="800"
          fill="#FACC15"
        >
          HOME
        </text>

        {/* Animated Pawns */}
        {allPawns.map((pawn) => {
          const basePt = rawPositions.get(pawn.id)!;
          const key = `${Math.round(basePt.x)}_${Math.round(basePt.y)}`;
          const group = coordGroups.get(key) ?? [pawn];
          const idxInGroup = group.findIndex((g) => g.id === pawn.id);
          const count = group.length;

          let offsetX = 0;
          let offsetY = 0;
          if (count > 1) {
            const angle = (2 * Math.PI * idxInGroup) / count;
            const spread = mode >= 6 ? 7 : 11;
            offsetX = Math.cos(angle) * spread;
            offsetY = Math.sin(angle) * spread;
          }

          const x = basePt.x + offsetX;
          const y = basePt.y + offsetY;
          const isLegal =
            legalPawnIds.has(pawn.id) &&
            (!interactivePlayerId || pawn.playerId === interactivePlayerId);
          const scale = count > 1 ? 0.84 : 1;
          const seatIndex = playerMap.get(pawn.playerId)?.seatIndex ?? 0;

          return (
            <AnimatedPawnToken
              key={pawn.id}
              pawn={pawn}
              seatIndex={seatIndex}
              mode={mode}
              targetX={x}
              targetY={y}
              targetScale={scale}
              pawnRadius={pawnRadius}
              isLegal={isLegal}
              onSelectPawn={onSelectPawn}
            />
          );
        })}
      </svg>
    </div>
  );
}
