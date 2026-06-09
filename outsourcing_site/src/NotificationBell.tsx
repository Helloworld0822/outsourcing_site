import { useEffect, useRef, useState } from 'react'
import { API_BASE } from './apiBase'
import { readJsonResponse } from './http'

export type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  ref_id: string | null
  is_read: boolean
  inserted_at: string | null
}

const typeIcon: Record<string, string> = {
  order: '📦',
  application: '📩',
  order_status: '🔄',
  application_status: '🔄',
  system: '🔔',
}

type Props = {
  token: string
  refreshToken: string
}

export default function NotificationBell({ token, refreshToken }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const tokenRef = useRef(token)
  const refreshRef = useRef(refreshToken)

  useEffect(() => {
    tokenRef.current = token
    refreshRef.current = refreshToken
  }, [token, refreshToken])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    const ctrl = new AbortController()

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/notifications`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          signal: ctrl.signal,
        })
        const body = await readJsonResponse<{ data: Notification[] }>(res)
        if (res.ok && body?.data) {
          setNotifications(body.data)
        }
      } catch {
        // silent
      }
    }

    load()

    const wsBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
    const wsUrl = `${wsBase}?token=${encodeURIComponent(tokenRef.current)}&refresh_token=${encodeURIComponent(refreshRef.current)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'notification') {
          setNotifications((prev) => [msg.data, ...prev])
        }
      } catch {
        // silent
      }
    }

    return () => {
      ctrl.abort()
      ws.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function markAsRead(id: string) {
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      // silent
    }
  }

  async function deleteNotification(id: string) {
    try {
      const res = await fetch(`${API_BASE}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch {
      // silent
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          padding: '4px 8px',
          color: 'inherit',
          borderRadius: 6,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: 18,
              height: 18,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="notification-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            width: 380,
            maxHeight: 480,
            overflowY: 'auto',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>알림</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                모두 읽음
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>알림이 없습니다.</div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                cursor: n.is_read ? 'default' : 'pointer',
                background: n.is_read ? 'transparent' : 'var(--surface)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                {typeIcon[n.type] || '🔔'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.is_read ? 'normal' : 700, fontSize: 14 }}>{n.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>
                  {n.message}
                </div>
                {n.inserted_at && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                    {new Date(n.inserted_at).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteNotification(n.id)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: 14,
                  padding: '2px 4px',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
