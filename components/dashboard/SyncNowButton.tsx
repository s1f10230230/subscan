'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export default function SyncNowButton() {
  const [loading, setLoading] = useState(false)
  const [persist, setPersist] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [progress, setProgress] = useState<number>(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const handleClick = async () => {
    try {
      setLoading(true)
      setLastResult(null)
      // Start optimistic progress
      setProgress(5)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setProgress((p) => Math.min(95, p + Math.max(1, Math.round((100 - p) / 10))))
      }, 400)

      const res = await fetch('/api/email/scan-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persist ? { save: true } : {}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Scan failed (${res.status})`)
      }
      const data = await res.json()
      const saved = data.saved ? ` / 保存: ${data.saved.transactionsCreated}件 (+ED ${data.saved.emailDataCreated})` : ''
      setLastResult(`検出: ${data.transactionsFound}件${saved}`)
      setProgress(100)
    } catch (e: any) {
      setLastResult(`エラー: ${e.message}`)
      setProgress(0)
    } finally {
      setLoading(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <div className="flex items-center space-x-2">
      <label className="flex items-center space-x-1 text-xs text-gray-600">
        <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
        <span>保存</span>
      </label>
      <div className="flex flex-col gap-1 min-w-[120px]">
        <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
          {loading ? '同期中…' : '同期'}
        </Button>
        {loading && (
          <Progress value={progress} className="h-1" />
        )}
      </div>
      {lastResult && (
        <span className="text-xs text-gray-600">{lastResult}</span>
      )}
    </div>
  )
}
