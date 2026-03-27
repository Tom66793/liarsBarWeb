'use client';

import { useEffect, useState, useCallback } from 'react';
import { LiarCalledEvent, TriggerResultEvent, CardType } from '@/lib/types';

const CARD_LABELS: Record<CardType, string> = {
  ACE: 'As', KING: 'Roi', QUEEN: 'Dame', JOKER: 'Joker',
};

type CardState = 'hidden' | 'picking' | 'flipping' | 'death' | 'life' | 'removed';

interface Props {
  liarEvent: LiarCalledEvent | null;
  triggerEvent: TriggerResultEvent | null;
  myId: string;
  pendingShooter: string | null;
  onPickCard: (cardIndex: number) => void;
  shooterCardsRemaining: number;
}

export default function RevolverModal({
  liarEvent, triggerEvent, myId, pendingShooter, onPickCard, shooterCardsRemaining,
}: Props) {
  const [cardStates, setCardStates] = useState<CardState[]>([]);
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  const [result, setResult] = useState<TriggerResultEvent | null>(null);
  const [showFlash, setShowFlash] = useState<'red' | 'green' | null>(null);
  const [locked, setLocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Initialise les cartes selon le nombre restant pour ce tireur
  useEffect(() => {
    if (liarEvent) {
      setCardStates(Array(shooterCardsRemaining).fill('hidden'));
      setPickedIndex(null);
      setResult(null);
      setShowFlash(null);
      setLocked(false);
      setDismissed(false);
    }
  }, [liarEvent, shooterCardsRemaining]);

  // Quand le résultat arrive du serveur → séquence d'animation
  const playResultSequence = useCallback((res: TriggerResultEvent, picked: number) => {
    // 1. Carte remonte (picking)
    setCardStates(prev => prev.map((s, i) => i === picked ? 'picking' : s));

    // 2. Après 400ms → flip
    setTimeout(() => {
      setCardStates(prev => prev.map((s, i) => i === picked ? 'flipping' : s));
    }, 400);

    // 3. Après 900ms → révéler face + flash écran
    setTimeout(() => {
      setCardStates(prev => prev.map((s, i) => {
        if (i === picked) return res.died ? 'death' : 'life';
        if (res.died && res.deathPosition !== null && i === res.deathPosition) return 'death';
        return s;
      }));
      setResult(res);
      setShowFlash(res.died ? 'red' : 'green');
      setTimeout(() => setShowFlash(null), 1000);

      // Si mort : fermer le modal après que l'animation soit terminée
      if (res.died) {
        setTimeout(() => setDismissed(true), 4000);
      }
    }, 900);
  }, []);

  useEffect(() => {
    if (triggerEvent && !result) {
      // Le tireur a pickedIndex en local, les spectateurs utilisent cardIndex du serveur
      const picked = pickedIndex !== null ? pickedIndex : triggerEvent.cardIndex;
      playResultSequence(triggerEvent, picked);
    }
  }, [triggerEvent, pickedIndex, result, playResultSequence]);

  function handlePick(index: number) {
    if (locked || cardStates[index] !== 'hidden') return;
    setLocked(true);
    setPickedIndex(index);
    onPickCard(index);
  }

  if (!liarEvent || dismissed) return null;

  const isShooter = pendingShooter === myId;
  const died = result?.died ?? false;

  return (
    <>
      {/* Flash plein écran */}
      {showFlash === 'red'   && <div className="flash-red   fixed inset-0 bg-red-600   z-50 pointer-events-none" />}
      {showFlash === 'green' && <div className="flash-green fixed inset-0 bg-green-500 z-50 pointer-events-none" />}

      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-40 flex items-center justify-center p-4">
        <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6 max-w-xl w-full shadow-2xl">

          {/* ── Accusation & cartes ──────────────────────────────── */}
          <div className="text-center mb-4">
            <p className="text-stone-400 text-sm mb-2">
              <strong className="text-amber-300">{liarEvent.callerName}</strong> accuse{' '}
              <strong className="text-red-300">{liarEvent.accusedName}</strong> !
            </p>
            <div className="bg-stone-800 rounded-xl p-3 mb-3">
              <p className="text-xs text-stone-500 mb-2 uppercase tracking-widest">
                Déclarées : {CARD_LABELS[liarEvent.claimedType]}
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                {liarEvent.revealedCards.map(card => {
                  const isLie = card.type !== liarEvent.claimedType && card.type !== 'JOKER';
                  return (
                    <div key={card.id} className={`px-3 py-1.5 rounded-lg font-bold text-sm border-2 ${
                      isLie ? 'border-red-500 bg-red-900/30 text-red-300'
                            : 'border-green-500 bg-green-900/30 text-green-300'
                    }`}>
                      {card.type === 'JOKER' ? '🃟 Joker' : CARD_LABELS[card.type]}
                      {isLie ? ' ❌' : ' ✓'}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className={`text-base font-bold mb-1 ${liarEvent.wasLying ? 'text-red-400' : 'text-green-400'}`}>
              {liarEvent.wasLying ? `💀 ${liarEvent.accusedName} MENTAIT !` : `✅ ${liarEvent.accusedName} disait la vérité !`}
            </div>
            <p className="text-stone-400 text-sm">
              <strong className="text-red-400">{liarEvent.shooterName}</strong> doit choisir une carte...
            </p>
          </div>

          {/* ── Les cartes ───────────────────────────────────────── */}
          <div className="mb-5">
            <p className="text-center text-xs text-stone-500 uppercase tracking-widest mb-4">
              {isShooter && !result
                ? `Choisissez une carte — ${shooterCardsRemaining} carte(s), une seule est fatale`
                : !result
                ? `${liarEvent.shooterName} choisit...`
                : ''
              }
            </p>

            <div className="flex justify-center gap-3 flex-wrap">
              {cardStates.map((state, i) => (
                <DeathCard
                  key={i}
                  state={state}
                  canPick={isShooter && !locked && state === 'hidden'}
                  onPick={() => handlePick(i)}
                />
              ))}
            </div>
          </div>

          {/* ── Résultat ────────────────────────────────────────── */}
          {result && (
            <div className={`text-center ${died ? 'bang-in' : 'click-in'}`}>
              {died ? (
                <>
                  <div className="text-5xl font-black text-red-500 tracking-widest mb-1">MORT !</div>
                  <div className="text-lg font-bold text-red-400">
                    💀 {result.playerName} a tiré la mauvaise carte !
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-black text-green-400 tracking-widest mb-1">SURVÉCU !</div>
                  <div className="text-base font-bold text-stone-300">
                    😮‍💨 {result.playerName} — {result.cardsRemaining} carte(s) restante(s) au prochain tour
                  </div>
                </>
              )}
              <p className="text-stone-500 text-xs mt-3 animate-pulse">
                Prochain tour dans quelques secondes...
              </p>
            </div>
          )}

          {/* Attente spectateurs */}
          {!isShooter && !result && (
            <div className="text-center text-stone-400 text-sm animate-pulse">
              En attente que <strong className="text-red-400">{liarEvent.shooterName}</strong> choisisse...
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Composant carte individuelle ─────────────────────────────────────────────
function DeathCard({ state, canPick, onPick }: {
  state: CardState;
  canPick: boolean;
  onPick: () => void;
}) {
  const isFlipped = state === 'flipping' || state === 'death' || state === 'life';
  const isDeath   = state === 'death';
  const isLife    = state === 'life';
  const isPicking = state === 'picking';

  return (
    <div className="card-3d-wrap w-20 h-28">
      <div
        className={`card-3d w-20 h-28 ${isFlipped ? 'flipped' : ''} ${isPicking ? 'card-picking' : ''}`}
        style={{ position: 'relative' }}
      >
        {/* Face avant (dos de la carte) */}
        <div
          className={`card-face w-20 h-28 flex flex-col items-center justify-center border-2 rounded-xl
            ${canPick
              ? 'border-amber-500 bg-stone-700 cursor-pointer hover:-translate-y-2 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-900/50 transition-transform'
              : 'border-stone-600 bg-stone-800 cursor-default'
            }
          `}
          onClick={canPick ? onPick : undefined}
        >
          {/* Motif dos de carte */}
          <div className="grid grid-cols-3 gap-0.5 opacity-30">
            {Array(9).fill(null).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            ))}
          </div>
          <span className="text-xs text-stone-500 mt-2 uppercase tracking-widest">?</span>
        </div>

        {/* Face arrière (résultat) */}
        <div className={`card-face card-face-back w-20 h-28 flex flex-col items-center justify-center border-2 rounded-xl
          ${isDeath ? 'border-red-500 bg-red-950'   : ''}
          ${isLife  ? 'border-green-500 bg-green-950' : ''}
          ${isFlipped && !isDeath && !isLife ? 'border-stone-500 bg-stone-800' : ''}
        `}>
          {isDeath && (
            <div className="skull-pop flex flex-col items-center">
              <span className="text-4xl">💀</span>
              <span className="text-red-400 text-xs font-bold mt-1 tracking-widest">MORT</span>
            </div>
          )}
          {isLife && (
            <div className="flex flex-col items-center">
              <span className="text-4xl">✅</span>
              <span className="text-green-400 text-xs font-bold mt-1 tracking-widest">VIE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
