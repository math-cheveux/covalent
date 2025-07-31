// packages/client/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'jsdom',
        coverage: {
            provider: "v8",
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: './coverage',
            all: true,
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['**/*.d.ts', 'dist', 'tests/helpers.ts']
        },
    },
})
