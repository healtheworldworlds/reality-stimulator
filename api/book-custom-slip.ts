import type { VercelRequest, VercelResponse } from '@vercel/node'

type MatchInput = { homeTeam?: unknown; awayTeam?: unknown; kickoff?: unknown; marketPick?: unknown }

const MAX_MATCHES = 30

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.CONVERT_BET_CODES_API_KEY
  if (!apiKey) {
    res.status(500).json({ success: false, error: 'Booking API key is not configured' })
    return
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) as { matches?: MatchInput[] } | null
  const matches = Array.isArray(body?.matches) ? body.matches.slice(0, MAX_MATCHES) : []
  const events = matches.flatMap((match) => {
    const home = typeof match.homeTeam === 'string' ? match.homeTeam.trim().slice(0, 80) : ''
    const away = typeof match.awayTeam === 'string' ? match.awayTeam.trim().slice(0, 80) : ''
    if (!home || !away) return []
    return [{ home_team: home, away_team: away, sport_id: 'soccer', pick: { market: 'totals', outcome: 'over_1_5' } }]
  })

  if (events.length === 0) {
    res.status(400).json({ success: false, error: 'At least one valid match is required' })
    return
  }

  try {
    const response = await fetch(`https://convertbetcodes.com/api/generate_bet_code?api_key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination_bookie: 'sportybet:gh', events }),
      signal: AbortSignal.timeout(9000),
    })
    const data = await response.json().catch(() => null) as Record<string, unknown> | null
    const bookingCode = data?.booking_code || data?.code
    if (response.ok && typeof bookingCode === 'string' && bookingCode) {
      res.status(200).json({ success: true, bookingCode })
      return
    }
    res.status(200).json({ success: false, error: (typeof data?.message === 'string' && data.message) || 'Failed to book' })
  } catch {
    res.status(200).json({ success: false, error: 'Failed to book' })
  }
}

function safeParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
