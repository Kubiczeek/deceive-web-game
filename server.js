const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const games = new Map()
const socketToGame = new Map()
const QUESTION_POOL = require('./src/lib/questions')

const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateCode() {
  let code
  do {
    code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  } while (games.has(code))
  return code
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom(arr, count) {
  return shuffle(arr).slice(0, count)
}

function getPlayerPublic(p) {
  return { id: p.id, name: p.name, isAdmin: p.isAdmin, connected: p.connected }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer)

  io.on('connection', (socket) => {
    socket.on('create_lobby', ({ playerName, settings }) => {
      const code = generateCode()
      const playerId = socket.id

      const game = {
        code,
        phase: 'lobby',
        players: new Map(),
        questions: [],
        impostorQuestions: [],
        settings: {
          impostorCount: 1,
          impostorQuestions: 'none',
          questionCount: 5,
          voting: false,
          ...settings,
        },
        adminId: playerId,
        countdownEnd: null,
        questionsStartTime: null,
        votes: null,
      }

      const player = {
        id: playerId,
        name: playerName || 'Admin',
        role: 'civilian',
        isAdmin: true,
        connected: true,
      }

      game.players.set(playerId, player)
      games.set(code, game)
      socket.join(code)
      socketToGame.set(socket.id, code)

      socket.emit('lobby_joined', {
        code,
        playerId,
        isAdmin: true,
        players: Array.from(game.players.values()).map(getPlayerPublic),
        settings: game.settings,
        phase: game.phase,
      })
    })

    socket.on('join_lobby', ({ code, playerName }) => {
      const game = games.get(code?.toUpperCase())
      if (!game) return socket.emit('error', { message: 'Lobby not found' })
      if (game.phase !== 'lobby') return socket.emit('error', { message: 'Game already in progress' })

      const playerId = socket.id
      const player = {
        id: playerId,
        name: playerName || 'Player',
        role: 'civilian',
        isAdmin: false,
        connected: true,
      }

      game.players.set(playerId, player)
      socket.join(code)
      socketToGame.set(socket.id, code)

      socket.emit('lobby_joined', {
        code,
        playerId,
        isAdmin: false,
        players: Array.from(game.players.values()).map(getPlayerPublic),
        settings: game.settings,
        phase: game.phase,
      })

      socket.to(code).emit('player_joined', {
        player: getPlayerPublic(player),
        playerCount: game.players.size,
      })
    })

    socket.on('update_settings', ({ code, settings }) => {
      const game = games.get(code)
      if (!game) return
      if (game.adminId !== socket.id) return socket.emit('error', { message: 'Only admin can change settings' })

      Object.assign(game.settings, settings)
      io.to(code).emit('settings_updated', { settings: game.settings })
    })

    socket.on('start_game', ({ code }) => {
      const game = games.get(code)
      if (!game) return
      if (game.adminId !== socket.id) return
      if (game.players.size < 3) return socket.emit('error', { message: 'Need at least 3 players' })

      const playerIds = Array.from(game.players.keys())
      const impostorCount = Math.min(game.settings.impostorCount, playerIds.length - 1)
      const impostorIds = new Set(pickRandom(playerIds, impostorCount))

      for (const [id, player] of game.players) {
        player.role = impostorIds.has(id) ? 'impostor' : 'civilian'
      }

      const questions = pickRandom(QUESTION_POOL, game.settings.questionCount)
      game.questions = questions

      if (game.settings.impostorQuestions === 'random') {
        game.impostorQuestions = pickRandom(QUESTION_POOL.filter(q => !questions.includes(q)), game.settings.questionCount)
      } else {
        game.impostorQuestions = []
      }

      game.phase = 'countdown'
      game.countdownEnd = Date.now() + 16000

      io.to(code).emit('game_started', {
        countdownEnd: game.countdownEnd,
      })

      setTimeout(() => {
        if (games.get(code)?.phase === 'countdown') {
          game.phase = 'questions'
          game.questionsStartTime = Date.now()

          for (const [id, player] of game.players) {
            const isImpostor = player.role === 'impostor'
            const playerQuestions = isImpostor && game.impostorQuestions.length > 0
              ? game.impostorQuestions
              : isImpostor
                ? []
                : questions

            io.to(id).emit('questions_phase', {
              questions: playerQuestions,
              isImpostor,
            })
          }
        }
      }, 16000)
    })

    socket.on('reveal_role', ({ code }) => {
      const game = games.get(code)
      if (!game) return
      const player = game.players.get(socket.id)
      if (!player) return

      socket.emit('role_revealed', { role: player.role })
    })

    socket.on('end_game', ({ code }) => {
      const game = games.get(code)
      if (!game) return
      if (game.adminId !== socket.id) return

      if (game.settings.voting && game.phase === 'questions') {
        game.phase = 'voting'
        game.votes = new Map()
        const candidates = Array.from(game.players.values())
          .filter(p => p.connected)
          .map(p => ({ id: p.id, name: p.name }))
        io.to(code).emit('voting_phase', { candidates })
        return
      }

      finishGame(io, game, code)
    })

    socket.on('submit_vote', ({ code, targetId }) => {
      const game = games.get(code)
      if (!game || game.phase !== 'voting') return
      if (!game.players.has(socket.id)) return

      game.votes.set(socket.id, targetId)
      socket.emit('vote_accepted')

      const connected = Array.from(game.players.values()).filter(p => p.connected)
      if (game.votes.size >= connected.length) {
        finishGame(io, game, code)
      }
    })

    socket.on('end_voting', ({ code }) => {
      const game = games.get(code)
      if (!game || game.phase !== 'voting') return
      if (game.adminId !== socket.id) return
      finishGame(io, game, code)
    })

    socket.on('play_again', ({ code }) => {
      const game = games.get(code)
      if (!game) return
      if (game.adminId !== socket.id) return

      game.phase = 'lobby'
      game.questions = []
      game.impostorQuestions = []
      game.countdownEnd = null
      game.questionsStartTime = null
      game.votes = null

      for (const [, player] of game.players) {
        player.role = 'civilian'
      }

      io.to(code).emit('game_reset', {
        players: Array.from(game.players.values()).map(getPlayerPublic),
        settings: game.settings,
      })
    })

    socket.on('disconnect', () => {
      const code = socketToGame.get(socket.id)
      if (!code) return

      const game = games.get(code)
      if (!game) return

      const player = game.players.get(socket.id)
      if (player) {
        player.connected = false
        io.to(code).emit('player_disconnected', {
          playerId: socket.id,
          playerCount: game.players.size,
        })
      }

      if (game.adminId === socket.id && game.phase === 'lobby') {
        const remainingPlayers = Array.from(game.players.values()).filter(p => p.connected)
        if (remainingPlayers.length > 0) {
          const newAdmin = remainingPlayers[0]
          newAdmin.isAdmin = true
          game.adminId = newAdmin.id
          io.to(code).emit('admin_changed', { adminId: newAdmin.id })
        }
      }

      const connectedCount = Array.from(game.players.values()).filter(p => p.connected).length
      if (connectedCount === 0) {
        games.delete(code)
      }

      socketToGame.delete(socket.id)
    })
  })

  function finishGame(io, game, code) {
    game.phase = 'results'

    const impostors = Array.from(game.players.values())
      .filter(p => p.role === 'impostor')
      .map(p => ({ id: p.id, name: p.name }))

    let votingResults = null
    if (game.votes) {
      const voteCount = new Map()
      for (const [, targetId] of game.votes) {
        voteCount.set(targetId, (voteCount.get(targetId) || 0) + 1)
      }

      votingResults = Array.from(game.players.values())
        .filter(p => p.connected)
        .map(p => ({
          id: p.id,
          name: p.name,
          votesReceived: voteCount.get(p.id) || 0,
          isImpostor: p.role === 'impostor',
        }))
        .sort((a, b) => b.votesReceived - a.votesReceived)

      const voteEntries = Array.from(game.votes.entries()).map(([voterId, targetId]) => ({
        voterId,
        targetId,
      }))

      const votedIds = new Set(game.votes.keys())
      for (const p of game.players.values()) {
        if (!votedIds.has(p.id)) {
          voteEntries.push({ voterId: p.id, targetId: null })
        }
      }

      votingResults = { tally: votingResults, votes: voteEntries }
    }

    io.to(code).emit('game_ended', {
      impostors,
      players: Array.from(game.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
      })),
      votingResults,
    })
  }

  httpServer.listen(3000, () => {
    console.log('> Deceive game ready on http://localhost:3000')
  })
})
