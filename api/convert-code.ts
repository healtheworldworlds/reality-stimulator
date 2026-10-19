import type { VercelRequest, VercelResponse } from '@vercel/node'

function param(req: VercelRequest, key: string, fallback = '') {
  const source = req.method === 'POST' && req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
  const value = source[key] ?? req.query[key]
  const text = Array.isArray(value) ? value[0] : value
  return typeof text === 'string' && text.trim() ? text.trim() : fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const booking_code = param(req, 'booking_code')
  const from = param(req, 'from', 'sportybet:ng')
  const to = param(req, 'to', 'sportybet:gh')
  const apiKey = process.env.CONVERT_BET_CODES_API_KEY

  if (!booking_code) {
    res.status(400).json({ success: false, error: 'booking_code is required' })
    return
  }
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'Conversion API key is not configured' })
    return
  }

  const url = `https://convertbetcodes.com/api/conversion_v2?booking_code=${encodeURIComponent(booking_code)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&api_key=${encodeURIComponent(apiKey)}`

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    const convertedCode = data?.converted_code || data?.booking_code
    if (response.ok && data && typeof convertedCode === 'string' && convertedCode) {
      res.status(200).json({ success: true, convertedCode, raw: data })
      return
    }
    res.status(200).json({ success: false, error: (typeof data?.message === 'string' && data.message) || 'Conversion failed' })
  } catch {
    res.status(200).json({ success: false, error: 'Conversion failed' })
  }
}
