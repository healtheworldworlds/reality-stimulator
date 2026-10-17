type KickoffValue = {
  day?: 'Today' | 'Tomorrow'
  hours: number
  minutes: number
}

function parseKickoff(value: string): KickoffValue | null {
  const match = /^(?:(Today|Tomorrow),?\s*)?(\d{1,2}):([0-5]\d)(?:\s*(AM|PM))?(?:\s*(?:GMT|UTC))?$/i.exec(value.trim())
  if (!match) return null
  const [, rawDay, rawHour, rawMinutes, meridiem] = match
  let hours = Number(rawHour)
  if (meridiem) {
    if (hours < 1 || hours > 12) return null
    hours = hours % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0)
  } else if (hours > 23) {
    return null
  }
  return {
    day: rawDay ? rawDay.toLowerCase() === 'today' ? 'Today' : 'Tomorrow' : undefined,
    hours,
    minutes: Number(rawMinutes),
  }
}

export function formatKickoff(kickoffText: string, kickoffDate?: string, now = new Date()) {
  if (kickoffDate) {
    const kickoff = new Date(kickoffDate)
    if (Number.isFinite(kickoff.getTime())) {
      const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      const kickoffUtc = Date.UTC(kickoff.getUTCFullYear(), kickoff.getUTCMonth(), kickoff.getUTCDate())
      const dayDifference = Math.round((kickoffUtc - todayUtc) / 86_400_000)
      const dateLabel = dayDifference === 0
        ? 'Today'
        : dayDifference === 1
          ? 'Tomorrow'
          : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(kickoff)
      const timeLabel = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: 'h12',
        timeZone: 'UTC',
      }).format(kickoff)
      return `${dateLabel}, ${timeLabel} GMT`
    }
  }

  const parsed = parseKickoff(kickoffText)
  if (!parsed) return kickoffText
  const hour = parsed.hours % 12 || 12
  return `${parsed.day ?? 'Today'}, ${hour}:${String(parsed.minutes).padStart(2, '0')} ${parsed.hours >= 12 ? 'PM' : 'AM'} GMT`
}

export function kickoffDateForToday(kickoffText: string, startMinute: number, now = new Date()) {
  const parsed = parseKickoff(kickoffText)
  if (!parsed) return undefined
  const dayOffset = parsed.day === 'Tomorrow' ? 1 : 0
  const date = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + dayOffset,
    parsed.hours,
    parsed.minutes,
  ))
  const kickoffMinute = parsed.hours * 60 + parsed.minutes
  if (!parsed.day && kickoffMinute < startMinute) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString()
}
