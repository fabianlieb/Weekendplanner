// Share a plan as a link (iOS share sheet; elsewhere copied to the clipboard).
import { packingList } from '../../engine/packing';
import { DAY_LABEL } from '../../engine/texts';
import type { Candidate, PlanB, Suggestion } from '../../engine/types';
import { showToast } from '../components';
import { dayWithDate } from '../format';
import { navigationTarget } from '../geo';
import { ShareIcon } from '../icons';
import { sharedPlanFrom, shareUrl } from '../share';

export function ShareButton({ s, candidate, tall = false }: { s: Suggestion | PlanB; candidate: Candidate | undefined; tall?: boolean }) {
  const share = async () => {
    const nav = candidate ? navigationTarget(candidate) : undefined;
    const plan = sharedPlanFrom(s, dayWithDate(s.day, s.date), packingList(s, candidate), nav ? { ...nav.point, label: nav.label } : undefined);
    const url = shareUrl(plan, window.location.href);
    const title = `${s.activityLabel}: ${s.candidateName}`;
    const text = `${title}, ${DAY_LABEL[s.day]}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link kopiert.');
    } catch {
      window.prompt('Link zum Kopieren:', url);
    }
  };

  return (
    <button type="button" className={`btn btn-icon${tall ? ' tall' : ''}`} aria-label="Plan teilen" title="Plan teilen" onClick={() => void share()}>
      <ShareIcon />
    </button>
  );
}
