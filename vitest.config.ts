import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [tsconfigPaths()],
        test: {
          name: 'backend',
          globals: true,
          environment: 'node',
          include: ['backend/**/*.test.ts'],
        },
      },
      {
        extends: './frontend/vite.config.ts',
        test: {
          name: 'frontend',
          globals: true,
          environment: 'jsdom',
          include: ['frontend/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['frontend/src/test/setup.ts'],
        },
      },
    ],
  },
});
