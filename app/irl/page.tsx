'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
type TableCard = 'VALET' | 'DAME' | 'ROI' | 'AS';
type Phase = 'setup' | 'playing' | 'shooting' | 'shotResult' | 'gameOver';

interface Player {
  name: string;
  status: 'alive' | 'dead';
  deathPosition: number;
  cardsRemaining: number;
}

interface ShotResult {
  playerIndex: number;
  pickedCard: number;
  died: boolean;
}

const TABLE_CARDS: TableCard[] = ['VALET', 'DAME', 'ROI', 'AS'];
const CARD_DISPLAY: Record<TableCard, { label: string; emoji: string; color: string }> = {
  VALET: { label: 'Valet', emoji: '🃋', color: 'bg-purple-700 border-purple-500' },
  DAME:  { label: 'Dame',  emoji: '🂭', color: 'bg-pink-700   border-pink-500'   },
  ROI:   { label: 'Roi',   emoji: '🂮', color: 'bg-blue-700   border-blue-500'   },
  AS:    { label: 'As',    emoji: '🂡', color: 'bg-amber-700  border-amber-500'  },
};

function randomDeathPos(n: number) { return Math.floor(Math.random() * n); }
function pickTableCard(): TableCard { return TABLE_CARDS[Math.floor(Math.random() * TABLE_CARDS.length)]; }

// ── Composant carte ───────────────────────────────────────────────────────────
type CardState = 'hidden' | 'picking' | 'flipping' | 'death' | 'life';

function DeathCard({ state, canPick, onPick }: {
  state: CardState; canPick: boolean; onPick: () => void;
}) {
  const isFlipped = state === 'flipping' || state === 'death' || state === 'life';
  const isDeath = state === 'death';
  const isLife  = state === 'life';

  return (
    <div className="card-3d-wrap w-16 h-24 sm:w-20 sm:h-28">
      <div className={`card-3d w-16 h-24 sm:w-20 sm:h-28 ${isFlipped ? 'flipped' : ''} ${state === 'picking' ? 'card-picking' : ''}`} style={{ position: 'relative' }}>
        {/* Dos */}
        <div
          onClick={canPick ? onPick : undefined}
          className={`card-face w-16 h-24 sm:w-20 sm:h-28 flex flex-col items-center justify-center border-2 rounded-xl
            ${canPick
              ? 'border-amber-500 bg-stone-700 cursor-pointer hover:-translate-y-2 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/50 transition-transform'
              : 'border-stone-600 bg-stone-800 cursor-default'
            }`}
        >
          <div className="grid grid-cols-3 gap-0.5 opacity-30">
            {Array(9).fill(null).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ))}
          </div>
          <span className="text-xs text-stone-500 mt-2">?</span>
        </div>
        {/* Face */}
        <div className={`card-face card-face-back w-16 h-24 sm:w-20 sm:h-28 flex flex-col items-center justify-center border-2 rounded-xl
          ${isDeath ? 'border-red-500 bg-red-950' : isLife ? 'border-green-500 bg-green-950' : 'border-stone-600 bg-stone-800'}`}>
          {isDeath && <><span className="skull-pop text-3xl sm:text-4xl">💀</span><span className="text-red-400 text-xs font-bold mt-1">MORT</span></>}
          {isLife  && <><span className="text-3xl sm:text-4xl">✅</span><span className="text-green-400 text-xs font-bold mt-1">VIE</span></>}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function IRLPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [tableCard, setTableCard] = useState<TableCard | null>(null);
  const [shooterIndex, setShooterIndex] = useState<number | null>(null);
  const [cardStates, setCardStates] = useState<CardState[]>([]);
  const [shotResult, setShotResult] = useState<ShotResult | null>(null);
  const [flash, setFlash] = useState<'red' | 'green' | null>(null);
  const [locked, setLocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Setup ──────────────────────────────────────────────────────────────────
  function addPlayer() {
    const name = nameInput.trim();
    if (!name || players.find(p => p.name === name)) return;
    setPlayers(prev => [...prev, {
      name, status: 'alive',
      deathPosition: randomDeathPos(6),
      cardsRemaining: 6,
    }]);
    setNameInput('');
    inputRef.current?.focus();
  }

  function removePlayer(i: number) {
    setPlayers(prev => prev.filter((_, idx) => idx !== i));
  }

  function startGame() {
    if (players.length < 2) return;
    setTableCard(pickTableCard());
    setPhase('playing');
  }

  // ── Tirer ─────────────────────────────────────────────────────────────────
  function openShooter(i: number) {
    const player = players[i];
    setShooterIndex(i);
    setCardStates(Array(player.cardsRemaining).fill('hidden'));
    setShotResult(null);
    setLocked(false);
    setPhase('shooting');
  }

  function handlePickCard(cardIdx: number) {
    if (locked || shooterIndex === null) return;
    setLocked(true);

    const player = players[shooterIndex];
    const died = cardIdx === player.deathPosition;

    // Animation : picking → flipping → résultat
    setCardStates(prev => prev.map((s, i) => i === cardIdx ? 'picking' : s));

    setTimeout(() => {
      setCardStates(prev => prev.map((s, i) => i === cardIdx ? 'flipping' : s));
    }, 400);

    setTimeout(() => {
      setCardStates(prev => prev.map((s, i) => i === cardIdx ? (died ? 'death' : 'life') : s));
      setFlash(died ? 'red' : 'green');
      setTimeout(() => setFlash(null), 1000);

      setShotResult({ playerIndex: shooterIndex, pickedCard: cardIdx, died });

      // Mettre à jour le joueur
      setPlayers(prev => prev.map((p, i) => {
        if (i !== shooterIndex) return p;
        if (died) return { ...p, status: 'dead' };
        const newDeath = cardIdx < p.deathPosition ? p.deathPosition - 1 : p.deathPosition;
        return { ...p, deathPosition: newDeath, cardsRemaining: p.cardsRemaining - 1 };
      }));

      setPhase('shotResult');
    }, 900);
  }

  function afterShot() {
    const alive = players.filter((p, i) => {
      if (i === shooterIndex && shotResult?.died) return false;
      return p.status === 'alive';
    });

    if (alive.length <= 1) {
      setPhase('gameOver');
      return;
    }
    // Nouveau tour = nouvelle carte
    setTableCard(pickTableCard());
    setShooterIndex(null);
    setShotResult(null);
    setPhase('playing');
  }

  function resetGame() {
    setPhase('setup');
    setPlayers([]);
    setTableCard(null);
    setShooterIndex(null);
    setShotResult(null);
    setFlash(null);
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const alivePlayers = players.filter(p => p.status === 'alive');
  const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;

  return (
    <main className="min-h-screen flex flex-col items-center p-6 max-w-2xl mx-auto">
      {/* Flash plein écran */}
      {flash === 'red'   && <div className="flash-red   fixed inset-0 bg-red-600   z-50 pointer-events-none" />}
      {flash === 'green' && <div className="flash-green fixed inset-0 bg-green-500 z-50 pointer-events-none" />}

      {/* Header */}
      <div className="w-full flex items-center justify-between mb-8 pt-2">
        <Link href="/" className="text-stone-500 hover:text-amber-400 transition-colors text-sm">
          ← Retour
        </Link>
        <h1 className="text-3xl font-bold text-amber-400 tracking-widest">LIAR'S BAR IRL</h1>
        <div className="w-16" />
      </div>

      {/* ── SETUP ───────────────────────────────────────────────────────────── */}
      {phase === 'setup' && (
        <div className="w-full space-y-6">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6">
            <p className="text-amber-300 text-xs uppercase tracking-widest mb-4">Ajouter des joueurs</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                placeholder="Nom du joueur..."
                maxLength={20}
                className="flex-1 bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-amber-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                onClick={addPlayer}
                className="bg-amber-700 hover:bg-amber-600 text-stone-950 font-bold px-5 py-3 rounded-lg transition-colors"
              >
                +
              </button>
            </div>

            {players.length > 0 && (
              <div className="mt-4 space-y-2">
                {players.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 bg-stone-800 px-4 py-2 rounded-lg">
                    <span className="text-lg">🎭</span>
                    <span className="flex-1 text-amber-50">{p.name}</span>
                    <button onClick={() => removePlayer(i)} className="text-stone-500 hover:text-red-400 transition-colors text-lg">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startGame}
            disabled={players.length < 2}
            className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-widest"
          >
            {players.length < 2 ? `Ajouter au moins 2 joueurs (${players.length}/2)` : '🎮 Lancer la partie'}
          </button>

          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 text-xs text-stone-500 space-y-1">
            <p className="text-amber-400 font-bold text-sm mb-2">📖 Comment jouer</p>
            <p>• L'app tire une carte au sort (la carte du tour).</p>
            <p>• Jouez vos vraies cartes face cachée en prétendant qu'elles correspondent.</p>
            <p>• Quand quelqu'un est accusé de mentir et perd, il clique "Tirer".</p>
            <p>• Une des cartes est fatale. Au prochain tir il en reste une de moins.</p>
          </div>
        </div>
      )}

      {/* ── PLAYING ─────────────────────────────────────────────────────────── */}
      {phase === 'playing' && tableCard && (
        <div className="w-full space-y-6">
          {/* Carte du tour */}
          <div className={`rounded-2xl border-2 p-6 text-center ${CARD_DISPLAY[tableCard].color}`}>
            <p className="text-xs uppercase tracking-widest opacity-70 mb-2">Carte du tour</p>
            <div className="text-6xl mb-2">{CARD_DISPLAY[tableCard].emoji}</div>
            <p className="text-2xl font-black tracking-widest">{CARD_DISPLAY[tableCard].label}</p>
          </div>

          {/* Joueurs */}
          <div className="space-y-3">
            {players.map((player, i) => (
              <div key={i} className={`bg-stone-900 border rounded-xl p-4 flex items-center gap-4 ${
                player.status === 'dead' ? 'border-stone-800 opacity-50' : 'border-stone-700'
              }`}>
                <span className="text-2xl">{player.status === 'dead' ? '💀' : '🎭'}</span>
                <div className="flex-1">
                  <p className="font-bold text-amber-50">{player.name}</p>
                  {player.status === 'alive' && (
                    <div className="flex gap-1 mt-1">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <div key={j} className={`w-3 h-3 rounded-sm border ${
                          j < player.cardsRemaining ? 'bg-amber-600 border-amber-500' : 'bg-stone-700 border-stone-600'
                        }`} />
                      ))}
                      <span className="text-stone-500 text-xs ml-1">1/{player.cardsRemaining}</span>
                    </div>
                  )}
                </div>
                {player.status === 'alive' && (
                  <button
                    onClick={() => openShooter(i)}
                    className="bg-red-800 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-lg transition-colors text-sm uppercase tracking-wider pulse-red"
                  >
                    🔫 Tirer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SHOOTING ────────────────────────────────────────────────────────── */}
      {(phase === 'shooting' || phase === 'shotResult') && shooterIndex !== null && (
        <div className="w-full space-y-6">
          <div className="text-center">
            <p className="text-stone-400 text-sm mb-1">Au tour de</p>
            <p className="text-2xl font-bold text-red-400">{players[shooterIndex].name}</p>
            <p className="text-stone-500 text-xs mt-1">
              {players[shooterIndex].cardsRemaining} carte(s) — 1 seule est fatale
            </p>
          </div>

          {/* Cartes */}
          <div className="flex justify-center gap-2 sm:gap-3 flex-wrap py-4">
            {cardStates.map((state, i) => (
              <DeathCard
                key={i}
                state={state}
                canPick={phase === 'shooting' && !locked && state === 'hidden'}
                onPick={() => handlePickCard(i)}
              />
            ))}
          </div>

          {/* Résultat */}
          {phase === 'shotResult' && shotResult && (
            <div className={`text-center ${shotResult.died ? 'bang-in' : 'click-in'}`}>
              {shotResult.died ? (
                <>
                  <p className="text-5xl font-black text-red-500 mb-1">MORT !</p>
                  <p className="text-lg text-red-400 font-bold">
                    💀 {players[shotResult.playerIndex].name} a tiré la mauvaise carte !
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-black text-green-400 mb-1">SURVÉCU !</p>
                  <p className="text-base text-stone-300">
                    😮‍💨 {players[shotResult.playerIndex].name} —{' '}
                    {players[shotResult.playerIndex].cardsRemaining - 1} carte(s) au prochain tour
                  </p>
                </>
              )}
              <button
                onClick={afterShot}
                className="mt-6 bg-amber-700 hover:bg-amber-600 text-stone-950 font-bold px-8 py-3 rounded-xl transition-colors uppercase tracking-widest"
              >
                Continuer →
              </button>
            </div>
          )}

          {phase === 'shooting' && (
            <p className="text-center text-stone-500 text-sm animate-pulse">
              Choisissez une carte...
            </p>
          )}
        </div>
      )}

      {/* ── GAME OVER ───────────────────────────────────────────────────────── */}
      {phase === 'gameOver' && (
        <div className="w-full text-center space-y-6">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-10">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-4xl font-bold text-amber-400 mb-2">VICTOIRE !</h2>
            <p className="text-xl text-stone-300 mb-8">
              {winner?.name ?? alivePlayers[0]?.name} a survécu !
            </p>
            <div className="space-y-2 mb-8">
              {players.map((p, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2 rounded-lg ${
                  p.status === 'alive' ? 'bg-green-900/30 border border-green-700/50' : 'bg-stone-800'
                }`}>
                  <span>{p.status === 'alive' ? '👑' : '💀'}</span>
                  <span className={`flex-1 text-left ${p.status === 'alive' ? 'text-green-300' : 'text-stone-500'}`}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={resetGame}
              className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold px-8 py-3 rounded-xl transition-colors uppercase tracking-widest"
            >
              Rejouer
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
