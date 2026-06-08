import { useState, type ChangeEvent } from 'react'
import { Button, Heading, Text } from '@primer/react'
import { CopilotIcon } from '@primer/octicons-react'
import { API_BASE } from './apiBase'
import { readJsonResponse, formatError } from './http'

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
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
      background: 'var(--surface)',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CopilotIcon size={20} />
        <Heading as="h3" style={{ margin: 0, fontSize: 18 }}>AI 외주 추천</Heading>
      </div>
      <Text color="fg.muted" style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>
        보유 기술, 희망 예산, 원하는 작업 유형을 입력하면 적합한 프로젝트를 추천해드립니다.
      </Text>

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={prompt}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
          placeholder="예) React와 TypeScript를 잘 다루고, 예산은 100만원 이상이면 좋겠습니다. 프론트엔드 작업을 원해요."
          rows={3}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface-strong)',
            color: 'inherit',
            resize: 'vertical',
            fontSize: 14,
          }}
        />
        <Button
          variant="primary"
          onClick={handleRecommend}
          disabled={loading || !prompt.trim()}
          style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
        >
          {loading ? '분석 중...' : '추천받기'}
        </Button>
      </div>

      {error && (
        <Text color="danger.fg" style={{ display: 'block', marginTop: 10, fontSize: 14 }}>{error}</Text>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          {result.summary && (
            <div style={{
              background: 'var(--code-bg)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 12,
              fontSize: 14,
            }}>
              <Text>{result.summary}</Text>
            </div>
          )}

          {result.recommendations.length === 0 ? (
            <Text color="fg.muted" style={{ fontSize: 14 }}>현재 조건에 맞는 프로젝트가 없습니다.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {result.recommendations.map((rec, i) => (
                <div
                  key={rec.project_id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    background: 'var(--bg)',
                  }}
                >
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
                    <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                      {rec.project?.title ?? rec.project_id}
                    </Text>
                  </div>
                  {rec.project && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {rec.project.skills.map(s => (
                        <span key={s} style={{
                          fontSize: 11,
                          border: '1px solid var(--border)',
                          borderRadius: 999,
                          padding: '1px 7px',
                        }}>{s}</span>
                      ))}
                      {rec.project.budget && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          예산: {rec.project.budget}
                        </span>
                      )}
                    </div>
                  )}
                  <Text color="fg.muted" style={{ fontSize: 13, display: 'block' }}>{rec.reason}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
