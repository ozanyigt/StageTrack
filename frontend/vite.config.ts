import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import tailwindcss from '@tailwindcss/vite';

// `npm run dev`     → http://localhost:5180 (cameras work on localhost without HTTPS)
// `npm run dev:lan` → https://<pc-ip>:5180 for phones on the same network; HTTPS is required
//                     for getUserMedia there. The certificate is self-signed: accept it once on the phone.
export default defineConfig(({ mode }) => ({
  // Tailwind is only used by the LED module's screens; its reset is left out so antd keeps its own
  // styling everywhere else (see styles.css).
  plugins: [react(), tailwindcss(), ...(mode === 'lan' ? [basicSsl()] : [])],
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
