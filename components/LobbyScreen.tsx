'use client';

import { GameState } from '@/lib/types';
import { getSocket } from '@/lib/socket';

interface Props {
  gameState: GameState;
  myId: string;
  roomId: string;
}

export default function LobbyScreen({ gameState, myId, roomId }: Props) {
  const me = gameState.players.find(p => p.id === myId);
  const isHost = me?.isHost;

  function handleStart() {
    getSocket().emit('start_game', { roomId });
  }

  function copyCode() {
    navigator.clipboard.writeText(roomId);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-bold text-amber-400 tracking-widest mb-2">LIAR'S BAR</h1>
      <p className="text-stone-500 text-sm mb-10">Salon d'attente</p>

      {/* Room code */}
      <div className="bg-stone-900 border border-stone-700 rounded-2xl p-8 w-full max-w-md mb-6">
        <div className="text-center mb-6">
          <p className="text-stone-400 text-xs uppercase tracking-widest mb-2">Code du salon</p>
          <button
            onClick={copyCode}
            className="text-4xl font-bold text-amber-300 tracking-widest hover:text-amber-200 transition-colors cursor-pointer"
            title="Copier"
          >
            {roomId}
          </button>
          <p className="text-stone-600 text-xs mt-1">Cliquer pour copier</p>
        </div>

        {/* Players */}
        <div className="space-y-2">
          <p className="text-stone-400 text-xs uppercase tracking-widest mb-3">
            Joueurs ({gameState.players.length}/4)
          </p>
          {gameState.players.map(player => (
            <div
              key={player.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                player.id === myId ? 'bg-amber-900/30 border border-amber-700/50' : 'bg-stone-800'
              }`}
            >
              <span className="text-xl">{player.isHost ? '👑' : '🎭'}</span>
              <span className="text-amber-50 font-medium flex-1">{player.name}</span>
              {player.id === myId && (
                <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded">Toi</span>
              )}
              {player.isHost && player.id !== myId && (
                <span className="text-xs text-yellow-500 bg-yellow-900/30 px-2 py-0.5 rounded">Hôte</span>
              )}
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: 4 - gameState.players.length }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg bg-stone-800/40 border border-dashed border-stone-700">
              <span className="text-xl opacity-30">⌛</span>
              <span className="text-stone-600 text-sm">En attente...</span>
            </div>
          ))}
        </div>

        {/* Start button */}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={false}
            className="w-full mt-6 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-widest text-sm"
          >
            {'🔫 Lancer la partie !'}
          </button>
        ) : (
          <div className="w-full mt-6 bg-stone-800 text-stone-500 text-center py-4 rounded-xl text-sm">
            En attente que l'hôte lance la partie...
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-6 w-full max-w-md text-xs text-stone-400 space-y-2">
        <p className="text-amber-400 font-bold text-sm mb-3">📖 Règles</p>
        <p>• Chaque tour, une carte est désignée (As, Roi ou Dame).</p>
        <p>• À votre tour, jouez 1 à 3 cartes face cachée en prétendant qu'elles correspondent toutes à la carte du tour.</p>
        <p>• Le joueur suivant peut jouer ses propres cartes ou crier <strong className="text-red-400">MENTEUR !</strong></p>
        <p>• Si vous mentez et êtes pris → vous tirez. Si vous accusez à tort → vous tirez.</p>
        <p>• Les Jokers sont des jokers universels (valent n'importe quelle carte).</p>
        <p className="text-red-500">• Le perdant est le dernier à tomber sous la balle.</p>
      </div>
    </main>
  );
}
