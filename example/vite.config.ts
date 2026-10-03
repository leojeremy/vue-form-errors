import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [vue()],
    // Relative asset paths, so the built example works from any sub-path
    // (GitHub Pages serves it under /vue-form-errors/).
    base: './',
    resolve: {
        // The example uses the source directly, so edits show up without a build.
        alias: { 'vue-form-errors': fileURLToPath(new URL('../src/index.ts', import.meta.url)) },
    },
});
