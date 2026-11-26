import type { PlayerCountMode } from '@ludo-arena/shared-types';
import { BOARD_2P, BOARD_4P, CLASSIC_4_INACTIVE_QUARTERS } from './classic4.js';
import { BOARD_6P, BOARD_8P } from './radialN.js';
import type { BoardConfig } from './types.js';

export * from './types.js';
export { BOARD_2P, BOARD_4P, BOARD_6P, BOARD_8P, CLASSIC_4_INACTIVE_QUARTERS };

export function getBoardConfig(mode: PlayerCountMode): BoardConfig {
  switch (mode) {
    case 2:
      return BOARD_2P;
    case 4:
      return BOARD_4P;
    case 6:
      return BOARD_6P;
    case 8:
      return BOARD_8P;
  }
}

export function getSafeTrackIndices(
  config: BoardConfig,
  safeZoneMode: 'standard' | 'starts_only' | 'none'
): Set<number> {
  if (safeZoneMode === 'none') {
    return new Set();
  }
  if (safeZoneMode === 'starts_only') {
    return new Set(config.startTrackIndices);
  }
  return new Set([...config.startTrackIndices, ...config.starSafeIndices]);
}
