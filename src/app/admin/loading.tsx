export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-40 bg-gray-200 rounded" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-7 w-12 bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="h-5 w-28 bg-gray-200 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-1/4 bg-gray-200 rounded" />
              <div className="h-4 w-1/3 bg-gray-200 rounded" />
              <div className="h-4 w-1/6 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
