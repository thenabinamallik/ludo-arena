import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@ludo-arena/shared-types': path.resolve(__dirname, 'packages/shared-types/src/index.ts'),
      '@ludo-arena/validation': path.resolve(__dirname, 'packages/validation/src/index.ts'),
      '@ludo-arena/board-config': path.resolve(__dirname, 'packages/board-config/src/index.ts'),
      '@ludo-arena/game-engine': path.resolve(__dirname, 'packages/game-engine/src/index.ts'),
      '@ludo-arena/server': path.resolve(__dirname, 'apps/server/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
  },
});
