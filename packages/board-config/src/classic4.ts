import type { PlayerColor } from '@ludo-arena/shared-types';
import type { BoardCell, BoardConfig, Point2D, SeatGeometry } from './types.js';

const CELL = 60;
const VIEWBOX = 900;

function cellCenter(col: number, row: number): Point2D {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

// 52 outer track grid coordinates clockwise starting at Red's start (1, 6)
const TRACK_COORDS: Array<[number, number]> = [
  // 0..4: Red start arm inward along row 6
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  // 5..10: Top arm left col outward
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  // 11: Top tip (Green entry)
  [7, 0],
  // 12..17: Top arm right col inward (13 = Green start)
  [8, 0],
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  // 18..23: Right arm top row outward
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  // 24: Right tip (Yellow entry)
  [14, 7],
  // 25..30: Right arm bottom row inward (26 = Yellow start)
  [14, 8],
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  // 31..36: Bottom arm right col outward
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  // 37: Bottom tip (Blue entry)
  [7, 14],
  // 38..43: Bottom arm left col inward (39 = Blue start)
  [6, 14],
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  // 44..49: Left arm bottom row outward
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  // 50: Left tip (Red entry)
  [0, 7],
  // 51: Left arm top-left corner
  [0, 6],
];

const STAR_INDICES = [8, 21, 34, 47];

interface RawCornerSeat {
  defaultColor: PlayerColor;
  startTrackIndex: number;
  entryTrackIndex: number;
  baseBounds: { x: number; y: number; width: number; height: number };
  baseSlots: [Point2D, Point2D, Point2D, Point2D];
  homeStretchCoords: Array<[number, number]>;
  homeGoalCenter: Point2D;
  homeTrianglePoints: Point2D[];
  angleDeg: number;
}

const FOUR_CORNER_SEATS: RawCornerSeat[] = [
  // Top-Left (Red)
  {
    defaultColor: 'red',
    startTrackIndex: 0,
    entryTrackIndex: 50,
    baseBounds: { x: 0, y: 0, width: 360, height: 360 },
    baseSlots: [
      { x: 115, y: 115 },
      { x: 245, y: 115 },
      { x: 115, y: 245 },
      { x: 245, y: 245 },
    ],
    homeStretchCoords: [
      [1, 7],
      [2, 7],
      [3, 7],
      [4, 7],
      [5, 7],
    ],
    homeGoalCenter: { x: 395, y: 450 },
    homeTrianglePoints: [
      { x: 450, y: 450 },
      { x: 360, y: 360 },
      { x: 360, y: 540 },
    ],
    angleDeg: 180,
  },
  // Top-Right (Green)
  {
    defaultColor: 'green',
    startTrackIndex: 13,
    entryTrackIndex: 11,
    baseBounds: { x: 540, y: 0, width: 360, height: 360 },
    baseSlots: [
      { x: 655, y: 115 },
      { x: 785, y: 115 },
      { x: 655, y: 245 },
      { x: 785, y: 245 },
    ],
    homeStretchCoords: [
      [7, 1],
      [7, 2],
      [7, 3],
      [7, 4],
      [7, 5],
    ],
    homeGoalCenter: { x: 450, y: 395 },
    homeTrianglePoints: [
      { x: 450, y: 450 },
      { x: 360, y: 360 },
      { x: 540, y: 360 },
    ],
    angleDeg: -90,
  },
  // Bottom-Right (Yellow)
  {
    defaultColor: 'yellow',
    startTrackIndex: 26,
    entryTrackIndex: 24,
    baseBounds: { x: 540, y: 540, width: 360, height: 360 },
    baseSlots: [
      { x: 655, y: 655 },
      { x: 785, y: 655 },
      { x: 655, y: 785 },
      { x: 785, y: 785 },
    ],
    homeStretchCoords: [
      [13, 7],
      [12, 7],
      [11, 7],
      [10, 7],
      [9, 7],
    ],
    homeGoalCenter: { x: 505, y: 450 },
    homeTrianglePoints: [
      { x: 450, y: 450 },
      { x: 540, y: 360 },
      { x: 540, y: 540 },
    ],
    angleDeg: 0,
  },
  // Bottom-Left (Blue)
  {
    defaultColor: 'blue',
    startTrackIndex: 39,
    entryTrackIndex: 37,
    baseBounds: { x: 0, y: 540, width: 360, height: 360 },
    baseSlots: [
      { x: 115, y: 655 },
      { x: 245, y: 655 },
      { x: 115, y: 785 },
      { x: 245, y: 785 },
    ],
    homeStretchCoords: [
      [7, 13],
      [7, 12],
      [7, 11],
      [7, 10],
      [7, 9],
    ],
    homeGoalCenter: { x: 450, y: 505 },
    homeTrianglePoints: [
      { x: 450, y: 450 },
      { x: 360, y: 540 },
      { x: 540, y: 540 },
    ],
    angleDeg: 90,
  },
];

function buildClassicBoard(mode: 2 | 4): BoardConfig {
  const activeRawSeats =
    mode === 4
      ? FOUR_CORNER_SEATS
      : [FOUR_CORNER_SEATS[0], FOUR_CORNER_SEATS[2]]; // Opposite corners for 2-player

  const startMap = new Map<number, number>();
  const entryMap = new Map<number, number>();

  const seats: SeatGeometry[] = activeRawSeats.map((raw, seatIndex) => {
    startMap.set(raw.startTrackIndex, seatIndex);
    entryMap.set(raw.entryTrackIndex, seatIndex);

    return {
      seatIndex,
      defaultColor: raw.defaultColor,
      teamId: mode === 2 ? seatIndex : seatIndex % 2,
      startTrackIndex: raw.startTrackIndex,
      entryTrackIndex: raw.entryTrackIndex,
      baseCenter: {
        x: raw.baseBounds.x + raw.baseBounds.width / 2,
        y: raw.baseBounds.y + raw.baseBounds.height / 2,
      },
      baseRadius: 150,
      baseBounds: raw.baseBounds,
      baseSlots: raw.baseSlots,
      homeStretchCells: raw.homeStretchCoords.map(([c, r], idx) => {
        const pt = cellCenter(c, r);
        return {
          index: idx,
          x: pt.x,
          y: pt.y,
          width: CELL,
          height: CELL,
          angleDeg: 0,
        };
      }),
      homeGoalCenter: raw.homeGoalCenter,
      homeTrianglePoints: raw.homeTrianglePoints,
      angleDeg: raw.angleDeg,
    };
  });

  const trackCells: BoardCell[] = TRACK_COORDS.map(([col, row], index) => {
    const pt = cellCenter(col, row);
    return {
      index,
      x: pt.x,
      y: pt.y,
      width: CELL,
      height: CELL,
      angleDeg: 0,
      isStarSafe: STAR_INDICES.includes(index),
      startSeatIndex: startMap.get(index) ?? null,
      entrySeatIndex: entryMap.get(index) ?? null,
    };
  });

  return {
    mode,
    viewBoxSize: VIEWBOX,
    center: { x: 450, y: 450 },
    centerPolygonPoints: [
      { x: 360, y: 360 },
      { x: 540, y: 360 },
      { x: 540, y: 540 },
      { x: 360, y: 540 },
    ],
    mainTrackLength: 52,
    homeStretchLength: 5,
    totalStepsToHome: 56,
    trackCells,
    startTrackIndices: seats.map((s) => s.startTrackIndex),
    starSafeIndices: [...STAR_INDICES],
    seats,
    defaultColors: seats.map((s) => s.defaultColor),
  };
}

export const BOARD_2P = buildClassicBoard(2);
export const BOARD_4P = buildClassicBoard(4);
export const CLASSIC_4_INACTIVE_QUARTERS = [
  FOUR_CORNER_SEATS[1],
  FOUR_CORNER_SEATS[3],
];
