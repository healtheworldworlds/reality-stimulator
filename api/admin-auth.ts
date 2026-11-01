import { timingSafeEqual } from 'node:crypto'

// Prototype-only hard-coded admin key. Replace with a server-only environment
// secret before relying on admin access in production (see README security notes).
const ADMIN_MASTER_KEY = 'REGINA'

export function secureEquals(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

export function isAdminKey(value: unknown): value is string {
  return typeof value === 'string' && secureEquals(value, ADMIN_MASTER_KEY)
}
