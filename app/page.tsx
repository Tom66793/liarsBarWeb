'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSocket } from '@/lib/socket';

export default function Home() {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket();

    socket.on('room_joined', ({ roomId }: { roomId: string; playerId: string }) => {
      router.push(`/game/${roomId}`);
    });

    socket.on('error_msg', (msg: string) => {
      setError(msg);
      setLoading('');
    });

    return () => {
      socket.off('room_joined');
      socket.off('error_msg');
    };
  }, [router]);

  function handleCreate() {
    if (!name.trim()) { setError('Entre ton pseudo'); return; }
    setError('');
    setLoading('create');
    getSocket().emit('create_room', { name: name.trim() });
  }

  function handleJoin() {
    if (!name.trim()) { setError('Entre ton pseudo'); return; }
    if (!roomId.trim()) { setError('Entre le code du salon'); return; }
    setError('');
    setLoading('join');
    getSocket().emit('join_room', { name: name.trim(), roomId: roomId.trim().toUpperCase() });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-amber-400 tracking-widest mb-2 drop-shadow-lg">
          LIAR'S BAR
        </h1>
        <p className="text-stone-400 text-sm tracking-wide">
          Bluff. Trahison. Roulette russe.
        </p>
        <div className="mt-4 flex justify-center gap-3 text-2xl">
          <span>🃏</span><span>🔫</span><span>💀</span>
        </div>
      </div>

      <div className="bg-stone-900 border border-stone-700 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="mb-6">
          <label className="block text-amber-300 text-xs uppercase tracking-widest mb-2">
            Ton pseudo
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="John Doe..."
            maxLength={20}
            className="w-full bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-amber-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-stone-700" />
          <span className="text-stone-500 text-xs">CRÉER</span>
          <div className="flex-1 h-px bg-stone-700" />
        </div>

        <button
          onClick={handleCreate}
          disabled={!!loading}
          className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold py-3 rounded-lg transition-colors uppercase tracking-widest text-sm"
        >
          {loading === 'create' ? 'Création...' : 'Créer un salon'}
        </button>

        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-stone-700" />
          <span className="text-stone-500 text-xs">OU REJOINDRE</span>
          <div className="flex-1 h-px bg-stone-700" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={roomId}
            onChange={e => setRoomId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="CODE"
            maxLength={6}
            className="flex-1 bg-stone-800 border border-stone-600 rounded-lg px-4 py-3 text-amber-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors uppercase text-center tracking-widest"
          />
          <button
            onClick={handleJoin}
            disabled={!!loading}
            className="bg-stone-700 hover:bg-stone-600 disabled:opacity-50 disabled:cursor-not-allowed text-amber-300 font-bold px-6 py-3 rounded-lg transition-colors uppercase tracking-wider text-sm"
          >
            {loading === 'join' ? '...' : 'Rejoindre'}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-red-400 text-sm text-center bg-red-950/30 border border-red-800/50 rounded-lg py-2">
            {error}
          </p>
        )}
      </div>

      <Link
        href="/irl"
        className="mt-4 w-full max-w-md flex items-center justify-center gap-3 bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-amber-600 text-amber-300 font-bold py-4 rounded-xl transition-colors uppercase tracking-widest text-sm"
      >
        🃏 Jeu IRL
        <span className="text-stone-500 text-xs font-normal normal-case tracking-normal">— Jouer en vrai avec des amis</span>
      </Link>

      <div className="mt-6 max-w-md text-stone-500 text-xs text-center leading-relaxed">
        <p>Jouez des cartes face cachée en prétendant qu'elles correspondent à la carte du tour.</p>
        <p className="mt-1">Appelez le bluff de votre adversaire... ou assumez les conséquences.</p>
        <p className="mt-2 text-red-700">2 à 4 joueurs • Une balle dans le barillet</p>
      </div>
    </main>
  );
}
