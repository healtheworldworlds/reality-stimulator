import { timingSafeEqual } from 'node:crypto'

export function secureEquals(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export function isAdminKey(value: unknown): value is string {
  const configuredKey = process.env.ADMIN_MASTER_KEY
  return typeof value === 'string' && typeof configuredKey === 'string' && configuredKey.length > 0 &&
    secureEquals(value, configuredKey)
}

// Vercel serverless function handler - fail-closed: if ADMIN_MASTER_KEY is not set,
// always reject admin requests when the env var is missing
export default {
  async GET() {
    const key = process.env.ADMIN_MASTER_KEY
    if (!key) {
      return new Response('Admin key not configured', { status: 503 })
    }
    return new Response('admin-auth endpoint', { status: 200 })
  },
  async POST() {
    const key = process.env.ADMIN_MASTER_KEY
    if (!key) {
      return new Response('Admin key not configured', { status: 503 })
    }
    return new Response(JSON.stringify({ configured: !!key }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}