import { useEffect, useState, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { QRCodeSVG } from 'qrcode.react'

type Phase = 'lobby' | 'countdown' | 'questions' | 'voting' | 'results'

interface Player {
  id: string
  name: string
  isAdmin: boolean
  connected: boolean
}

interface GameSettings {
  impostorCount: number
  impostorQuestions: 'none' | 'random'
  questionCount: number
  voting: boolean
}

interface Props {
  socket: Socket
  code: string
  playerId: string
  isAdmin: boolean
  initialPlayers: Player[]
}

export default function GameView({ socket, code, playerId, isAdmin, initialPlayers }: Props) {
  const [phase, setPhase] = useState<Phase>('lobby')
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [settings, setSettings] = useState<GameSettings>({
    impostorCount: 1,
    impostorQuestions: 'none',
    questionCount: 5,
    voting: false,
  })
  const [countdownEnd, setCountdownEnd] = useState<number | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [role, setRole] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [isImpostor, setIsImpostor] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [editingSettings, setEditingSettings] = useState<GameSettings>(settings)
  const [showRole, setShowRole] = useState(false)
  const [voteCandidates, setVoteCandidates] = useState<Player[]>([])
  const [votedFor, setVotedFor] = useState<string | null>(null)
  const [voteCount, setVoteCount] = useState(0)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    socket.on('player_joined', ({ player }) => {
      setPlayers(prev => [...prev, player])
    })

    socket.on('player_disconnected', ({ playerId }) => {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, connected: false } : p))
    })

    socket.on('admin_changed', ({ adminId }) => {
      setPlayers(prev => prev.map(p => p.id === adminId ? { ...p, isAdmin: true } : p))
    })

    socket.on('settings_updated', ({ settings }) => {
      setSettings(settings)
    })

    socket.on('game_started', ({ countdownEnd }) => {
      setPhase('countdown')
      setCountdownEnd(countdownEnd)
    })

    socket.on('role_revealed', ({ role }) => {
      setRole(role)
    })

    socket.on('questions_phase', ({ questions, isImpostor }) => {
      setPhase('questions')
      setQuestions(questions)
      setIsImpostor(isImpostor)
    })

    socket.on('voting_phase', ({ candidates }) => {
      setPhase('voting')
      setVoteCandidates(candidates)
      setVotedFor(null)
      setVoteCount(0)
    })

    socket.on('vote_accepted', () => {
      setVoteCount(prev => prev + 1)
    })

    socket.on('game_ended', (data) => {
      setPhase('results')
      setResults(data)
    })

    socket.on('game_reset', ({ players, settings }) => {
      setPhase('lobby')
      setPlayers(players)
      setSettings(settings)
      setRole(null)
      setRevealed(false)
      setShowRole(false)
      setQuestions([])
      setIsImpostor(false)
      setResults(null)
      setCountdownEnd(null)
      setCountdown(0)
      setVotedFor(null)
      setVoteCount(0)
      setVoteCandidates([])
    })

    socket.on('error', ({ message }) => {
      setError(message)
      setTimeout(() => setError(''), 3000)
    })

    return () => {
      socket.off('player_joined')
      socket.off('player_disconnected')
      socket.off('admin_changed')
      socket.off('settings_updated')
      socket.off('game_started')
      socket.off('role_revealed')
      socket.off('questions_phase')
      socket.off('voting_phase')
      socket.off('vote_accepted')
      socket.off('game_ended')
      socket.off('game_reset')
      socket.off('error')
    }
  }, [socket])

  useEffect(() => {
    if (!countdownEnd) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((countdownEnd - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 0) clearInterval(interval)
    }, 100)
    return () => clearInterval(interval)
  }, [countdownEnd])

  const handleReveal = () => {
    if (revealed) return
    setRevealed(true)
    setShowRole(true)
    socket.emit('reveal_role', { code })
    hideTimer.current = setTimeout(() => {
      setShowRole(false)
    }, 3000)
  }

  const handleStartGame = () => {
    socket.emit('start_game', { code })
  }

  const handleEndGame = () => {
    socket.emit('end_game', { code })
  }

  const handlePlayAgain = () => {
    socket.emit('play_again', { code })
  }

  const handleSaveSettings = () => {
    socket.emit('update_settings', { code, settings: editingSettings })
    setSettings(editingSettings)
    setShowSettings(false)
  }

  const handleVote = (targetId: string) => {
    if (votedFor) return
    setVotedFor(targetId)
    socket.emit('submit_vote', { code, targetId })
  }

  const handleEndVoting = () => {
    socket.emit('end_voting', { code })
  }

  const lobbyUrl = typeof window !== 'undefined' ? `${window.location.origin}/game/${code}` : ''

  const connectedPlayers = players.filter(p => p.connected)

  return (
    <div className="min-h-screen bg-page flex flex-col items-center p-4">
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl text-sm z-50 animate-fade-in">
          {error}
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 pt-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-widest text-accent font-mono">DECIEVE</h1>
            <p className="text-secondary text-sm mt-1">Lobby</p>
          </div>

          <div className="glass rounded-2xl p-6 flex flex-col items-center gap-3 w-full">
            <p className="text-secondary text-xs uppercase tracking-wider">Lobby Code</p>
            <p className="text-3xl font-bold text-text-primary tracking-[0.3em] font-mono">{code}</p>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={lobbyUrl} size={140} level="M" />
            </div>
            <p className="text-muted text-xs text-center max-w-[200px]">
              Scan QR code or enter code to join
            </p>
          </div>

          <div className="glass rounded-2xl p-4 w-full">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-text-primary/70 text-sm font-semibold uppercase tracking-wider">
                Players <span className="text-accent">({connectedPlayers.length})</span>
              </h2>
            </div>
            <div className="flex flex-col gap-2">
              {connectedPlayers.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-card-hover rounded-xl px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-civilian" />
                  <span className="text-text-primary font-medium">{p.name}</span>
                  {p.isAdmin && <span className="text-accent text-xs ml-auto font-semibold">ADMIN</span>}
                </div>
              ))}
              {players.filter(p => !p.connected).map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-card-hover rounded-xl px-4 py-3 opacity-40">
                  <div className="w-2 h-2 rounded-full bg-muted" />
                  <span className="text-text-primary font-medium">{p.name}</span>
                  <span className="text-muted text-xs ml-auto">OFFLINE</span>
                </div>
              ))}
            </div>
          </div>

          {isAdmin && (
            <>
              <button
                onClick={() => { setEditingSettings(settings); setShowSettings(!showSettings) }}
                className="text-muted hover:text-text-primary text-sm transition-colors"
              >
                {showSettings ? 'Hide Settings' : 'Settings'}
              </button>

              {showSettings && (
                <div className="glass rounded-2xl p-5 w-full space-y-4 animate-fade-in">
                  <div>
                    <label className="text-text-primary/70 text-sm">Impostors: {editingSettings.impostorCount}</label>
                    <input
                      type="range" min={1} max={Math.max(2, players.length - 1)}
                      value={editingSettings.impostorCount}
                      onChange={e => setEditingSettings({ ...editingSettings, impostorCount: Number(e.target.value) })}
                      className="w-full accent-accent mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-text-primary/70 text-sm">Impostor Questions</label>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => setEditingSettings({ ...editingSettings, impostorQuestions: 'none' })}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${editingSettings.impostorQuestions === 'none' ? 'bg-accent text-dark' : 'bg-card-hover text-text-secondary'}`}
                      >None</button>
                      <button
                        onClick={() => setEditingSettings({ ...editingSettings, impostorQuestions: 'random' })}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${editingSettings.impostorQuestions === 'random' ? 'bg-accent text-dark' : 'bg-card-hover text-text-secondary'}`}
                      >Random</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-text-primary/70 text-sm">Questions: {editingSettings.questionCount}</label>
                    <input
                      type="range" min={3} max={10}
                      value={editingSettings.questionCount}
                      onChange={e => setEditingSettings({ ...editingSettings, questionCount: Number(e.target.value) })}
                      className="w-full accent-accent mt-1"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <label className="text-text-primary/70 text-sm">Voting after game</label>
                    <button
                      onClick={() => setEditingSettings({ ...editingSettings, voting: !editingSettings.voting })}
                      className={`w-12 h-6 rounded-full transition-colors relative ${editingSettings.voting ? 'bg-accent' : 'bg-muted'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${editingSettings.voting ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  <button
                    onClick={handleSaveSettings}
                    className="w-full bg-card-hover hover:bg-card text-text-primary py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >Save</button>
                </div>
              )}

              <button
                onClick={handleStartGame}
                disabled={connectedPlayers.length < 3}
                className={`w-full py-4 rounded-2xl text-lg font-bold transition-all pulse-glow ${connectedPlayers.length >= 3 ? 'bg-accent text-dark' : 'bg-card-hover text-text-secondary'}`}
              >
                Start Game
              </button>
              {connectedPlayers.length < 3 && (
                <p className="text-muted text-xs -mt-4">Need at least 3 players</p>
              )}
            </>
          )}

          {!isAdmin && (
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-muted text-sm">Waiting for admin to start...</p>
            </div>
          )}
        </div>
      )}

      {/* COUNTDOWN */}
      {phase === 'countdown' && (
        <div className="w-full max-w-md flex flex-col items-center justify-center gap-8 pt-16">
          <h2 className="text-secondary text-sm uppercase tracking-widest">Get Ready</h2>
          <div className="text-8xl font-mono font-bold text-text-primary tabular-nums">
            {countdown}
          </div>
          <div className="w-20 h-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-200"
              style={{ width: `${(countdown / 15) * 100}%` }}
            />
          </div>

          <button
            onClick={handleReveal}
            disabled={revealed}
            className={`w-48 h-48 rounded-full flex flex-col items-center justify-center text-center transition-all ${
              showRole
                ? role === 'impostor'
                  ? 'bg-impostor scale-110 animate-reveal'
                  : 'bg-civilian scale-110 animate-reveal'
                : revealed
                  ? 'bg-card scale-95'
                  : 'bg-card hover:bg-card-hover pulse-glow cursor-pointer'
            }`}
          >
            {showRole ? (
              <div className="animate-reveal text-white">
                <p className="text-xs uppercase tracking-widest opacity-70">
                  {role === 'impostor' ? 'You are' : 'You are'}
                </p>
                <p className="text-2xl font-extrabold mt-1">
                  {role === 'impostor' ? 'IMPOSTOR' : 'CIVILIAN'}
                </p>
              </div>
            ) : revealed ? (
              <p className="text-secondary text-sm">Already revealed</p>
            ) : (
              <div>
                <p className="text-3xl mb-1">👁️</p>
                <p className="text-secondary text-sm font-semibold">Tap to reveal<br />your role</p>
              </div>
            )}
          </button>

          <p className="text-muted text-xs text-center max-w-[250px]">
            {!revealed
              ? 'Tap the circle to secretly check if you are an impostor'
              : 'Remember your role. The circle will hide automatically.'}
          </p>
        </div>
      )}

      {/* QUESTIONS */}
      {phase === 'questions' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">
          <div className="text-center">
            <h2 className="text-text-primary text-lg font-bold">
              {isImpostor ? '🧩 Fake It' : '📝 Questions'}
            </h2>
            <p className="text-muted text-xs mt-1">
              {isImpostor
                ? questions.length > 0
                  ? 'Try to blend in'
                  : 'You see no questions - observe others'
                : 'Read each statement aloud'}
            </p>
          </div>

          <div className="w-full space-y-4">
            {questions.length === 0 && isImpostor && (
              <div className="glass rounded-2xl p-8 text-center">
                <p className="text-4xl mb-3">🕵️</p>
                <p className="text-secondary text-sm">
                  As an impostor, you see no questions.<br />
                  Listen to others and fake your answers.
                </p>
              </div>
            )}

            {questions.map((q, i) => (
              <div
                key={i}
                className="glass rounded-2xl p-5 animate-slide-up"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-accent font-mono text-sm font-bold mt-0.5 shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-text-primary text-lg leading-relaxed">{q}</p>
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <button
              onClick={handleEndGame}
              className="w-full py-4 rounded-2xl bg-impostor/20 text-impostor border border-impostor/30 text-lg font-bold transition-colors hover:bg-impostor/30 mt-4"
            >
              {settings.voting ? 'Start Voting' : 'End Game'}
            </button>
          )}
        </div>
      )}

      {/* VOTING */}
      {phase === 'voting' && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">
          <div className="text-center">
            <h2 className="text-text-primary text-xl font-bold">🗳️ Vote</h2>
            <p className="text-secondary text-xs mt-1">
              {votedFor
                ? 'Waiting for others to vote...'
                : 'Who do you think is the impostor?'}
            </p>
          </div>

          <div className="w-full space-y-2">
            {voteCandidates
              .filter(p => p.id !== playerId)
              .map(p => (
                <button
                  key={p.id}
                  onClick={() => handleVote(p.id)}
                  disabled={!!votedFor}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-4 text-left transition-all animate-slide-up ${
                    votedFor === p.id
                      ? 'bg-accent/20 border-2 border-accent text-text-primary'
                      : votedFor
                        ? 'bg-card-hover opacity-50 text-text-secondary'
                        : 'bg-card border-2 border-transparent hover:bg-card-hover text-text-primary active:scale-[0.98]'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    votedFor === p.id ? 'bg-accent text-dark' : 'bg-muted/20 text-text-secondary'
                  }`}>
                    {p.name[0].toUpperCase()}
                  </span>
                  <span className="font-medium">{p.name}</span>
                  {votedFor === p.id && (
                    <span className="ml-auto text-accent text-lg animate-check-in">✓</span>
                  )}
                </button>
              ))}
          </div>

          {isAdmin && (
            <button
              onClick={handleEndVoting}
              className="w-full py-4 rounded-2xl bg-impostor/20 text-impostor border border-impostor/30 text-lg font-bold transition-colors hover:bg-impostor/30 mt-4"
            >
              End Voting
            </button>
          )}

          {!isAdmin && votedFor && (
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <p className="text-muted text-sm">Waiting for results...</p>
            </div>
          )}
        </div>
      )}

      {/* RESULTS */}
      {phase === 'results' && results && (
        <div className="w-full max-w-md flex flex-col items-center gap-6 py-8">
          <h2 className="text-3xl font-bold text-text-primary">Game Over</h2>

          <div className="glass rounded-2xl p-6 w-full text-center">
            <p className="text-secondary text-xs uppercase tracking-wider mb-3">Impostor{results.impostors.length > 1 ? 's' : ''}</p>
            {results.impostors.length > 0 ? (
              <div className="flex flex-col gap-2">
                {results.impostors.map((imp: any) => (
                  <div key={imp.id} className="bg-impostor/20 text-impostor rounded-xl px-4 py-3 font-bold text-lg border border-impostor/30">
                    {imp.name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-primary/60">No impostors (error)</p>
            )}
          </div>

          {results.votingResults && (
            <div className="glass rounded-2xl p-4 w-full">
              <h3 className="text-text-primary/70 text-xs uppercase tracking-wider mb-3">Voting Results</h3>
              <div className="flex flex-col gap-2">
                {results.votingResults.tally.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 bg-card-hover rounded-xl px-4 py-3">
                    <span className={`text-sm font-bold ${p.isImpostor ? 'text-impostor' : 'text-civilian'}`}>
                      {p.isImpostor ? '🔴' : '🟢'}
                    </span>
                    <span className="text-text-primary font-medium">{p.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="bg-accent/20 rounded-full px-2.5 py-0.5">
                        <span className="text-accent text-xs font-bold">{p.votesReceived}</span>
                      </div>
                      {p.isImpostor && (
                        <span className="text-impostor text-xs font-semibold">IMPOSTOR</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-4 w-full">
            <h3 className="text-text-primary/70 text-xs uppercase tracking-wider mb-3">All Players</h3>
            <div className="flex flex-col gap-2">
              {results.players.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 bg-card-hover rounded-xl px-4 py-3">
                  <span className={`text-sm font-bold ${p.role === 'impostor' ? 'text-impostor' : 'text-civilian'}`}>
                    {p.role === 'impostor' ? '🔴' : '🟢'}
                  </span>
                  <span className="text-text-primary font-medium">{p.name}</span>
                  <span className={`ml-auto text-xs font-semibold ${p.role === 'impostor' ? 'text-impostor' : 'text-civilian'}`}>
                    {p.role.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isAdmin ? (
            <button
              onClick={handlePlayAgain}
              className="w-full py-4 rounded-2xl bg-accent text-dark text-lg font-bold transition-colors hover:bg-accent/90"
            >
              Play Again
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2 animate-pulse">
              <p className="text-muted text-sm">Waiting for admin to play again...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
