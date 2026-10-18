import { timingSafeEqual } from 'node:crypto'

const ADMIN_MASTER_KEY = 'REGINA'
const SETTINGS_KEY = 'reality-simulator:auth-settings'

type AuthSettings = {
  passwordRequired: boolean
  appAccessCode: string
}

type AuthRequest = {
  method?: string
  query?: Record<string, string | string[] | undefined>
  body?: unknown
}

type AuthResponse = {
  setHeader(name: string, value: string | number): void
  status(code: number): AuthResponse
  json(body: unknown): AuthResponse
}

const DEFAULT_SETTINGS: AuthSettings = { passwordRequired: false, appAccessCode: '1234' }
let memorySettings: AuthSettings = { ...DEFAULT_SETTINGS }

function bodyRecord(body: unknown): Record<string, unknown> | null {
  let parsed = body
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
}

function secureEquals(actual: string, expected: string) {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
}

function kvCredentials() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

async function readSettings(): Promise<AuthSettings> {
  const credentials = kvCredentials()
  if (!credentials) return memorySettings

  const response = await fetch(credentials.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', SETTINGS_KEY]),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Settings storage returned HTTP ${response.status}.`)
  const result = await response.json() as { result?: unknown }
  if (typeof result.result !== 'string') return DEFAULT_SETTINGS
  let settings: unknown
  try {
    settings = JSON.parse(result.result)
  } catch {
    throw new Error('Stored authentication settings are invalid.')
  }
  if (typeof settings !== 'object' || settings === null ||
    typeof (settings as AuthSettings).passwordRequired !== 'boolean' ||
    typeof (settings as AuthSettings).appAccessCode !== 'string') {
    throw new Error('Stored authentication settings are invalid.')
  }
  return settings as AuthSettings
}

async function writeSettings(settings: AuthSettings) {
  const credentials = kvCredentials()
  if (!credentials) {
    memorySettings = settings
    return
  }

  const response = await fetch(credentials.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', SETTINGS_KEY, JSON.stringify(settings)]),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Settings storage returned HTTP ${response.status}.`)
}

export default async function authSettingsHandler(request: AuthRequest, response: AuthResponse) {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  try {
    const action = typeof request.query?.action === 'string' ? request.query.action : ''
    if (request.method === 'GET') {
      const settings = await readSettings()
      return response.status(200).json({ passwordRequired: settings.passwordRequired })
    }
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'GET, POST')
      return response.status(405).json({ success: false, error: 'Method not allowed.' })
    }

    const body = bodyRecord(request.body)
    if (!body) return response.status(400).json({ success: false, error: 'A JSON request body is required.' })

    if (action === 'verify') {
      if (typeof body.code !== 'string') return response.status(400).json({ valid: false, error: 'A visitor access code is required.' })
      const settings = await readSettings()
      return response.status(200).json({ valid: secureEquals(body.code, settings.appAccessCode) })
    }

    if (action === 'verify-master') {
      if (typeof body.masterKey !== 'string') return response.status(400).json({ valid: false })
      return response.status(200).json({ valid: secureEquals(body.masterKey, ADMIN_MASTER_KEY) })
    }

    if (action === 'update') {
      if (typeof body.masterKey !== 'string' || !secureEquals(body.masterKey, ADMIN_MASTER_KEY)) {
        return response.status(401).json({ success: false, error: 'Unauthorized.' })
      }
      if (typeof body.passwordRequired !== 'boolean' || typeof body.newAccessCode !== 'string') {
        return response.status(400).json({ success: false, error: 'Valid passwordRequired and newAccessCode values are required.' })
      }
      if (body.newAccessCode.length > 128) {
        return response.status(400).json({ success: false, error: 'Visitor access code must be 128 characters or fewer.' })
      }
      const current = await readSettings()
      const appAccessCode = body.newAccessCode.length > 0 ? body.newAccessCode : current.appAccessCode
      await writeSettings({ passwordRequired: body.passwordRequired, appAccessCode })
      return response.status(200).json({ success: true })
    }

    return response.status(400).json({ success: false, error: 'Unknown action.' })
  } catch (error) {
    return response.status(503).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication settings are unavailable.',
    })
  }
}
