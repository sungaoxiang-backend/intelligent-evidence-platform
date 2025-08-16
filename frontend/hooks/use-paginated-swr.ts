import useSWR from "swr"
import { useState } from "react"

interface FetchParams {
  page: number
  pageSize: number
  search?: string
}

export function usePaginatedSWR<T>(
  key: string, 
  fetcher: (params: FetchParams) => Promise<{ data: T[]; pagination?: any }>, 
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
    () => fetcher({ page, pageSize, search: deps[0] || "" }),
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