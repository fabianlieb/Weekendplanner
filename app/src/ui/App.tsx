import { useEffect, useState } from 'react';
import { getDb } from '../data/db';
import { chosenSuggestion, currentWeekendPlan, feedbackWeekend } from '../data/planner';
import { getWeekendPlan, hasProfile } from '../data/repositories';
import { addDays, weekday, zurichHour, zurichToday } from '../engine/util';
import { AdminView } from './admin/AdminView';
import { Attribution, Notice, Toast } from './components';
import { smartStartView } from './smartStart';
import { navigate, useRoute, type View } from './router';
import { CheckView } from './weekend/CheckView';
import { DetailView } from './weekend/DetailView';
import { FeedbackView } from './weekend/FeedbackView';
import { StatsView } from './weekend/StatsView';
import { WeekendView } from './weekend/WeekendView';

const TABS: { view: View; label: string; matches: View[] }[] = [
  { view: 'thursday', label: 'Wochenende', matches: ['thursday', 'suggestions', 'detail'] },
  { view: 'check', label: 'Vorabend', matches: ['check'] },
  { view: 'feedback', label: 'Feedback', matches: ['feedback', 'stats'] },
  { view: 'admin', label: 'Verwaltung', matches: ['admin'] },
];

/** Picks the start screen when the app is opened without `?view=`. */
async function startView(now: Date = new Date()): Promise<{ view: View; params: Record<string, string> }> {
  const db = getDb();
  if (!(await hasProfile(db))) return { view: 'admin', params: { tab: 'profile', welcome: '1' } };
  const today = zurichToday(now);
  const plan = await currentWeekendPlan(db, now);
  const chosen = plan ? chosenSuggestion(plan) : undefined;
  const lastWeekend = feedbackWeekend(today);
  const lastPlan = await getWeekendPlan(db, lastWeekend);
  const feedbackMissing = !!lastPlan && lastPlan.weekend <= today && !(await db.feedback.get(lastWeekend));
  const view = smartStartView({
    weekday: weekday(today),
    hour: zurichHour(now),
    hasPlan: !!plan && plan.suggestions.length > 0,
    chosenUpcoming: !!chosen && (chosen.date === today || chosen.date === addDays(today, 1)),
    feedbackMissing,
  });
  return { view, params: {} };
}

function isIosSafariTab(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function App() {
  const route = useRoute();
  const [ready, setReady] = useState(() => new URLSearchParams(window.location.search).has('view'));

  useEffect(() => {
    if (ready) {
      // Deep link: still send a first-time user to the profile.
      void hasProfile(getDb()).then((has) => {
        if (!has && route.view !== 'admin') navigate('admin', { tab: 'profile', welcome: '1' }, true);
      });
      return;
    }
    void startView()
      .then((r) => navigate(r.view, r.params, true))
      .finally(() => setReady(true));
    // only on first render
  }, []);

  if (!ready) return null;

  let content;
  switch (route.view) {
    case 'admin':
      content = <AdminView params={route.params} />;
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
      // 'thursday' and 'suggestions': suggestions right away, settings via «Anpassen»
      content = <WeekendView />;
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
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <Toast />
    </>
  );
}
