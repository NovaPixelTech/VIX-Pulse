import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'VIX-Pulse';
export default defineConfig({
    base: `/${REPO_NAME}/`,
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
    },
});
