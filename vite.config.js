import { defineConfig } from 'vite';

// The preview hostname is specific to this workspace's dev preview.
const previewHost = process.env.PREVIEW_HOST;

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: previewHost ? [previewHost] : [],
  },
});
