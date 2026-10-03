import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

import { fakeServer } from './fakeServer.ts';

export default defineConfig({
    plugins: [vue(), fakeServer()],
    resolve: {
        // The example uses the source directly, so edits show up without a build.
        alias: { 'vue-form-errors': fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
    },
});
