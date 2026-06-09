import { useEffect, useRef, useState } from 'react'
import { Button, TextInput } from '@primer/react'
import { API_BASE } from './apiBase'
import { readJsonResponse } from './http'

type ChatRoom = {
  id: string
  client_id: string
  freelancer_id: string
  client: { id: string; name: string; email: string } | null
  freelancer: { id: string; name: string; email: string } | null
  inserted_at: string | null
  updated_at: string | null
}

type ChatMessage = {
  id: string
  chat_room_id: string
  sender_id: string
  content: string
  sender: { id: string; name: string } | null
  inserted_at: string | null
}

type Props = {
  token: string
  refreshToken: string
  userId: string
  userRole: string
}

export default function ChatWidget({ token, refreshToken, userId, userRole }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const tokenRef = useRef(token)
  const refreshRef = useRef(refreshToken)
  const activeRoomRef = useRef(activeRoom)

  useEffect(() => {
    tokenRef.current = token
    refreshRef.current = refreshToken
    activeRoomRef.current = activeRoom
  }, [token, refreshToken, activeRoom])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isOpen) return
    const ctrl = new AbortController()

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/chat/rooms`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          signal: ctrl.signal,
        })
        const body = await readJsonResponse<{ data: ChatRoom[] }>(res)
        if (res.ok && body?.data) setRooms(body.data)
      } catch { /* silent */ }
    }

    load()
    return () => ctrl.abort()
  }, [isOpen])

  useEffect(() => {
    if (!activeRoom) return
    const ctrl = new AbortController()

    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/chat/rooms/${activeRoom!.id}/messages`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          signal: ctrl.signal,
        })
        const body = await readJsonResponse<{ data: ChatMessage[] }>(res)
        if (res.ok && body?.data) setMessages(body.data)
      } catch { /* silent */ }
    }

    load()
    return () => ctrl.abort()
  }, [activeRoom])

  useEffect(() => {
    if (!isOpen) return

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws?token=${encodeURIComponent(tokenRef.current)}&refresh_token=${encodeURIComponent(refreshRef.current)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'chat') {
          if (activeRoomRef.current && msg.data.chat_room_id === activeRoomRef.current.id) {
            setMessages((prev) => [...prev, msg.data])
          }
          const ctrl = new AbortController()
          fetch(`${API_BASE}/api/chat/rooms`, {
            headers: { Authorization: `Bearer ${tokenRef.current}` },
            signal: ctrl.signal,
          })
            .then((r) => readJsonResponse<{ data: ChatRoom[] }>(r))
            .then((body) => { if (body?.data) setRooms(body.data) })
            .catch(() => {})
        }
      } catch { /* silent */ }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [isOpen])

  async function sendMessage() {
    if (!activeRoom || !inputValue.trim()) return
    const content = inputValue.trim()
    setInputValue('')

    try {
      const res = await fetch(`${API_BASE}/api/chat/rooms/${activeRoom.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      })
      const body = await readJsonResponse<{ data: ChatMessage }>(res)
      if (res.ok && body?.data) setMessages((prev) => [...prev, body.data])
    } catch {
      setInputValue(content)
    }
  }

  function getOtherUser(room: ChatRoom) {
    return userRole === 'client' ? room.freelancer : room.client
  }

  return (
    <>
      {isOpen && activeRoom && (
        <div className="chat-panel">
          <div className="chat-header">
            <button className="chat-back" onClick={() => setActiveRoom(null)}>←</button>
            <span className="chat-header-title">{getOtherUser(activeRoom)?.name || '알 수 없음'}</span>
            <button className="chat-close" onClick={() => { setIsOpen(false); setActiveRoom(null) }}>✕</button>
          </div>
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender_id === userId ? 'mine' : 'theirs'}`}>
                {msg.sender_id !== userId && <div className="chat-sender">{msg.sender?.name}</div>}
                <div className="chat-bubble">{msg.content}</div>
                {msg.inserted_at && (
                  <div className="chat-time">{new Date(msg.inserted_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-area">
            <TextInput
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="메시지를 입력하세요..."
              style={{ flex: 1 }}
            />
            <Button variant="primary" onClick={sendMessage} disabled={!inputValue.trim()}>전송</Button>
          </div>
        </div>
      )}

      {isOpen && !activeRoom && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-title">채팅</span>
            <button className="chat-close" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          <div className="chat-rooms">
            {rooms.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>채팅방이 없습니다.</div>
            )}
            {rooms.map((room) => {
              const other = getOtherUser(room)
              return (
                <div key={room.id} className="chat-room-item" onClick={() => setActiveRoom(room)}>
                  <div className="chat-room-avatar">{other?.name?.[0] || '?'}</div>
                  <div className="chat-room-info">
                    <div className="chat-room-name">{other?.name || '알 수 없음'}</div>
                    <div className="chat-room-preview">채팅 시작하기...</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button className="chat-fab" onClick={() => setIsOpen((prev) => !prev)}>
        {isOpen ? '✕' : '💬'}
      </button>
    </>
  )
}
