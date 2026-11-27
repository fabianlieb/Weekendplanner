import { useState } from 'react';
import { backupFileName, exportData, importJson, type ImportMode, type ValidationResult } from '../../data/backup';
import { getDb } from '../../data/db';
import { Choice, Notice, Section, showToast, useAsync } from '../components';
import { shareOrDownload } from '../files';
import { SEED_CANDIDATES } from '../../data/seed';
import { loadSeed } from './CandidatesScreen';

export function BackupScreen() {
  const db = getDb();
  const { data: counts, reload } = useAsync(
    async () => ({
      candidates: await db.candidates.count(),
      risks: await db.riskEntries.count(),
      feedback: await db.feedback.count(),
      plans: await db.weekendPlans.count(),
    }),
    [],
  );
  const [mode, setMode] = useState<ImportMode>('merge');
  const [result, setResult] = useState<ValidationResult>();

  const doExport = async () => {
    const backup = await exportData(db);
    await shareOrDownload(backupFileName(), JSON.stringify(backup, null, 2));
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    if (mode === 'replace' && !window.confirm('Alle Daten auf diesem Gerät (Profil, Liste, Risiko, Feedback, Pläne) durch das Backup ersetzen?')) return;
    const r = await importJson(db, await file.text(), mode);
    setResult(r);
    if (r.ok) showToast('Import abgeschlossen.');
    reload();
  };

  const addSeed = async () => {
    const n = await loadSeed();
    showToast(n ? `${n} Einträge aus der Startliste hinzugefügt.` : 'Startliste ist schon vollständig vorhanden.');
    reload();
  };

  return (
    <div className="stack">
      <Notice>Deine Daten liegen nur auf diesem Gerät. Mach regelmässig ein Backup, z. B. nach jedem Wochenende.</Notice>

      <Section title="Export" aside={counts ? `${counts.candidates} Einträge · ${counts.feedback} Feedbacks` : undefined}>
        <button type="button" className="btn btn-dark" onClick={() => void doExport()}>
          Backup als JSON speichern
        </button>
      </Section>

      <Section title="Import">
        <Choice<ImportMode>
          label="Import-Art"
          options={[
            { value: 'merge', label: 'Zusammenführen' },
            { value: 'replace', label: 'Alles ersetzen' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <span className="tiny muted">
          {mode === 'merge'
            ? 'Fügt hinzu und überschreibt Einträge mit gleicher ID. Eine reine Kandidatenliste wird immer zusammengeführt.'
            : 'Löscht Profil, Liste, Risiko, Feedback und Pläne auf diesem Gerät und übernimmt das Backup.'}
        </span>
        <label className="btn">
          JSON-Datei wählen
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void doImport(e.target.files?.[0])} />
        </label>
        {result && !result.ok && (
          <div className="errors" role="alert">
            <strong>Import abgebrochen, nichts wurde geändert:</strong>
            {result.errors.slice(0, 12).map((e) => (
              <div key={e}>{e}</div>
            ))}
            {result.errors.length > 12 && <div>… und {result.errors.length - 12} weitere</div>}
          </div>
        )}
        {result?.ok && (
          <span className="small">
            Übernommen: {result.data.candidates.length} Einträge
            {result.data.kind === 'backup' && `, ${result.data.riskEntries.length} Risikoeinträge, ${result.data.feedback.length} Feedbacks`}.
            {result.warnings.map((w) => (
              <span key={w} className="muted">
                {' '}
                {w}
              </span>
            ))}
          </span>
        )}
      </Section>

      <Section title="Startliste">
        <span className="small muted">{SEED_CANDIDATES.length} Beispiele (Ski, Skitour, Schneeschuh, Fotospots). Bestehende Einträge bleiben unverändert. Koordinaten und Zeiten bitte prüfen.</span>
        <button type="button" className="btn" onClick={() => void addSeed()}>
          Startliste hinzufügen
        </button>
      </Section>
    </div>
  );
}
