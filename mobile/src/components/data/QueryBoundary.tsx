import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { T } from '@/components/ui/Typography';
import { ApiError, NetworkError } from '@/data/api/client';
import { Colors, Spacing } from '@/theme/tokens';

type QueryLike<T> = {
  data: T | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
};

type QueryBoundaryProps<T> = {
  query: QueryLike<T>;
  /** Renders the loaded data. Only called once `data` is present and non-empty (per `isEmpty`). */
  children: (data: T) => ReactNode;
  /**
   * Returns true when `data` should be treated as "nothing here yet" rather
   * than content — defaults to checking `Array.isArray(data) && data.length === 0`.
   * Pass `false` explicitly (or a custom check) for non-list data.
   */
  isEmpty?: (data: T) => boolean;
  empty?: { glyph: string; title: string; body: string; action?: ReactNode };
  /** Compact inline spinner instead of a full centered block — for small widgets embedded in a larger screen. */
  compact?: boolean;
};

function defaultIsEmpty(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/**
 * Shared loading/error/empty/content pattern for every screen backed by a
 * `useQuery` result. Loading and error states are a real product
 * requirement (see AGENTS.md item 6) — this exists so ~40 fetching screens
 * don't each hand-roll the same three branches.
 *
 * Usage:
 *   const vehicleQuery = useVehicle(id);
 *   return (
 *     <QueryBoundary query={vehicleQuery} empty={{ glyph: 'vehicle', title: '...', body: '...' }}>
 *       {(vehicle) => <VehicleDetail vehicle={vehicle} />}
 *     </QueryBoundary>
 *   );
 */
export function QueryBoundary<T>({ query, children, isEmpty = defaultIsEmpty, empty, compact }: QueryBoundaryProps<T>) {
  if (query.isLoading) {
    return (
      <View style={compact ? styles.compactCenter : styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  if (query.isError) {
    return (
      <View style={compact ? styles.compactCenter : styles.center}>
        <T variant="body" color={Colors.textMuted} center style={styles.errorText}>
          {errorMessage(query.error)}
        </T>
        <Button variant="secondary" size="md" onPress={() => query.refetch()} style={styles.retryButton}>
          Try again
        </Button>
      </View>
    );
  }

  // Loose check on purpose: some queryFns resolve `null` for "not found"
  // (React Query forbids ever resolving `undefined`), others simply haven't
  // settled data yet — both should fall through to the same blank render
  // rather than reaching `children` with nothing to work with.
  if (query.data == null) {
    return null;
  }

  if (isEmpty(query.data)) {
    if (empty) {
      return (
        <EmptyState glyph={empty.glyph} title={empty.title} body={empty.body}>
          {empty.action}
        </EmptyState>
      );
    }
    return null;
  }

  return <>{children(query.data)}</>;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  compactCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  errorText: {
    maxWidth: 300,
  },
  retryButton: {
    minWidth: 160,
  },
});
