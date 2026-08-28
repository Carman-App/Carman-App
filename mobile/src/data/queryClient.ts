import { QueryClient } from '@tanstack/react-query';

/**
 * Single shared QueryClient instance. Exported (not just handed to
 * `QueryClientProvider` in _layout.tsx) so `@/data/repo`'s mutation
 * functions can call `queryClient.invalidateQueries(...)` directly after a
 * write succeeds, without every call site needing to wire up `useMutation`
 * + `onSuccess` boilerplate itself. See `@/data/queryKeys` for the key
 * structure mutations invalidate against.
 *
 * Retry policy: sparing by design. A mobile client on a flaky network
 * shouldn't hammer a server that's genuinely down, but it also shouldn't
 * hide a real failure behind endless silent retries — one retry for reads,
 * none for writes (mutations never retry by default in React Query).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
