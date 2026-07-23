import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import GameView from '@/components/GameView'

type View = 'menu' | 'create' | 'join' | 'game'

interface LobbyData {
  code: string
  playerId: string
  isAdmin: boolean
  players: any[]
  settings: any
}

export default function Home() {
  const [view, setView] = useState<View>('menu')
  const [socket, setSocket] = useState<Socket | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null)
  const [error, setError] = useState('')
  const [impostorCount, setImpostorCount] = useState(1)
  const [impostorQuestions, setImpostorQuestions] = useState<'none' | 'random'>('none')
  const [questionCount, setQuestionCount] = useState(5)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    const s = io({ path: '/socket.io' })
    setSocket(s)
    return () => { s.close() }
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('lobby_joined', (data: LobbyData) => {
      setLobbyData(data)
      setView('game')
    })

    socket.on('error', ({ message }) => {
      setError(message)
      setTimeout(() => setError(''), 3000)
    })

    return () => {
      socket.off('lobby_joined')
      socket.off('error')
    }
  }, [socket])

  const handleCreate = () => {
    if (!name.trim()) return
    socket?.emit('create_lobby', {
      playerName: name.trim(),
      settings: { impostorCount, impostorQuestions, questionCount },
    })
  }

  const handleJoinByCode = () => {
    if (!name.trim() || !code.trim()) return
    setJoining(true)
    socket?.emit('join_lobby', { code: code.toUpperCase(), playerName: name.trim() })
  }

  if (view === 'game' && socket && lobbyData) {
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

      {view === 'menu' && (
        <div className="flex flex-col items-center gap-8 animate-fade-in">
          <div className="text-center">
            <h1 className="text-6xl font-bold tracking-[0.15em] text-accent font-mono">DECIEVE</h1>
            <p className="text-muted text-sm mt-3">Party Game of Deception</p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => setView('create')}
              className="w-full py-4 rounded-2xl bg-accent text-dark text-lg font-bold transition-all hover:bg-accent/90 active:scale-95"
            >
              Create Game
            </button>
            <button
              onClick={() => setView('join')}
              className="w-full py-4 rounded-2xl border border-white/20 text-text-primary text-lg font-bold transition-all hover:bg-card-hover active:scale-95"
            >
              Join Game
            </button>
          </div>
        </div>
      )}

      {view === 'create' && (
        <div className="w-full max-w-sm flex flex-col gap-6 animate-slide-up">
          <button
            onClick={() => setView('menu')}
            className="text-muted hover:text-text-primary text-sm self-start transition-colors"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold text-text-primary">New Game</h2>

          <div>
            <label className="text-text-primary/70 text-sm block mb-1">Your Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full bg-card text-text-primary rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div className="glass rounded-2xl p-5 space-y-4">
            <p className="text-text-primary/60 text-xs uppercase tracking-wider">Settings</p>

            <div>
              <label className="text-text-primary/70 text-sm">Impostor Count: {impostorCount}</label>
              <input
                type="range" min={1} max={5}
                value={impostorCount}
                onChange={e => setImpostorCount(Number(e.target.value))}
                className="w-full accent-accent mt-1"
              />
            </div>

            <div>
              <label className="text-text-primary/70 text-sm">Impostor Questions</label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setImpostorQuestions('none')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${impostorQuestions === 'none' ? 'bg-accent text-dark' : 'bg-card-hover text-text-secondary'}`}
                >None</button>
                <button
                  onClick={() => setImpostorQuestions('random')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${impostorQuestions === 'random' ? 'bg-accent text-dark' : 'bg-card-hover text-text-secondary'}`}
                >Random</button>
              </div>
            </div>

            <div>
              <label className="text-text-primary/70 text-sm">Questions: {questionCount}</label>
              <input
                type="range" min={3} max={10}
                value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full accent-accent mt-1"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full py-4 rounded-2xl bg-accent text-dark text-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            Create Lobby
          </button>
        </div>
      )}

      {view === 'join' && (
        <div className="w-full max-w-sm flex flex-col gap-6 animate-slide-up">
          <button
            onClick={() => setView('menu')}
            className="text-muted hover:text-text-primary text-sm self-start transition-colors"
          >
            ← Back
          </button>

          <h2 className="text-2xl font-bold text-text-primary">Join Game</h2>

          <div>
            <label className="text-text-primary/70 text-sm block mb-1">Your Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full bg-card text-text-primary rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted"
            />
          </div>

          <div>
            <label className="text-text-primary/70 text-sm block mb-1">Game Code</label>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="CODE"
              maxLength={6}
              className="w-full bg-card text-text-primary rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted font-mono tracking-widest text-center uppercase"
              onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
            />
          </div>

          <button
            onClick={handleJoinByCode}
            disabled={!name.trim() || !code.trim() || joining}
            className="w-full py-4 rounded-2xl bg-accent text-dark text-lg font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {joining ? 'Joining...' : 'Join'}
          </button>
        </div>
      )}
    </div>
  )
}
