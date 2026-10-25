import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Blooms — A little understanding, every day', description: 'Turn course materials into a thoughtful, personalized study session.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
