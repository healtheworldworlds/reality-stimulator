import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const baseSecurityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
}

export default defineConfig(({ mode }) => {
  const development = mode !== 'production'
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval'${development ? " 'unsafe-inline'" : ''}`,
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
  const headers = {
    ...baseSecurityHeaders,
    'Content-Security-Policy': contentSecurityPolicy,
  }

  return {
    plugins: [react(), tailwindcss()],
    envPrefix: 'VITE_',
    build: {
      sourcemap: false,
    },
    server: { headers },
    preview: { headers: { ...baseSecurityHeaders, 'Content-Security-Policy': contentSecurityPolicy } },
  }
})
