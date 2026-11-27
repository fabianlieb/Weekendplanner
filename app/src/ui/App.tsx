import { useEffect } from 'react';
import { getDb } from '../data/db';
import { hasProfile } from '../data/repositories';
import { AdminView } from './admin/AdminView';
import { Attribution, Toast } from './components';
import { navigate, useRoute, type View } from './router';
import { CheckView } from './weekend/CheckView';
import { DetailView } from './weekend/DetailView';
import { FeedbackView } from './weekend/FeedbackView';
import { StatsView } from './weekend/StatsView';
import { SuggestionsView } from './weekend/SuggestionsView';
import { ThursdayView } from './weekend/ThursdayView';

const TABS: { view: View; label: string; matches: View[] }[] = [
  { view: 'thursday', label: 'Wochenende', matches: ['thursday', 'suggestions', 'detail'] },
  { view: 'check', label: 'Vorabend', matches: ['check'] },
  { view: 'feedback', label: 'Feedback', matches: ['feedback', 'stats'] },
  { view: 'admin', label: 'Verwaltung', matches: ['admin'] },
];

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
    case 'suggestions':
      content = <SuggestionsView />;
      break;
    case 'detail':
      content = <DetailView key={route.params.id} id={route.params.id} />;
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
    default:
      content = <ThursdayView />;
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
