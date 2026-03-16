import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Anomaly',
  description: 'See how any codebase connects',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
