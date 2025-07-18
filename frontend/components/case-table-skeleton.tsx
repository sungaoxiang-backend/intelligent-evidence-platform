import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function CaseTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* 头部骨架 */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-3 lg:space-y-0">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* 搜索栏骨架 */}
      <div className="flex items-center gap-4 mb-2">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* 表格骨架 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-20" /></TableHead>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-24" /></TableHead>
              <TableHead><Skeleton className="h-5 w-32" /></TableHead>
              <TableHead className="text-center"><Skeleton className="h-5 w-40 mx-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                <TableCell className="flex justify-center space-x-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
