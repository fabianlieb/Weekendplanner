import { Choice, PageHead } from '../components';
import { navigate } from '../router';
import { BackupScreen } from './BackupScreen';
import { CandidateEditor } from './CandidateEditor';
import { CandidatesScreen } from './CandidatesScreen';
import { ProfileScreen } from './ProfileScreen';
import { RiskScreen } from './RiskScreen';
import { TravelTable } from './TravelTable';

type Tab = 'profile' | 'list' | 'risk' | 'backup';
const TABS: { value: Tab; label: string }[] = [
  { value: 'risk', label: 'Risiko' },
  { value: 'list', label: 'Liste' },
  { value: 'profile', label: 'Profil' },
  { value: 'backup', label: 'Backup' },
];

export function AdminView({ params }: { params: Record<string, string> }) {
  const tab = (TABS.some((t) => t.value === params.tab) ? params.tab : 'risk') as Tab;

  if (tab === 'list' && params.travel === '1') return <TravelTable />;
  if (tab === 'list' && params.edit !== undefined) {
    return <CandidateEditor id={params.edit === 'new' ? undefined : params.edit} kind={params.kind} />;
  }

  return (
    <>
      <PageHead overline="Verwaltung" title={{ profile: 'Profil', list: 'Eigene Liste', risk: 'Risiko-Eingabe', backup: 'Backup' }[tab]} />
      <Choice label="Bereich" options={TABS} value={tab} onChange={(t) => navigate('admin', { tab: t }, true)} />
      {tab === 'profile' && <ProfileScreen welcome={params.welcome === '1'} />}
      {tab === 'list' && <CandidatesScreen />}
      {tab === 'risk' && <RiskScreen />}
      {tab === 'backup' && <BackupScreen />}
    </>
  );
}
