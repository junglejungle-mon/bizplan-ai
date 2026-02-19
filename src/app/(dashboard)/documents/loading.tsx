export default function DocumentsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-36 bg-gray-200 rounded" />

      {/* 문서 리스트 Skeleton */}
      <div className="bg-white rounded-lg border border-gray-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="h-10 w-10 bg-gray-200 rounded" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-1/3 bg-gray-200 rounded" />
                <div className="h-3 w-1/4 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
