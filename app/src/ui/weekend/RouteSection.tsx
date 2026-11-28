// Route section of the detail plan: track drawing and GPX export. Nothing without a track.
import { buildGpx } from '../../data/tracks';
import type { Candidate } from '../../engine/types';
import { Section } from '../components';
import { shareOrDownload } from '../files';
import { TrackMap, useTrack } from '../media';

export function RouteSection({ candidate }: { candidate: Candidate | undefined }) {
  const track = useTrack(candidate);
  if (!candidate || !track) return null;
  const fileName = `${candidate.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}.gpx`;
  const exportGpx = () => void shareOrDownload(fileName, candidate.gpx ?? buildGpx(candidate.name, track), 'application/gpx+xml');
  return (
    <Section title="GPS-Track" aside={track.source === 'gpx' ? 'eigene GPX-Datei' : track.source}>
      <TrackMap track={track} summit={candidate.summit} />
      <button type="button" className="btn" onClick={exportGpx}>
        GPX exportieren
      </button>
      {track.source !== 'gpx' && <span className="tiny muted">Routenlinie: {track.source}, ohne Gewähr – der effektive Verlauf hängt von den Verhältnissen ab.</span>}
    </Section>
  );
}
