import { describe, expect, it } from 'vitest';
import { getBoardConfig, getSafeTrackIndices } from '@ludo-arena/board-config';

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('Board Configurations (2P, 4P, 6P, 8P)', () => {
  it('configures 2-player board with two opposite corners on classic 52-cell track', () => {
    const board = getBoardConfig(2);
    expect(board.mode).toBe(2);
    expect(board.seats).toHaveLength(2);
    expect(board.mainTrackLength).toBe(52);
    expect(board.trackCells).toHaveLength(52);
    expect(board.seats[0].startTrackIndex).toBe(0);
    expect(board.seats[1].startTrackIndex).toBe(26);
    expect(board.seats[0].homeStretchCells).toHaveLength(5);
    expect(board.seats[1].homeStretchCells).toHaveLength(5);
  });

  it('configures classic 4-player board accurately', () => {
    const board = getBoardConfig(4);
    expect(board.mode).toBe(4);
    expect(board.seats).toHaveLength(4);
    expect(board.mainTrackLength).toBe(52);
    expect(board.startTrackIndices).toEqual([0, 13, 26, 39]);
    expect(board.starSafeIndices).toEqual([8, 21, 34, 47]);
    expect(board.defaultColors).toEqual(['red', 'green', 'yellow', 'blue']);

    for (const seat of board.seats) {
      expect(seat.baseSlots).toHaveLength(4);
      expect(seat.homeStretchCells).toHaveLength(5);
      // Entry track index must be exactly 50 steps ahead of startTrackIndex
      expect((seat.startTrackIndex + 50) % 52).toBe(seat.entryTrackIndex);
    }
  });

  it('configures symmetrical 6-player board with non-overlapping cells and independent routes', () => {
    const board = getBoardConfig(6);
    expect(board.mode).toBe(6);
    expect(board.seats).toHaveLength(6);
    expect(board.mainTrackLength).toBe(78);
    expect(board.trackCells).toHaveLength(78);
    expect(board.defaultColors).toEqual(['red', 'green', 'yellow', 'blue', 'orange', 'purple']);

    for (const seat of board.seats) {
      expect(seat.baseSlots).toHaveLength(4);
      expect(seat.homeStretchCells).toHaveLength(5);
      expect((seat.startTrackIndex + board.mainTrackLength - 2) % board.mainTrackLength).toBe(
        seat.entryTrackIndex
      );
    }

    // Verify no overlapping outer track cells
    for (let i = 0; i < board.trackCells.length; i++) {
      for (let j = i + 1; j < board.trackCells.length; j++) {
        expect(dist(board.trackCells[i], board.trackCells[j])).toBeGreaterThan(25);
      }
    }
  });

  it('configures symmetrical 8-player board with non-overlapping cells and independent routes', () => {
    const board = getBoardConfig(8);
    expect(board.mode).toBe(8);
    expect(board.seats).toHaveLength(8);
    expect(board.mainTrackLength).toBe(104);
    expect(board.trackCells).toHaveLength(104);
    expect(board.defaultColors).toEqual([
      'red',
      'green',
      'yellow',
      'blue',
      'orange',
      'purple',
      'pink',
      'cyan',
    ]);

    for (const seat of board.seats) {
      expect(seat.baseSlots).toHaveLength(4);
      expect(seat.homeStretchCells).toHaveLength(5);
      expect((seat.startTrackIndex + board.mainTrackLength - 2) % board.mainTrackLength).toBe(
        seat.entryTrackIndex
      );
    }

    // Verify no overlapping outer track cells
    for (let i = 0; i < board.trackCells.length; i++) {
      for (let j = i + 1; j < board.trackCells.length; j++) {
        expect(dist(board.trackCells[i], board.trackCells[j])).toBeGreaterThan(20);
      }
    }
  });

  it('computes safe zone indices according to safeZoneMode', () => {
    const board = getBoardConfig(4);
    expect(getSafeTrackIndices(board, 'standard').size).toBe(8);
    expect(getSafeTrackIndices(board, 'starts_only').size).toBe(4);
    expect(getSafeTrackIndices(board, 'none').size).toBe(0);
  });
});
