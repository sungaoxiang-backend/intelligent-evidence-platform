import useSWR from "swr"
import { useState } from "react"

interface FetchParams {
  page: number
  pageSize: number
  search?: string
}

export function usePaginatedSWR<T>(
  key: string, 
  fetcher: (params: FetchParams & { [key: string]: any }) => Promise<{ data: T[]; pagination?: any }>, 
  deps: any[] = [],
  initialPageSize = 20,
  options?: {
    revalidateOnFocus?: boolean
    revalidateOnReconnect?: boolean
    revalidateIfStale?: boolean
    dedupingInterval?: number
  }
) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  
  const swrKey = [key, page, pageSize, ...deps]
  const { data: response, error, isLoading, mutate } = useSWR(
    swrKey, 
    () => {
      // Create params object with page and pageSize
      const params: any = { page, pageSize };
      
      // If deps contains filters object, merge its properties into params
      if (deps.length === 1 && typeof deps[0] === 'object' && deps[0] !== null && !Array.isArray(deps[0])) {
        Object.assign(params, deps[0]);
      } else if (deps.length > 0) {
        // For backward compatibility, use first dep as search if it's a string
        params.search = typeof deps[0] === 'string' ? deps[0] : '';
      }
      
      return fetcher(params);
    },
    {
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
      revalidateOnReconnect: options?.revalidateOnReconnect ?? true,
      revalidateIfStale: options?.revalidateIfStale ?? true,
      dedupingInterval: options?.dedupingInterval ?? 2000,
    }
  )
  
  const data = response?.data || []
  const total = response?.pagination?.total || 0
  
  return { 
    data, 
    error, 
    loading: isLoading, 
    page, 
    pageSize, 
    total, 
    setPage, 
    setPageSize, 
    mutate 
  }
} 