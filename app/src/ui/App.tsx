import { useEffect, useState, type ReactNode } from 'react';
import { getDb } from '../data/db';
import { hasProfile } from '../data/repositories';
import { BackupScreen } from './admin/BackupScreen';
import { CandidateEditor } from './admin/CandidateEditor';
import { CandidatesScreen } from './admin/CandidatesScreen';
import { CatalogDetail } from './admin/CatalogDetail';
import { ProfileScreen } from './admin/ProfileScreen';
import { TravelTable } from './admin/TravelTable';
import { Attribution, Notice, Toast } from './components';
import { ListIcon, ProfileIcon, WeekendIcon } from './icons';
import { navigate, useRoute, type View } from './router';
import { CheckView } from './weekend/CheckView';
import { DetailView } from './weekend/DetailView';
import { SharedView } from './weekend/SharedView';
import { FeedbackView } from './weekend/FeedbackView';
import { StatsView } from './weekend/StatsView';
import { WeekendView } from './weekend/WeekendView';

const TABS: { view: View; label: string; icon: ReactNode; matches: View[] }[] = [
  { view: 'thursday', label: 'Wochenende', icon: <WeekendIcon />, matches: ['thursday', 'suggestions', 'detail', 'check', 'feedback'] },
  { view: 'list', label: 'Liste', icon: <ListIcon />, matches: ['list'] },
  { view: 'profile', label: 'Profil', icon: <ProfileIcon />, matches: ['profile', 'backup', 'stats'] },
];

function isIosSafariTab(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);

  // First start (no profile yet) → profile. Otherwise the weekend screen is home: it shows the plan,
  // the evening check and the feedback prompt at the right time.
  useEffect(() => {
    void hasProfile(getDb())
      .then((has) => {
        // A shared plan opens for anyone, also without a profile.
        if (!has && route.view !== 'profile' && route.view !== 'shared') navigate('profile', { welcome: '1' }, true);
      })
      .finally(() => setReady(true));
    // only on first render
  }, []);

  if (!ready) return null;

  const p = route.params;
  let content: ReactNode;
  switch (route.view) {
    case 'list':
      content =
        p.travel === '1' ? (
          <TravelTable />
        ) : p.catalog ? (
          <CatalogDetail key={p.catalog} id={p.catalog} />
        ) : p.edit !== undefined ? (
          <CandidateEditor id={p.edit === 'new' ? undefined : p.edit} kind={p.kind} />
        ) : (
          <CandidatesScreen welcome={p.welcome === '1'} src={p.src === 'catalog' ? 'catalog' : 'own'} />
        );
      break;
    case 'profile':
      content = <ProfileScreen welcome={p.welcome === '1'} />;
      break;
    case 'backup':
      content = <BackupScreen />;
      break;
    case 'detail':
      content = <DetailView key={p.id} id={p.id} />;
      break;
    case 'check':
      content = <CheckView />;
      break;
    case 'feedback':
      content = <FeedbackView />;
      break;
    case 'stats':
      content = <StatsView />;
      break;
    case 'shared':
      content = <SharedView />;
      break;
    default:
      // 'thursday' and 'suggestions' (deep links) → home
      content = <WeekendView params={p} />;
  }

  return (
    <>
      <main className="app">
        {isIosSafariTab() && (
          <Notice tone="warn">
            Du bist in Safari. Die App auf dem Home-Bildschirm hat eigene Daten – öffne sie über ihr Symbol (Teilen → «Zum Home-Bildschirm»).
          </Notice>
        )}
        {content}
        <Attribution />
      </main>
      <nav className="tabbar" aria-label="Hauptnavigation">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.view} type="button" aria-current={t.matches.includes(route.view) ? 'page' : undefined} onClick={() => navigate(t.view)}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <Toast />
    </>
  );
}
