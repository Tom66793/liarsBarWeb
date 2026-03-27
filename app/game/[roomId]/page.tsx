'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSocket } from '@/lib/socket';
import { GameState, Card, LiarCalledEvent, TriggerResultEvent } from '@/lib/types';
import LobbyScreen from '@/components/LobbyScreen';
import GameBoard from '@/components/GameBoard';

export default function GamePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string>('');
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [liarEvent, setLiarEvent] = useState<LiarCalledEvent | null>(null);
  const [triggerEvent, setTriggerEvent] = useState<TriggerResultEvent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();

    if (socket.id) setMyId(socket.id);

    // Demande l'état actuel dès le montage pour éviter la race condition
    socket.emit('request_state', { roomId });
    socket.once('connect', () => {
      socket.emit('request_state', { roomId });
    });

    socket.on('connect', () => setMyId(socket.id ?? ''));

    socket.on('room_joined', ({ playerId }: { roomId: string; playerId: string }) => {
      setMyId(playerId);
    });

    socket.on('game_state', (state: GameState) => {
      setGameState(state);
      // Clear events when phase changes back to playing
      if (state.phase === 'playing') {
        setLiarEvent(null);
        setTriggerEvent(null);
      }
    });

    socket.on('your_hand', ({ hand }: { hand: Card[] }) => {
      setMyHand(hand);
    });

    socket.on('liar_called', (event: LiarCalledEvent) => {
      setLiarEvent(event);
    });

    socket.on('trigger_result', (event: TriggerResultEvent) => {
      setTriggerEvent(event);
    });

    socket.on('error_msg', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    // If socket not already in room, redirect to home
    socket.on('disconnect', () => {
      router.push('/');
    });

    return () => {
      socket.off('connect');
      socket.off('room_joined');
      socket.off('game_state');
      socket.off('your_hand');
      socket.off('liar_called');
      socket.off('trigger_result');
      socket.off('error_msg');
      socket.off('disconnect');
    };
  }, [router]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-400 text-xl animate-pulse">Connexion au salon...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Error toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-900 border border-red-600 text-red-200 px-6 py-3 rounded-xl shadow-xl">
          {error}
        </div>
      )}

      {gameState.phase === 'lobby' ? (
        <LobbyScreen
          gameState={gameState}
          myId={myId}
          roomId={roomId}
        />
      ) : (
        <GameBoard
          gameState={gameState}
          myId={myId}
          myHand={myHand}
          roomId={roomId}
          liarEvent={liarEvent}
          triggerEvent={triggerEvent}
        />
      )}
    </div>
  );
}
