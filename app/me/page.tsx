import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function MePage() {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Session Debug (/me)</h1>
        {!session ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
            Not signed in. Try signing in at /signin and refresh this page.
          </div>
        ) : (
          <pre className="p-4 bg-white border rounded overflow-auto text-sm">
{JSON.stringify(session, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

