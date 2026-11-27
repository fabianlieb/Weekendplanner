import { useEffect } from 'react';
import { getDb } from '../data/db';
import { hasProfile } from '../data/repositories';
import { AdminView } from './admin/AdminView';
import { Attribution, PageHead, Toast } from './components';
import { navigate, useRoute, type View } from './router';

const TABS: { view: View; label: string; matches: View[] }[] = [
  { view: 'thursday', label: 'Wochenende', matches: ['thursday', 'suggestions', 'detail'] },
  { view: 'check', label: 'Vorabend', matches: ['check'] },
  { view: 'feedback', label: 'Feedback', matches: ['feedback', 'stats'] },
  { view: 'admin', label: 'Verwaltung', matches: ['admin'] },
];

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <PageHead overline="Im Aufbau" title={title} lead="Dieser Screen folgt in Etappe 4." />
      <button type="button" className="btn btn-dark" onClick={() => navigate('admin')}>
        Zur Verwaltung
      </button>
    </>
  );
}

export function App() {
  const route = useRoute();

  // First start: no profile yet → open the profile.
  useEffect(() => {
    void hasProfile(getDb()).then((has) => {
      if (!has && route.view !== 'admin') navigate('admin', { tab: 'profile', welcome: '1' }, true);
    });
    // only on first render
  }, []);

  let content;
  switch (route.view) {
    case 'admin':
      content = <AdminView params={route.params} />;
      break;
    case 'check':
      content = <Placeholder title="Vorabend-Check" />;
      break;
    case 'feedback':
    case 'stats':
      content = <Placeholder title="Feedback" />;
      break;
    default:
      content = <Placeholder title="Dein Wochenende" />;
  }

  return (
    <>
      <main className="app">
        {content}
        <Attribution />
      </main>
      <nav className="tabbar" aria-label="Hauptnavigation">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button key={t.view} type="button" aria-current={t.matches.includes(route.view) ? 'page' : undefined} onClick={() => navigate(t.view)}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <Toast />
    </>
  );
}
