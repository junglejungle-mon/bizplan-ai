export default function ProgramsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded" />

      {/* 검색 + 필터 Skeleton */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 bg-gray-200 rounded-lg" />
        <div className="h-10 w-28 bg-gray-200 rounded-lg" />
      </div>

      {/* 프로그램 리스트 Skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-2">
            <div className="h-5 w-2/3 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="flex gap-2 mt-2">
              <div className="h-6 w-14 bg-gray-200 rounded-full" />
              <div className="h-6 w-20 bg-gray-200 rounded-full" />
              <div className="h-6 w-24 bg-gray-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
