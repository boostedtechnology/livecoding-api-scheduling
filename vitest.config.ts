import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      VITEST: 'true'
    },
    // Run tests sequentially in a single thread
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Disable shuffling and set sequence options
    sequence: {
      shuffle: false,
      concurrent: false,
    },
    // Specify exact order with include
    include: [
      'tests/emailer.test.ts',
      'tests/task*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
  },
}); 