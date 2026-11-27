// `npm run demo`: prints the suggestions for the test scenario (not part of the test suite).
import { test } from 'vitest';
import { context } from './__fixtures__/scenario';
import { suggest } from './suggest';
import { DAY_LABEL } from './texts';
import type { Suggestion } from './types';
import { formatTime } from './util';

function print(title: string, s: Suggestion, extra = ''): string {
  const lines = [
    `${title} · ${s.activityLabel} · ${DAY_LABEL[s.day]}${s.isNew ? ' · neu' : ''}${extra}`,
    `  ${s.candidateName}${s.region ? ` (${s.region})` : ''} — Score ${s.score} (Bedingungen ${s.conditionScore}, Passung ${s.fitScore})`,
    `  ${s.reasons.join(' ')}`,
    `  Anreise ${s.travel.minutes} min ab ${s.travel.startPointName}${s.travel.estimated ? ' (geschätzt)' : ''}` +
      (s.photo ? ` · Fotospot ${s.photo.spotName}, ${s.photo.lightLabel} ${formatTime(s.photo.time)}` : '') +
      (s.priceChf !== undefined ? ` · CHF ${s.priceChf}` : ''),
  ];
  if (s.risk.applies) lines.push(`  ${s.risk.label} · ${s.risk.dangerLabel} · ${s.risk.freshnessNote}`, `  ${s.risk.bulletinHint}`);
  if (s.risk.groupNote) lines.push(`  ${s.risk.groupNote}`);
  lines.push(`  Zeitplan: ${s.schedule.map((i) => `${formatTime(i.time)} ${i.label}`).join(' | ')}`);
  return lines.join('\n');
}

test('demo', () => {
  const result = suggest(context());
  const out = result.suggestions.map((s, i) => print(String(i + 1), s));
  if (result.planB) out.push(print('Plan B', result.planB, ` — ${result.planB.planBReason}`));
  out.push(
    '',
    'Ausgeschlossen:',
    ...result.excluded.map((e) => `  ${e.candidateId} ${e.day} ${e.slot}: ${e.reasons.join(', ')}`),
  );
  console.log(out.join('\n\n'));
});
