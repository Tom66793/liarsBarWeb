const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ─── Game State ───────────────────────────────────────────────────────────────
const rooms = new Map();

const TABLE_CARDS = ['ACE', 'KING', 'QUEEN'];

function createDeck() {
  const deck = [];
  ['ACE', 'KING', 'QUEEN'].forEach(type => {
    for (let i = 0; i < 6; i++) deck.push({ id: `${type}_${i}`, type });
  });
  for (let i = 0; i < 2; i++) deck.push({ id: `JOKER_${i}`, type: 'JOKER' });
  return deck; // 20 cards
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealCards(players) {
  const deck = shuffle(createDeck());
  const alive = players.filter(p => p.status === 'alive');
  const perPlayer = Math.floor(deck.length / alive.length);
  alive.forEach((p, i) => {
    p.hand = deck.slice(i * perPlayer, (i + 1) * perPlayer);
  });
}

function nextAliveIndex(players, fromIndex) {
  const n = players.length;
  let idx = (fromIndex + 1) % n;
  for (let t = 0; t < n; t++) {
    if (players[idx].status === 'alive') return idx;
    idx = (idx + 1) % n;
  }
  return fromIndex;
}

function addLog(room, message) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  room.log.unshift(`[${time}] ${message}`);
  if (room.log.length > 30) room.log.pop();
}

function getPublicState(room) {
  return {
    id: room.id,
    phase: room.phase,
    currentPlayerIndex: room.currentPlayerIndex,
    tableCard: room.tableCard,
    lastPlay: room.lastPlay
      ? { playerId: room.lastPlay.playerId, count: room.lastPlay.count, claimedType: room.lastPlay.claimedType }
      : null,
    pendingShooter: room.pendingShooter,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      status: p.status,
      cardsRemaining: p.cardsRemaining,
      isHost: p.isHost,
      revolverPulls: p.revolverPulls ?? 0,
    })),
    winner: room.winner,
    log: room.log,
    maxPlayers: room.maxPlayers,
  };
}

function startGame(room) {
  dealCards(room.players);
  room.phase = 'playing';
  room.tableCard = TABLE_CARDS[Math.floor(Math.random() * TABLE_CARDS.length)];
  room.currentPlayerIndex = 0;
  room.lastPlay = null;
  room.pendingShooter = null;
  addLog(room, `🎮 Partie lancée ! Carte du tour : ${room.tableCard}`);
}

function newRound(room) {
  dealCards(room.players);
  room.tableCard = TABLE_CARDS[Math.floor(Math.random() * TABLE_CARDS.length)];
  room.lastPlay = null;
  room.pendingShooter = null;
  room.phase = 'playing';
  // Next round starts with player after the one who just shot
  addLog(room, `🔄 Nouveau tour ! Carte : ${room.tableCard}`);
}

function pickCard(room, playerId, cardIndex) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || player.status === 'dead') return { died: false, cardIndex, deathPosition: null };

  const died = cardIndex === player.deathPosition;
  player.revolverPulls = (player.revolverPulls ?? 0) + 1;
  if (died) {
    player.status = 'dead';
    player.hand = [];
    addLog(room, `💀 ${player.name} a tiré la carte de la mort !`);
    const alive = room.players.filter(p => p.status === 'alive');
    if (alive.length <= 1) {
      room.phase = 'gameOver';
      room.winner = alive[0]?.id ?? null;
      if (alive[0]) addLog(room, `🏆 ${alive[0].name} a gagné la partie !`);
    }
  } else {
    // La carte choisie est retirée — si elle était avant la mort, décaler l'index
    if (cardIndex < player.deathPosition) player.deathPosition--;
    player.cardsRemaining--;
    addLog(room, `😰 ${player.name} a survécu ! (${player.cardsRemaining} carte(s) restante(s))`);
  }
  return { died, cardIndex, deathPosition: died ? player.deathPosition : null };
}

// ─── Server ───────────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {

    socket.on('create_room', ({ name, maxPlayers }) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const clampedMax = Math.min(6, Math.max(2, parseInt(maxPlayers) || 4));
      const room = {
        id: roomId,
        players: [{
          id: socket.id, name, hand: [], status: 'alive',
          deathPosition: Math.floor(Math.random() * 6),
          cardsRemaining: 6, revolverPulls: 0, isHost: true,
        }],
        phase: 'lobby',
        currentPlayerIndex: 0,
        tableCard: null,
        lastPlay: null,
        pendingShooter: null,
        winner: null,
        log: [],
        maxPlayers: clampedMax,
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room_joined', { roomId, playerId: socket.id });
      addLog(room, `${name} a créé le salon`);
      io.to(roomId).emit('game_state', getPublicState(room));
    });

    socket.on('join_room', ({ roomId, name }) => {
      const room = rooms.get(roomId.toUpperCase());
      if (!room) { socket.emit('error_msg', 'Salon introuvable'); return; }
      if (room.phase !== 'lobby') { socket.emit('error_msg', 'Partie déjà commencée'); return; }
      if (room.players.length >= room.maxPlayers) { socket.emit('error_msg', `Salon complet (max ${room.maxPlayers})`); return; }
      if (room.players.find(p => p.name === name)) { socket.emit('error_msg', 'Ce pseudo est déjà pris'); return; }

      room.players.push({
        id: socket.id, name, hand: [], status: 'alive',
        deathPosition: Math.floor(Math.random() * 6),
        cardsRemaining: 6, revolverPulls: 0, isHost: false,
      });
      socket.join(room.id);
      socket.emit('room_joined', { roomId: room.id, playerId: socket.id });
      addLog(room, `${name} a rejoint le salon`);
      io.to(room.id).emit('game_state', getPublicState(room));
    });

    socket.on('start_game', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;
      if (room.players.length < 1) { socket.emit('error_msg', 'Il faut au moins 1 joueur'); return; }
      startGame(room);
      io.to(roomId).emit('game_state', getPublicState(room));
      room.players.forEach(p => io.to(p.id).emit('your_hand', { hand: p.hand }));
    });

    socket.on('play_cards', ({ roomId, cardIds }) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== 'playing') return;
      const current = room.players[room.currentPlayerIndex];
      if (current.id !== socket.id) return;
      if (cardIds.length < 1 || cardIds.length > 3) return;

      const cards = cardIds.map(id => current.hand.find(c => c.id === id)).filter(Boolean);
      if (cards.length !== cardIds.length) return;

      // Remove from hand
      cardIds.forEach(id => {
        const idx = current.hand.findIndex(c => c.id === id);
        if (idx !== -1) current.hand.splice(idx, 1);
      });

      room.lastPlay = { playerId: socket.id, cards, count: cards.length, claimedType: room.tableCard };
      addLog(room, `🃏 ${current.name} joue ${cards.length} carte(s) [${room.tableCard}]`);

      room.currentPlayerIndex = nextAliveIndex(room.players, room.currentPlayerIndex);

      io.to(roomId).emit('game_state', getPublicState(room));
      io.to(current.id).emit('your_hand', { hand: current.hand });
    });

    socket.on('call_liar', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== 'playing' || !room.lastPlay) return;
      const current = room.players[room.currentPlayerIndex];
      if (current.id !== socket.id) return;

      const { playerId, cards, claimedType } = room.lastPlay;
      const accused = room.players.find(p => p.id === playerId);

      const wasLying = cards.some(c => c.type !== claimedType && c.type !== 'JOKER');
      const shooterId = wasLying ? playerId : socket.id;
      const shooter = room.players.find(p => p.id === shooterId);

      room.phase = 'revolver';
      room.pendingShooter = shooterId;

      addLog(room, `🚨 ${current.name} accuse ${accused.name} !`);
      addLog(room, wasLying
        ? `✅ ${accused.name} mentait ! ${shooter.name} tire...`
        : `❌ ${accused.name} disait la vérité ! ${shooter.name} tire...`
      );

      io.to(roomId).emit('liar_called', {
        callerName: current.name,
        accusedName: accused.name,
        revealedCards: cards,
        claimedType,
        wasLying,
        shooterId,
        shooterName: shooter.name,
      });
      io.to(roomId).emit('game_state', getPublicState(room));
    });

    socket.on('pick_card', ({ roomId, cardIndex }) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== 'revolver') return;
      if (room.pendingShooter !== socket.id) return;

      const result = pickCard(room, socket.id, cardIndex);
      const player = room.players.find(p => p.id === socket.id);

      io.to(roomId).emit('trigger_result', {
        playerId: socket.id,
        playerName: player.name,
        died: result.died,
        cardIndex: result.cardIndex,
        deathPosition: result.deathPosition,
        cardsRemaining: player.cardsRemaining,
      });

      // Délai dans les deux cas pour laisser l'animation se jouer
      setTimeout(() => {
        if (room.phase === 'gameOver') {
          io.to(roomId).emit('game_state', getPublicState(room));
        } else {
          newRound(room);
          io.to(roomId).emit('game_state', getPublicState(room));
          room.players.filter(p => p.status === 'alive').forEach(p => {
            io.to(p.id).emit('your_hand', { hand: p.hand });
          });
        }
      }, 5000);
    });

    socket.on('play_again', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== 'gameOver') return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player?.isHost) return;

      // Reset everyone
      room.players.forEach(p => {
        p.status = 'alive';
        p.hand = [];
        p.deathPosition = Math.floor(Math.random() * 6);
        p.cardsRemaining = 6;
      });
      room.winner = null;
      room.log = [];
      room.phase = 'lobby';
      addLog(room, '🔄 Nouvelle partie !');
      io.to(roomId).emit('game_state', getPublicState(room));
    });

    socket.on('request_state', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      socket.emit('game_state', getPublicState(room));
      const player = room.players.find(p => p.id === socket.id);
      if (player && player.hand.length > 0) {
        socket.emit('your_hand', { hand: player.hand });
      }
    });

    socket.on('disconnect', () => {
      rooms.forEach((room, roomId) => {
        const idx = room.players.findIndex(p => p.id === socket.id);
        if (idx === -1) return;
        const player = room.players[idx];
        addLog(room, `👋 ${player.name} s'est déconnecté`);
        room.players.splice(idx, 1);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          if (player.isHost) room.players[0].isHost = true;
          // If was pending shooter, start new round
          if (room.pendingShooter === socket.id && room.phase === 'revolver') {
            setTimeout(() => {
              newRound(room);
              io.to(roomId).emit('game_state', getPublicState(room));
              room.players.filter(p => p.status === 'alive').forEach(p => {
                io.to(p.id).emit('your_hand', { hand: p.hand });
              });
            }, 1000);
          } else {
            io.to(roomId).emit('game_state', getPublicState(room));
          }
        }
      });
    });
  });

  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`> Liar's Bar prêt sur http://localhost:${PORT}`);
  });
});
