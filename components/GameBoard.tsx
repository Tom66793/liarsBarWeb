'use client';

import { GameState, Card, LiarCalledEvent, TriggerResultEvent, CardType } from '@/lib/types';
import { getSocket } from '@/lib/socket';
import PlayerHand from './PlayerHand';
import RevolverModal from './RevolverModal';

const CARD_DISPLAY: Record<CardType, { label: string; emoji: string; bg: string }> = {
  ACE:   { label: 'As',    emoji: '🂡', bg: 'bg-amber-700' },
  KING:  { label: 'Roi',   emoji: '🂮', bg: 'bg-blue-700'  },
  QUEEN: { label: 'Dame',  emoji: '🂭', bg: 'bg-pink-700'  },
  JOKER: { label: 'Joker', emoji: '🃟', bg: 'bg-green-700' },
};

interface Props {
  gameState: GameState;
  myId: string;
  myHand: Card[];
  roomId: string;
  liarEvent: LiarCalledEvent | null;
  triggerEvent: TriggerResultEvent | null;
}

export default function GameBoard({ gameState, myId, myHand, roomId, liarEvent, triggerEvent }: Props) {
  const socket = getSocket();
  const me = gameState.players.find(p => p.id === myId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myId && gameState.phase === 'playing';
  const canCallLiar = isMyTurn && !!gameState.lastPlay && gameState.phase === 'playing';
  const lastPlayedBy = gameState.lastPlay
    ? gameState.players.find(p => p.id === gameState.lastPlay!.playerId)
    : null;

  function handlePlayCards(cardIds: string[]) {
    socket.emit('play_cards', { roomId, cardIds });
  }

  function handleCallLiar() {
    socket.emit('call_liar', { roomId });
  }

  function handlePickCard(cardIndex: number) {
    socket.emit('pick_card', { roomId, cardIndex });
  }

  function handlePlayAgain() {
    socket.emit('play_again', { roomId });
  }

  // ── Game Over ───────────────────────────────────────────────────────────────
  if (gameState.phase === 'gameOver') {
    const winner = gameState.players.find(p => p.id === gameState.winner);
    const iWon = gameState.winner === myId;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="bg-stone-900 border border-stone-700 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="text-6xl mb-4">{iWon ? '🏆' : '💀'}</div>
          <h2 className="text-4xl font-bold mb-2 text-amber-400">
            {iWon ? 'VICTOIRE !' : 'DÉFAITE'}
          </h2>
          <p className="text-stone-300 text-lg mb-8">
            {winner?.name ?? '?'} a survécu à tous les autres.
          </p>

          {/* Final stats */}
          <div className="space-y-2 mb-8">
            {gameState.players.map(p => (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-2 rounded-lg ${p.status === 'alive' ? 'bg-green-900/30 border border-green-700/50' : 'bg-stone-800'}`}>
                <span>{p.status === 'alive' ? '👑' : '💀'}</span>
                <span className={`flex-1 text-left ${p.status === 'alive' ? 'text-green-300' : 'text-stone-500'}`}>
                  {p.name}
                </span>
                <span className="text-xs text-stone-500">
                  {p.revolverPulls} tir(s)
                </span>
              </div>
            ))}
          </div>

          {me?.isHost && (
            <button
              onClick={handlePlayAgain}
              className="w-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold py-4 rounded-xl transition-colors uppercase tracking-widest"
            >
              Rejouer
            </button>
          )}
          {!me?.isHost && (
            <p className="text-stone-500 text-sm">En attente que l'hôte relance...</p>
          )}
        </div>
      </div>
    );
  }

  // ── Playing / Revolver ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col p-4 gap-4 max-w-4xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-stone-500 text-xs uppercase tracking-widest">Salon</span>
          <span className="ml-2 text-amber-400 font-bold">{roomId}</span>
        </div>
        {gameState.tableCard && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${CARD_DISPLAY[gameState.tableCard].bg}`}>
            <span className="text-lg">{CARD_DISPLAY[gameState.tableCard].emoji}</span>
            <div>
              <p className="text-xs opacity-70">Carte du tour</p>
              <p className="font-bold text-sm">{CARD_DISPLAY[gameState.tableCard].label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Players row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {gameState.players.map((player, idx) => {
          const isCurrent = idx === gameState.currentPlayerIndex && gameState.phase === 'playing';
          const isMe = player.id === myId;
          const isShooter = gameState.pendingShooter === player.id;
          return (
            <div
              key={player.id}
              className={`rounded-xl p-3 border-2 transition-all ${
                player.status === 'dead'
                  ? 'border-stone-800 bg-stone-900/30 opacity-50'
                  : isCurrent
                  ? 'border-amber-500 bg-amber-900/20 shadow-lg shadow-amber-900/30'
                  : isShooter && gameState.phase === 'revolver'
                  ? 'border-red-600 bg-red-900/20 pulse-red'
                  : isMe
                  ? 'border-stone-500 bg-stone-800'
                  : 'border-stone-700 bg-stone-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">
                  {player.status === 'dead' ? '💀' : isCurrent ? '🎯' : isShooter ? '🔫' : '🎭'}
                </span>
                <span className="font-bold text-sm truncate flex-1">
                  {player.name}
                  {isMe && <span className="text-amber-400 ml-1 text-xs">(toi)</span>}
                </span>
              </div>

              {/* Cartes restantes (danger meter) */}
              <div className="flex gap-1 mb-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-sm border ${
                      player.status === 'dead'
                        ? 'bg-red-900 border-red-800'
                        : i < player.cardsRemaining
                        ? 'bg-amber-600 border-amber-500'
                        : 'bg-stone-700 border-stone-600'
                    }`}
                  />
                ))}
              </div>

              <div className="text-xs text-stone-400">
                {player.status === 'dead'
                  ? 'Éliminé'
                  : `${player.handCount} carte(s) • ☠️ 1/${player.cardsRemaining}`
                }
              </div>
            </div>
          );
        })}
      </div>

      {/* Table / Last play info */}
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-4 flex-1 min-h-24">
        {gameState.lastPlay ? (
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {Array.from({ length: gameState.lastPlay.count }).map((_, i) => (
                <div key={i} className="w-12 h-16 bg-stone-700 border border-stone-500 rounded-lg flex items-center justify-center text-stone-400 text-xl font-bold">
                  ?
                </div>
              ))}
            </div>
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-widest">Dernier jeu</p>
              <p className="text-amber-300 font-bold">
                {lastPlayedBy?.name ?? '?'} a joué {gameState.lastPlay.count} carte(s)
              </p>
              <p className="text-stone-400 text-sm">
                Déclarée(s) comme : <span className="text-amber-400">{CARD_DISPLAY[gameState.lastPlay.claimedType].label}</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-stone-600 text-sm">
            Aucune carte jouée — premier joueur doit commencer
          </div>
        )}
      </div>

      {/* Action area */}
      {me?.status === 'alive' && gameState.phase === 'playing' && (
        <div className="bg-stone-900 border border-stone-700 rounded-xl p-4">
          {isMyTurn ? (
            <div className="space-y-4">
              <p className="text-center text-amber-400 text-sm font-bold uppercase tracking-widest animate-pulse">
                C'est ton tour !
              </p>

              {/* Call liar button */}
              {canCallLiar && (
                <div className="flex justify-center">
                  <button
                    onClick={handleCallLiar}
                    className="bg-red-800 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl transition-colors uppercase tracking-widest text-sm border border-red-600"
                  >
                    🚨 MENTEUR !
                  </button>
                </div>
              )}

              {/* Divider if both options available */}
              {canCallLiar && myHand.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-stone-700" />
                  <span className="text-stone-600 text-xs">ou joue des cartes</span>
                  <div className="flex-1 h-px bg-stone-700" />
                </div>
              )}

              {/* Hand */}
              {myHand.length > 0 ? (
                <PlayerHand
                  hand={myHand}
                  onPlay={handlePlayCards}
                  isMyTurn={isMyTurn}
                  tableCard={gameState.tableCard}
                  disabled={gameState.phase !== 'playing'}
                />
              ) : (
                <p className="text-center text-stone-500 text-sm">
                  Tu n'as plus de cartes — tu dois accuser !
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-stone-400 text-sm">
                Tour de <strong className="text-amber-300">{currentPlayer?.name}</strong>...
              </p>
              <div className="opacity-60">
                <PlayerHand
                  hand={myHand}
                  onPlay={() => {}}
                  isMyTurn={false}
                  tableCard={gameState.tableCard}
                  disabled={true}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {me?.status === 'dead' && (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-center text-stone-500">
          💀 Tu as été éliminé — observe la suite...
        </div>
      )}

      {/* Log */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 max-h-36 overflow-y-auto">
        <p className="text-xs text-stone-500 uppercase tracking-widest mb-2">Journal</p>
        {gameState.log.map((entry, i) => (
          <p key={i} className="text-xs text-stone-400 py-0.5 border-b border-stone-800/50">{entry}</p>
        ))}
      </div>

      {/* Death card modal — reste visible pendant gameOver pour l'animation */}
      {(gameState.phase === 'revolver' || gameState.phase === 'gameOver' || (liarEvent && !triggerEvent)) && liarEvent && (
        <RevolverModal
          liarEvent={liarEvent}
          triggerEvent={triggerEvent}
          myId={myId}
          pendingShooter={gameState.pendingShooter}
          onPickCard={handlePickCard}
          shooterCardsRemaining={
            gameState.players.find(p => p.id === gameState.pendingShooter)?.cardsRemaining ?? 6
          }
        />
      )}
    </div>
  );
}
