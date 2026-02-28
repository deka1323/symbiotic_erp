export default function AccessControlPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Access Control</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Roles</h3>
          <p className="text-2xl font-bold text-gray-900">Manage Roles</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Modules</h3>
          <p className="text-2xl font-bold text-gray-900">Manage Modules</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Features</h3>
          <p className="text-2xl font-bold text-gray-900">Manage Features</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Users</h3>
          <p className="text-2xl font-bold text-gray-900">Manage Users</p>
        </div>
      </div>
    </div>
  )
}
