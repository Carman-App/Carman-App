import { Redirect, useLocalSearchParams } from 'expo-router';

/** Invoicing and payment are steps on the job itself; this route opens the job. */
export default function JobStepRedirect() {
  const { id, jobId } = useLocalSearchParams<{ id?: string; jobId?: string }>();
  const target = id ?? jobId;
  return <Redirect href={target ? { pathname: '/mechanic/job-detail', params: { id: target } } : '/mechanic/invoices'} />;
}
