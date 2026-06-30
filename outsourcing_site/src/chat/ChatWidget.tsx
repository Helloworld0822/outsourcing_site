import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { MessageCircle, Users, X } from 'lucide-react'
import { Button, TextInput } from '@primer/react'
import { API_BASE } from '../api/apiBase'
import { readJsonResponse } from '../api/http'

type ChatParticipant = {
  user_id: string
  user: { id: string; name: string; email: string } | null
}

type ChatRoom = {
  id: string
  room_type: string
  name: string | null
  project_id: string | null
  client_id: string | null
  freelancer_id: string | null
  client: { id: string; name: string; email: string } | null
  freelancer: { id: string; name: string; email: string } | null
  participants: ChatParticipant[]
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

export type ChatWidgetHandle = {
  openRoom: (roomId: string) => void
  openDirectChat: (freelancerId: string) => Promise<void>
  openProjectGroupChat: (projectId: string) => Promise<void>
}

type Props = {
  token: string
  refreshToken: string
  userId: string
  userRole: string
}

const ChatWidget = forwardRef<ChatWidgetHandle, Props>(function ChatWidget(
  { token, refreshToken, userId, userRole },
  ref,
) {
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

  async function loadRooms() {
    try {
      const res = await fetch(`${API_BASE}/api/chat/rooms`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      })
      const body = await readJsonResponse<{ data: ChatRoom[] }>(res)
      if (res.ok && body?.data) {
        setRooms(body.data)
        return body.data
      }
    } catch { /* silent */ }
    return []
  }

  async function openRoomById(roomId: string) {
    const list = rooms.length ? rooms : await loadRooms()
    const room = list.find((r) => r.id === roomId)
    if (room) {
      setIsOpen(true)
      setActiveRoom(room)
    }
  }

  async function openDirectChat(freelancerId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ freelancer_id: freelancerId }),
      })
      const body = await readJsonResponse<{ data: ChatRoom }>(res)
      if (res.ok && body?.data) {
        setIsOpen(true)
        setActiveRoom(body.data)
        await loadRooms()
      }
    } catch { /* silent */ }
  }

  async function openProjectGroupChat(projectId: string) {
    try {
      const res = await fetch(`${API_BASE}/api/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenRef.current}`,
        },
        body: JSON.stringify({ project_id: projectId }),
      })
      const body = await readJsonResponse<{ data: ChatRoom }>(res)
      if (res.ok && body?.data) {
        setIsOpen(true)
        setActiveRoom(body.data)
        await loadRooms()
      }
    } catch { /* silent */ }
  }

  useImperativeHandle(ref, () => ({
    openRoom: (roomId: string) => { void openRoomById(roomId) },
    openDirectChat,
    openProjectGroupChat,
  }))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!isOpen) return
    void loadRooms()
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
          void loadRooms()
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

  function getRoomTitle(room: ChatRoom) {
    if (room.room_type === 'group') return room.name || '팀 채팅'
    const other = userRole === 'client' ? room.freelancer : room.client
    return other?.name || '알 수 없음'
  }

  function getRoomPreview(room: ChatRoom) {
    if (room.room_type === 'group') {
      const count = room.participants?.length ?? 0
      return `${count}명 참여 중`
    }
    return '1:1 채팅'
  }

  const directRooms = rooms.filter((r) => r.room_type !== 'group')
  const groupRooms = rooms.filter((r) => r.room_type === 'group')
  const isGroup = activeRoom?.room_type === 'group'

  return (
    <>
      {isOpen && activeRoom && (
        <div className="chat-panel">
          <div className="chat-header">
            <button className="chat-back" onClick={() => setActiveRoom(null)}>←</button>
            <span className="chat-header-title flex items-center gap-1">
              {isGroup && <Users className="w-4 h-4" />}
              {getRoomTitle(activeRoom)}
            </span>
            <button className="chat-close" onClick={() => { setIsOpen(false); setActiveRoom(null) }}>✕</button>
          </div>
          <div className="chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.sender_id === userId ? 'mine' : 'theirs'}`}>
                {(isGroup || msg.sender_id !== userId) && msg.sender?.name && (
                  <div className="chat-sender">{msg.sender.name}</div>
                )}
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
            {groupRooms.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>팀 채팅</div>
                {groupRooms.map((room) => (
                  <div key={room.id} className="chat-room-item" onClick={() => setActiveRoom(room)}>
                    <div className="chat-room-avatar" style={{ background: 'var(--color-primary)' }}>
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div className="chat-room-info">
                      <div className="chat-room-name">{getRoomTitle(room)}</div>
                      <div className="chat-room-preview">{getRoomPreview(room)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
            {directRooms.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>1:1 채팅</div>
                {directRooms.map((room) => (
                  <div key={room.id} className="chat-room-item" onClick={() => setActiveRoom(room)}>
                    <div className="chat-room-avatar">{getRoomTitle(room)[0] || '?'}</div>
                    <div className="chat-room-info">
                      <div className="chat-room-name">{getRoomTitle(room)}</div>
                      <div className="chat-room-preview">{getRoomPreview(room)}</div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <button className="chat-fab" onClick={() => setIsOpen((prev) => !prev)}>
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  )
})

export default ChatWidget
