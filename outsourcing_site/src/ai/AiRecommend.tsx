import { useState, type ChangeEvent } from 'react'
import { API_BASE } from '../api/apiBase'
import { readJsonResponse, formatError } from '../api/http'

type Project = {
  id: string
  title: string
  description: string
  skills: string[]
  budget: string
  client_name: string | null
  inserted_at: string | null
}

type Recommendation = {
  project_id: string
  reason: string
  project: Project | null
}

type AiResult = {
  recommendations: Recommendation[]
  summary: string
}

export default function AiRecommend({ token }: { token: string | null }) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState<AiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRecommend() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${API_BASE}/api/ai/recommend`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt }),
      })
      const body = await readJsonResponse<AiResult & { error?: unknown }>(res)
      if (!res.ok) {
        setError(formatError((body as { error?: unknown } | null)?.error, 'AI 추천 실패'))
      } else if (body) {
        setResult(body)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="var(--accent)"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22a.75.75 0 0 0-1.06-1.06L7.25 7.69 5.78 6.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z"/></svg>
        <span style={{ fontSize: 15, fontWeight: 600 }}>AI 외주 추천</span>
      </div>

      <div className="card-body">
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16, marginTop: 0 }}>
          보유 기술, 희망 예산, 원하는 작업 유형을 입력하면 적합한 프로젝트를 추천해드립니다.
        </p>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            className="form-textarea"
            value={prompt}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
            placeholder="예) React와 TypeScript를 잘 다루고, 예산은 100만원 이상이면 좋겠습니다. 프론트엔드 작업을 원해요."
            rows={3}
            style={{ flex: 1, minHeight: 80 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleRecommend}
            disabled={loading || !prompt.trim()}
            style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
          >
            {loading ? '분석 중...' : '추천받기'}
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--error)' }}>{error}</p>
        )}

        {result && (
          <div style={{ marginTop: 20 }}>
            {result.summary && (
              <div style={{
                background: 'var(--accent-light)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: 14,
                color: 'var(--text)',
              }}>
                {result.summary}
              </div>
            )}

            {result.recommendations.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>현재 조건에 맞는 프로젝트가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.recommendations.map((rec, i) => (
                  <div
                    key={rec.project_id}
                    className="card"
                    style={{ boxShadow: 'none' }}
                  >
                    <div className="card-body" style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          color: 'white',
                          fontSize: 12,
                          fontWeight: 'bold',
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>
                          {rec.project?.title ?? rec.project_id}
                        </span>
                      </div>
                      {rec.project && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                          {rec.project.skills.map(s => (
                            <span key={s} className="chip">{s}</span>
                          ))}
                          {rec.project.budget && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
                              예산: {rec.project.budget}
                            </span>
                          )}
                        </div>
                      )}
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{rec.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
