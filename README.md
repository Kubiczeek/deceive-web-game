# Deceive 🕵️

Party game of deception. One or more players are impostors – everyone reads questions aloud and the impostors have to fake their answers.

Built with Next.js + Socket.io. No database, no accounts, no install.

## How to play

1. **Create lobby** – one player creates a game and puts their phone in the middle with the QR code
2. **Join** – others scan the QR code or type the 6‑character code
3. **Role reveal** – 15‑second countdown, each player taps a button to secretly check if they are an impostor
4. **Questions** – civilians see 5–6 personal statements; impostors see nothing or random questions (configurable)
5. **Vote** (optional) – everyone votes for who they think the impostor is
6. **Results** – identities are revealed; play another round with the same group

### Settings (admin)
- Number of impostors
- Impostor questions: none / random
- Questions per round
- Voting after game (on/off)

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Tech stack

- [Next.js](https://nextjs.org/) (Pages Router)
- [Socket.io](https://socket.io/) – real‑time WebSocket communication
- [Tailwind CSS](https://tailwindcss.com/) – styling with dark/light mode
- [qrcode.react](https://github.com/zpao/qrcode.react) – QR code generation
- PWA – installable on mobile home screen
