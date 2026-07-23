import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { io, Socket } from 'socket.io-client'
import GameView from '@/components/GameView'

export default function GamePage() {
  const router = useRouter()
  const { code } = router.query
  const [socket, setSocket] = useState<Socket | null>(null)
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)
  const [lobbyData, setLobbyData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    const s = io({ path: '/socket.io' })
    setSocket(s)
    return () => { s.close() }
  }, [code])

  useEffect(() => {
    if (!socket) return

    socket.on('lobby_joined', (data) => {
      setLobbyData(data)
      setJoined(true)
    })

    socket.on('error', ({ message }) => {
      setError(message)
    })

    return () => {
      socket.off('lobby_joined')
      socket.off('error')
    }
  }, [socket])

  const handleJoin = () => {
    if (!name.trim() || !code) return
    socket?.emit('join_lobby', { code: String(code).toUpperCase(), playerName: name.trim() })
  }

  if (!code) return null

  if (joined && socket && lobbyData) {
    return (
      <GameView
        socket={socket}
        code={lobbyData.code}
        playerId={lobbyData.playerId}
        isAdmin={lobbyData.isAdmin}
        initialPlayers={lobbyData.players}
      />
    )
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center p-6">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl text-sm z-50 animate-fade-in">
          {error}
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-widest text-accent font-mono">DECIEVE</h1>
          <p className="text-muted text-xs mt-2">Join Game</p>
        </div>

        <div className="glass rounded-2xl p-5 w-full text-center">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-1">Lobby</p>
          <p className="text-3xl font-bold text-text-primary tracking-[0.3em] font-mono">{String(code).toUpperCase()}</p>
        </div>

        <div className="w-full">
          <label className="text-text-primary/70 text-sm block mb-1">Your Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
            className="w-full bg-card text-text-primary rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
        </div>

        <button
          onClick={handleJoin}
          disabled={!name.trim()}
          className="w-full py-4 rounded-2xl bg-accent text-dark text-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          Join
        </button>
      </div>
    </div>
  )
}
