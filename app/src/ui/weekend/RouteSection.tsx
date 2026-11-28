// Route section of the detail plan: track drawing, open in the swisstopo app or Guru Maps,
// GPX file. Nothing without a track.
import { buildGpx, guruMapsUrl, publicGpxUrl, swisstopoAppUrl } from '../../data/tracks';
import type { Candidate } from '../../engine/types';
import { Section } from '../components';
import { shareOrDownload } from '../files';
import { TrackMap, useTrack } from '../media';

export function RouteSection({ candidate }: { candidate: Candidate | undefined }) {
  const track = useTrack(candidate);
  const gpxUrl = publicGpxUrl(candidate);
  // Catalogue route: the map-app buttons work even if the drawing cannot be loaded (offline).
  if (!candidate || (!track && !gpxUrl)) return null;
  const fileName = `${candidate.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}.gpx`;
  const shareGpx = () => {
    const text = candidate.gpx ?? (track ? buildGpx(candidate.name, track) : undefined);
    if (text) void shareOrDownload(fileName, text, 'application/gpx+xml');
  };
  const source = track?.source ?? candidate.source ?? 'swisstopo';
  return (
    <Section title="GPS-Track" aside={source === 'gpx' ? 'eigene GPX-Datei' : source}>
      {track && <TrackMap track={track} summit={candidate.summit} />}
      {gpxUrl ? (
        <>
          <span className="small">Route öffnen in</span>
          <div className="row-wrap">
            <a className="btn grow" href={swisstopoAppUrl(gpxUrl)} target="_blank" rel="noreferrer">
              swisstopo
            </a>
            <a className="btn grow" href={guruMapsUrl(gpxUrl)}>
              Guru Maps
            </a>
          </div>
          {track && (
            <button type="button" className="link-quiet" onClick={shareGpx}>
              GPX-Datei für eine andere App
            </button>
          )}
        </>
      ) : (
        <>
          <button type="button" className="btn" onClick={shareGpx}>
            GPX teilen
          </button>
          <span className="tiny muted">Eigene GPX-Datei: im Teilen-Menü swisstopo oder Guru Maps wählen.</span>
        </>
      )}
      {source !== 'gpx' && <span className="tiny muted">Routenlinie: {source}, ohne Gewähr – der effektive Verlauf hängt von den Verhältnissen ab.</span>}
    </Section>
  );
}
