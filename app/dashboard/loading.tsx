export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="skeleton h-7 w-48" />
          <div className="skeleton mt-2 h-4 w-64" />
        </div>
        <div className="skeleton h-10 w-36" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton h-64 lg:col-span-2" />
        <div className="skeleton h-64" />
      </div>
    </div>
  )
}
