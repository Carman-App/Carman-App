import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useJobs } from '@/data/hooks';
import { JobRow } from '@/features/mechanic/JobRow';

const BILLED = new Set(['INVOICED', 'PARTIALLY_PAID', 'PAID']);

/** Invoices: every job that has been invoiced, owed first. */
export default function InvoicesScreen() {
  const workshop = useActiveWorkshop().data;
  const jobsQ = useJobs(workshop?.id ?? undefined);
  const all = jobsQ.data ?? [];
  const billed = all.filter((j) => BILLED.has(j.status)).sort((a, b) => (a.status === 'PAID' ? 1 : 0) - (b.status === 'PAID' ? 1 : 0));
  return (
    <Screen padded={false} header={<TopBar title="Invoices" right={`${billed.filter((j) => j.status !== 'PAID').length} owed`} />} headerRule>
      <QueryBoundary query={{ ...jobsQ, data: billed }} empty={{ glyph: 'invoice', title: 'No invoices yet.', body: 'A job is invoiced once it is ready for collection.' }}>
        {(jobs) => jobs.map((j) => <JobRow key={j.id} job={j} all={all} />)}
      </QueryBoundary>
    </Screen>
  );
}
