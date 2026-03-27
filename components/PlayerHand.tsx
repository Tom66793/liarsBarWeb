'use client';

import { useState } from 'react';
import { Card, CardType } from '@/lib/types';

const CARD_DISPLAY: Record<CardType, { label: string; emoji: string; color: string }> = {
  ACE:   { label: 'As',    emoji: '🂡', color: 'text-amber-300' },
  KING:  { label: 'Roi',   emoji: '🂮', color: 'text-blue-300'  },
  QUEEN: { label: 'Dame',  emoji: '🂭', color: 'text-pink-300'  },
  JOKER: { label: 'Joker', emoji: '🃟', color: 'text-green-300' },
};

interface Props {
  hand: Card[];
  onPlay: (cardIds: string[]) => void;
  isMyTurn: boolean;
  tableCard: CardType | null;
  disabled: boolean;
}

export default function PlayerHand({ hand, onPlay, isMyTurn, tableCard, disabled }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleCard(id: string) {
    if (!isMyTurn || disabled) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }

  function handlePlay() {
    if (selected.size === 0) return;
    onPlay([...selected]);
    setSelected(new Set());
  }

  if (hand.length === 0) {
    return (
      <div className="text-center text-stone-500 text-sm py-4">
        Plus de cartes en main
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Cards */}
      <div className="flex flex-wrap justify-center gap-2">
        {hand.map(card => {
          const display = CARD_DISPLAY[card.type];
          const isSelected = selected.has(card.id);
          return (
            <button
              key={card.id}
              onClick={() => toggleCard(card.id)}
              disabled={!isMyTurn || disabled}
              className={`
                relative w-16 h-24 rounded-xl border-2 flex flex-col items-center justify-center
                transition-all duration-150 select-none
                ${isSelected
                  ? 'border-amber-400 bg-amber-900/40 -translate-y-3 shadow-lg shadow-amber-900/50'
                  : 'border-stone-600 bg-stone-800 hover:border-stone-400'
                }
                ${!isMyTurn || disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:-translate-y-1'}
              `}
            >
              <span className="text-2xl">{display.emoji}</span>
              <span className={`text-xs font-bold mt-1 ${display.color}`}>{display.label}</span>
              {isSelected && (
                <span className="absolute -top-2 -right-2 bg-amber-500 text-stone-950 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Play button */}
      {isMyTurn && !disabled && (
        <div className="flex gap-3 items-center">
          <span className="text-stone-500 text-xs">
            {selected.size > 0
              ? `${selected.size} carte(s) sélectionnée(s) — déclarées comme "${tableCard ? CARD_DISPLAY[tableCard].label : '?'}"`
              : 'Sélectionnez 1 à 3 cartes'}
          </span>
          <button
            onClick={handlePlay}
            disabled={selected.size === 0}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-stone-950 font-bold px-6 py-2 rounded-lg transition-colors text-sm uppercase tracking-wider"
          >
            Jouer
          </button>
        </div>
      )}
    </div>
  );
}
