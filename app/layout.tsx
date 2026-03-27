import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Liar's Bar",
  description: 'Jeu de bluff multijoueur avec roulette russe',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-stone-950 text-amber-50 min-h-screen font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
