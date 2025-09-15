"use client"

import { useEvidenceTypes } from '@/hooks/use-evidence-types'

export default function TestHookPage() {
  const { evidenceTypes, loading, error, getSupportedRolesForEvidenceType } = useEvidenceTypes()

  if (loading) return <div>Loading evidence types...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Evidence Types Hook Test</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Test getSupportedRolesForEvidenceType:</h2>
        <div className="space-y-2">
          <div>
            <strong>微信个人主页:</strong> {JSON.stringify(getSupportedRolesForEvidenceType('微信个人主页'))}
          </div>
          <div>
            <strong>身份证:</strong> {JSON.stringify(getSupportedRolesForEvidenceType('身份证'))}
          </div>
          <div>
            <strong>公司营业执照:</strong> {JSON.stringify(getSupportedRolesForEvidenceType('公司营业执照'))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">All Evidence Types:</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(evidenceTypes, null, 2)}
        </pre>
      </div>
    </div>
  )
}
