import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()]
  /* local set up
    server: {
    host: true,   // exposes on local network
    port: 5173
    }
    */
  })
