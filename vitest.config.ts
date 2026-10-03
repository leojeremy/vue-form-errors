import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        // The test harnesses use string templates, which need the build of
        // Vue that ships the template compiler.
        alias: { vue: 'vue/dist/vue.esm-bundler.js' },
    },
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.ts'],
    },
});
