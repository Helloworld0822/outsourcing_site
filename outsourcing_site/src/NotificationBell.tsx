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
        className="btn btn-ghost"
        onClick={() => setOpen((prev) => !prev)}
        style={{ position: 'relative', padding: '6px 8px', fontSize: 16 }}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 16a2 2 0 0 0 1.985-1.75H6.015A2 2 0 0 0 8 16ZM8 1.02C4.997 1.02 2.5 3.517 2.5 6.52V9l-1 1v.5h13V10l-1-1V6.52C13.5 3.517 11.003 1.02 8 1.02Z" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'var(--error)',
            color: 'white',
            borderRadius: '50%',
            minWidth: 16,
            height: 16,
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            padding: '0 4px',
            lineHeight: 1,
          }}>
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
            width: 360,
            maxHeight: 460,
            overflowY: 'auto',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>알림</span>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost"
                onClick={markAllAsRead}
                style={{ fontSize: 12, padding: '2px 8px' }}
              >
                모두 읽음
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              알림이 없습니다.
            </div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markAsRead(n.id)}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-light)',
                cursor: n.is_read ? 'default' : 'pointer',
                background: n.is_read ? 'transparent' : 'var(--accent-light)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                transition: 'background 0.1s',
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: n.is_read ? 'transparent' : 'var(--accent)',
                marginTop: 6,
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 13, lineHeight: 1.4 }}>{n.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
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
                  fontSize: 12,
                  padding: '2px 4px',
                  flexShrink: 0,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
