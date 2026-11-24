import { MediaIngestDropzone } from './MediaIngestDropzone'
import type { LiveFixture } from './api/fixtures'

type MediaIngestGateProps = {
  adminKey: string
  onFixtures: (fixtures: LiveFixture[], fileName: string) => void
}

export function MediaIngestGate({ adminKey, onFixtures }: MediaIngestGateProps) {
  return (
    <div className="media-ingest">
      <MediaIngestDropzone adminKey={adminKey} onFixtures={onFixtures} />
    </div>
  )
}
