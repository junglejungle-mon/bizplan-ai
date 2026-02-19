export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* 페이지 타이틀 Skeleton */}
      <div className="h-8 w-48 bg-gray-200 rounded" />

      {/* 통계 카드 Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-8 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* 컨텐츠 영역 Skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
