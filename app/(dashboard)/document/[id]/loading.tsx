import { Skeleton } from "@/components/ui/skeleton"

export default function DocumentLoading() {
  return (
    <div className="container mx-auto p-6">
      <Skeleton className="h-8 w-64 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Skeleton className="h-48 mb-4" />
          <Skeleton className="h-32" />
        </div>
        <div>
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  )
} 