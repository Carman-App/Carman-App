import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/ui/Blocks';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import type { Job } from '@/data/hooks';
import { STATUS_META, jobNumber, jobTotal } from '@/features/mechanic/jobs';
import { formatDateShort, formatNumber } from '@/lib/format';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

/** A job on the board: customer, total, vehicle and job number, the reported problem, and its state. */
export function JobRow({ job, all }: { job: Job; all: Job[] }) {
  const s = STATUS_META[job.status];
  const total = jobTotal(job);
  return (
    <Pressable onPress={() => router.push({ pathname: '/mechanic/job-detail', params: { id: job.id } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F7F5F2' }]}>
      <IconGlyph glyph="vehicle" size={32} shape="tile" bg={s.tint} fg={s.color === Colors.cta ? Colors.warning : s.color} />
      <View style={styles.flex}>
        <View style={styles.between}>
          <T variant="bodyStrong" style={styles.flex}>
            {job.customer?.name ?? 'Customer'}
          </T>
          <T style={styles.total}>{formatNumber(total)}</T>
        </View>
        <View style={styles.between}>
          <T variant="eyebrow" color={Colors.slate} style={styles.flex} numberOfLines={1}>
            {(job.vehicleDescription ?? 'Vehicle').toUpperCase()} · JOB {jobNumber(job, all)}
          </T>
          <T variant="small">{job.lines.length ? `${job.lines.length} line${job.lines.length === 1 ? '' : 's'}` : 'No lines'}</T>
        </View>
        <T variant="body" style={styles.fault} numberOfLines={2}>
          {job.faultDescription}
        </T>
        {job.status === 'IN_PROGRESS' || job.status === 'APPROVED' ? (
          <View style={styles.progress}>
            <View style={styles.flex}>
              <ProgressBar progress={job.status === 'IN_PROGRESS' ? 0.5 : 0.15} />
            </View>
            <T variant="small" color={Colors.accent}>
              {s.label}
            </T>
          </View>
        ) : (
          <View style={[styles.tag, { backgroundColor: s.tint }]}>
            <T style={[styles.tagText, { color: s.color === Colors.cta ? Colors.warning : s.color }]}>
              {s.label} · {formatDateShort(job.updatedAt.slice(0, 10))}
            </T>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  flex: {
    flex: 1,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  total: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.ink,
  },
  fault: {
    marginBottom: 10,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  tagText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
  },
});
