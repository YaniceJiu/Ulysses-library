const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');
const path = require('path');

module.exports = defineConfig({
  root: __dirname,
  plugins: [vue()],
  publicDir: path.join(__dirname, 'public'),
  build: {
    outDir: path.join(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'index.html'),
        admin: path.join(__dirname, 'admin', 'admin.html'),
      },
    },
  },
  server: {
    port: 8901,
    proxy: {
      '/api': 'http://localhost:8900',
      '/socket.io': { target: 'http://localhost:8900', ws: true },
      '/uploads': 'http://localhost:8900',
      '/models': 'http://localhost:8900',
      '/floorplans': 'http://localhost:8900',
    },
  },
});
