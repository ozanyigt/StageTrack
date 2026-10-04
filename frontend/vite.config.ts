import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev`     → http://localhost:5180 (cameras work on localhost without HTTPS)
// `npm run dev:lan` → https://<pc-ip>:5180 for phones on the same network; HTTPS is required
//                     for getUserMedia there. The certificate is self-signed: accept it once on the phone.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'lan' ? [basicSsl()] : [])],
  server: {
    port: 5180,
    strictPort: true,
    host: mode === 'lan' ? true : 'localhost',
    // The project lives in a OneDrive folder, where native file-change events are unreliable;
    // polling keeps hot reload working there.
    watch: { usePolling: true, interval: 500 },
    proxy: {
      '/api': { target: 'http://localhost:5080', changeOrigin: true },
    },
  },
}));
