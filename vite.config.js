import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buttonCountsPlugin } from './scripts/button-counts.mjs';
export default defineConfig({ plugins: [react(), buttonCountsPlugin()] });
