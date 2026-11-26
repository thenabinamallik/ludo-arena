import type { PlayerColor, PlayerCountMode } from '@ludo-arena/shared-types';

export interface Point2D {
  x: number;
  y: number;
}

export interface BoardCell {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  angleDeg: number;
  isStarSafe: boolean;
  startSeatIndex: number | null;
  entrySeatIndex: number | null;
}

export interface SeatGeometry {
  seatIndex: number;
  defaultColor: PlayerColor;
  teamId: number;
  startTrackIndex: number;
  entryTrackIndex: number;
  baseCenter: Point2D;
  baseRadius: number;
  baseBounds?: { x: number; y: number; width: number; height: number };
  baseSlots: [Point2D, Point2D, Point2D, Point2D];
  homeStretchCells: Array<{
    index: number;
    x: number;
    y: number;
    width: number;
    height: number;
    angleDeg: number;
  }>;
  homeGoalCenter: Point2D;
  homeTrianglePoints: Point2D[];
  angleDeg: number;
}

export interface BoardConfig {
  mode: PlayerCountMode;
  viewBoxSize: number;
  center: Point2D;
  centerPolygonPoints: Point2D[];
  mainTrackLength: number;
  homeStretchLength: number;
  /** Total steps from start cell (progress 0) to inside home */
  totalStepsToHome: number;
  trackCells: BoardCell[];
  startTrackIndices: number[];
  starSafeIndices: number[];
  seats: SeatGeometry[];
  defaultColors: PlayerColor[];
}
