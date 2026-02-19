export default function IrLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-44 bg-gray-200 rounded" />
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* IR 프레젠테이션 카드 Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <div className="h-32 w-full bg-gray-200 rounded" />
            <div className="h-5 w-2/3 bg-gray-200 rounded" />
            <div className="h-4 w-1/3 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
