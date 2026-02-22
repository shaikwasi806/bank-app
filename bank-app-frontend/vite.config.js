import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api/hf': {
                target: 'https://router.huggingface.co/v1',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/hf/, ''),
            },
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        }
    }
})
