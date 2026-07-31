import './globals.css';
import type { Metadata } from 'next';
import GridGlowBackground from '@/components/GridGlowBackground';

export const metadata: Metadata = {
  title: 'Sound for All',
  description: 'Speech clearer, not louder — with sight and touch backup for every alert.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GridGlowBackground />
        {children}
      </body>
    </html>
  );
}
