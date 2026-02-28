export default function DashboardPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-lg border border-gray-200/80 px-4 py-3 shadow-sm">
        <h1 className="text-sm font-semibold text-gray-900">Dashboard</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">Overview of your system</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
          <h3 className="text-xs font-medium text-gray-600 mb-2">Welcome</h3>
          <p className="text-lg font-semibold text-gray-900">Symbiotic ERP</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
          <h3 className="text-xs font-medium text-gray-600 mb-2">System Status</h3>
          <p className="text-lg font-semibold text-green-600">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition-shadow duration-200">
          <h3 className="text-xs font-medium text-gray-600 mb-2">Version</h3>
          <p className="text-lg font-semibold text-gray-900">1.0.0</p>
        </div>
      </div>
    </div>
  )
}
