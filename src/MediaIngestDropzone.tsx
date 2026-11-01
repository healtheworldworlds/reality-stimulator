import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Upload } from 'lucide-react'
import { ingestMediaFile, isSupportedMediaFile } from './api/ingestMedia'
import type { LiveFixture } from './api/fixtures'

type IngestState = 'idle' | 'uploading' | 'done' | 'error'

type MediaIngestDropzoneProps = {
  adminKey: string
  onFixtures: (fixtures: LiveFixture[], fileName: string) => void
}

export function MediaIngestDropzone({ adminKey, onFixtures }: MediaIngestDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [dragOver, setDragOver] = useState(false)
  const [state, setState] = useState<IngestState>('idle')
  const [message, setMessage] = useState('')

  async function handleFile(file: File | undefined) {
    if (!file || state === 'uploading') return
    if (!isSupportedMediaFile(file)) {
      setState('error')
      setMessage('Choose an image or video file (PNG, JPG, MP4…).')
      return
    }
    setState('uploading')
    setMessage(`Scanning ${file.name}…`)
    try {
      const result = await ingestMediaFile(file, adminKey)
      setState('done')
      setMessage(
        `${result.fixtures.length} match${result.fixtures.length === 1 ? '' : 'es'} extracted from ${file.name}` +
        `${result.stub ? ' (vision stub)' : ''}.`,
      )
      onFixtures(result.fixtures, file.name)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Media ingestion failed.')
    }
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current += 1
    setDragOver(true)
  }

  function handleDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div className="media-ingest">
      <div
        className={`media-ingest__dropzone${dragOver ? ' is-dragover' : ''}${state === 'uploading' ? ' is-busy' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload a SportyBet screenshot or video"
        aria-disabled={state === 'uploading'}
        onClick={() => { if (state !== 'uploading') inputRef.current?.click() }}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload size={16} aria-hidden />
        <span className="media-ingest__label">
          {state === 'uploading' ? 'Scanning media…' : 'Drop a screenshot or video, or click to browse'}
        </span>
        <span className="media-ingest__hint">SportyBet IDs, kickoffs, teams and odds are extracted automatically.</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        tabIndex={-1}
        onChange={(event) => {
          void handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      {message && (
        <p className={`media-ingest__status${state === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
          {message}
        </p>
      )}
    </div>
  )
}
