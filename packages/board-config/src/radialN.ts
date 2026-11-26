import type { PlayerColor } from '@ludo-arena/shared-types';
import type { BoardCell, BoardConfig, Point2D, SeatGeometry } from './types.js';

const VIEWBOX = 1000;
const CENTER = { x: 500, y: 500 };

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function armPoint(angleDeg: number, radial: number, tangent: number): Point2D {
  const rad = degToRad(angleDeg);
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  // Clockwise tangent vector
  const tx = -uy;
  const ty = ux;
  return {
    x: Number((CENTER.x + radial * ux + tangent * tx).toFixed(2)),
    y: Number((CENTER.y + radial * uy + tangent * ty).toFixed(2)),
  };
}

const SIX_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue', 'orange', 'purple'];
const EIGHT_COLORS: PlayerColor[] = [
  'red',
  'green',
  'yellow',
  'blue',
  'orange',
  'purple',
  'pink',
  'cyan',
];

function buildRadialBoard(mode: 6 | 8): BoardConfig {
  const N = mode;
  const stepAngle = 360 / N;
  const firstArmAngle = -90; // Top arm

  const centerRadius = mode === 6 ? 108 : 134;
  const cellWidth = mode === 6 ? 30 : 25;
  const cellHeight = mode === 6 ? 44 : 40;
  const rInner = mode === 6 ? 156 : 182;
  const radialStep = mode === 6 ? 46 : 42;
  const baseDistance = mode === 6 ? 326 : 344;
  const baseRadius = mode === 6 ? 82 : 64;
  const slotOffset = mode === 6 ? 30 : 23;

  const colors = mode === 6 ? SIX_COLORS : EIGHT_COLORS;

  // Center regular N-gon vertices between arms
  const centerPolygonPoints: Point2D[] = [];
  for (let k = 0; k < N; k++) {
    const vAngle = firstArmAngle + k * stepAngle - stepAngle / 2;
    const rad = degToRad(vAngle);
    centerPolygonPoints.push({
      x: Number((CENTER.x + centerRadius * Math.cos(rad)).toFixed(2)),
      y: Number((CENTER.y + centerRadius * Math.sin(rad)).toFixed(2)),
    });
  }

  const cellsPerArm = 13;
  const totalTrack = N * cellsPerArm;

  // Build track cells in exact clockwise order:
  // Index k*13 + 0..4: arm k lane +1 inward (s = 4..0) -> index k*13 + 0 is arm k Start!
  // Index k*13 + 5..10: arm (k+1)%N lane -1 outward (s = 0..5)
  // Index k*13 + 11: arm (k+1)%N tip (lane 0, s = 5) -> Home Entry for arm (k+1)%N!
  // Index k*13 + 12: arm (k+1)%N corner (lane +1, s = 5)
  const trackCells: BoardCell[] = new Array(totalTrack);
  const starSafeIndices: number[] = [];
  const startTrackIndices: number[] = [];

  for (let k = 0; k < N; k++) {
    const armAngle = firstArmAngle + k * stepAngle;
    const nextArmIndex = (k + 1) % N;
    const nextArmAngle = firstArmAngle + nextArmIndex * stepAngle;
    const baseIdx = k * cellsPerArm;

    startTrackIndices.push(baseIdx);

    // k*13 + 0..4: arm k lane +1 inward (s = 4 down to 0)
    for (let i = 0; i < 5; i++) {
      const s = 4 - i;
      const pt = armPoint(armAngle, rInner + s * radialStep, cellWidth);
      trackCells[baseIdx + i] = {
        index: baseIdx + i,
        x: pt.x,
        y: pt.y,
        width: cellWidth,
        height: cellHeight,
        angleDeg: armAngle + 90,
        isStarSafe: false,
        startSeatIndex: i === 0 ? k : null,
        entrySeatIndex: null,
      };
    }

    // k*13 + 5..10: nextArm lane -1 outward (s = 0 up to 5)
    for (let s = 0; s < 6; s++) {
      const idx = baseIdx + 5 + s;
      const isStar = s === 3; // 2 steps inward from tip = k*13 + 8
      if (isStar) {
        starSafeIndices.push(idx);
      }
      const pt = armPoint(nextArmAngle, rInner + s * radialStep, -cellWidth);
      trackCells[idx] = {
        index: idx,
        x: pt.x,
        y: pt.y,
        width: cellWidth,
        height: cellHeight,
        angleDeg: nextArmAngle + 90,
        isStarSafe: isStar,
        startSeatIndex: null,
        entrySeatIndex: null,
      };
    }

    // k*13 + 11: nextArm tip (lane 0, s = 5) = home entry for nextArmIndex
    const tipPt = armPoint(nextArmAngle, rInner + 5 * radialStep, 0);
    trackCells[baseIdx + 11] = {
      index: baseIdx + 11,
      x: tipPt.x,
      y: tipPt.y,
      width: cellWidth,
      height: cellHeight,
      angleDeg: nextArmAngle + 90,
      isStarSafe: false,
      startSeatIndex: null,
      entrySeatIndex: nextArmIndex,
    };

    // k*13 + 12: nextArm outer right corner (lane +1, s = 5)
    const cornerPt = armPoint(nextArmAngle, rInner + 5 * radialStep, cellWidth);
    trackCells[baseIdx + 12] = {
      index: baseIdx + 12,
      x: cornerPt.x,
      y: cornerPt.y,
      width: cellWidth,
      height: cellHeight,
      angleDeg: nextArmAngle + 90,
      isStarSafe: false,
      startSeatIndex: null,
      entrySeatIndex: null,
    };
  }

  const seats: SeatGeometry[] = [];
  for (let k = 0; k < N; k++) {
    const armAngle = firstArmAngle + k * stepAngle;
    const baseAngle = armAngle + stepAngle / 2;
    const baseRad = degToRad(baseAngle);
    const baseCenter = {
      x: Number((CENTER.x + baseDistance * Math.cos(baseRad)).toFixed(2)),
      y: Number((CENTER.y + baseDistance * Math.sin(baseRad)).toFixed(2)),
    };

    const baseSlots: [Point2D, Point2D, Point2D, Point2D] = [
      { x: baseCenter.x - slotOffset, y: baseCenter.y - slotOffset },
      { x: baseCenter.x + slotOffset, y: baseCenter.y - slotOffset },
      { x: baseCenter.x - slotOffset, y: baseCenter.y + slotOffset },
      { x: baseCenter.x + slotOffset, y: baseCenter.y + slotOffset },
    ];

    // 5 home stretch cells along lane 0 from s = 4 down to s = 0
    const homeStretchCells = [];
    for (let i = 0; i < 5; i++) {
      const s = 4 - i;
      const pt = armPoint(armAngle, rInner + s * radialStep, 0);
      homeStretchCells.push({
        index: i,
        x: pt.x,
        y: pt.y,
        width: cellWidth,
        height: cellHeight,
        angleDeg: armAngle + 90,
      });
    }

    const v1 = centerPolygonPoints[k];
    const v2 = centerPolygonPoints[(k + 1) % N];
    const homeGoalCenter = armPoint(armAngle, centerRadius * 0.56, 0);
    const entryTrackIndex = ((k - 1 + N) % N) * cellsPerArm + 11;

    seats.push({
      seatIndex: k,
      defaultColor: colors[k],
      teamId: k % 2,
      startTrackIndex: k * cellsPerArm,
      entryTrackIndex,
      baseCenter,
      baseRadius,
      baseSlots,
      homeStretchCells,
      homeGoalCenter,
      homeTrianglePoints: [CENTER, v1, v2],
      angleDeg: armAngle,
    });
  }

  return {
    mode,
    viewBoxSize: VIEWBOX,
    center: CENTER,
    centerPolygonPoints,
    mainTrackLength: totalTrack,
    homeStretchLength: 5,
    totalStepsToHome: totalTrack + 4,
    trackCells,
    startTrackIndices,
    starSafeIndices,
    seats,
    defaultColors: [...colors],
  };
}

export const BOARD_6P = buildRadialBoard(6);
export const BOARD_8P = buildRadialBoard(8);
