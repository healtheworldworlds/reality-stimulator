import type { LiveFixture } from './fixtures'

export interface IngestedMediaFile {
  name: string
  type: string
  bytes: number
}

export interface IngestMediaResult {
  status: 'available'
  source: 'vision-stub' | 'ocr-text'
  stub: boolean
  file?: IngestedMediaFile
  fixtures: LiveFixture[]
  note?: string
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export function isSupportedMediaFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
}

export async function ingestMediaFile(file: File, adminKey: string): Promise<IngestMediaResult> {
  if (!isSupportedMediaFile(file)) throw new Error('Choose an image or video file.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Files up to 25 MB are supported.')

  const form = new FormData()
  form.append('media', file, file.name)
  const response = await fetch('/api/ingest-media', {
    method: 'POST',
    headers: { 'x-admin-key': adminKey },
    body: form,
  })
  const payload = (await response.json().catch(() => null)) as (IngestMediaResult & { error?: string }) | null
  if (response.status === 401) throw new Error('The admin key is no longer valid. Lock and unlock again.')
  if (!response.ok || !payload || payload.status !== 'available') {
    throw new Error(payload?.error ?? `Media ingestion unavailable (HTTP ${response.status}).`)
  }
  if (!Array.isArray(payload.fixtures)) throw new Error('The ingestion response did not include fixtures.')
  return payload
}
