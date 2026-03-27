import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if ((error as Error)?.message?.includes('Unauthorized')) return false
        return failureCount < 2
      },
      staleTime: 30_000,
    },
  },
})
