import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configure dev server origin and HMR for usage behind ngrok/tunnels.
const NGROK_HOST = process.env.NGROK_HOST || 'ichthyolitic-nonglutenous-latosha.ngrok-free.dev';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: {
      protocol: 'wss',
      host: NGROK_HOST,
    },
    origin: `https://${NGROK_HOST}`,
  },
});
