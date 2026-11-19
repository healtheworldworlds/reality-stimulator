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
