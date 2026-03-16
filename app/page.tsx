'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import HeroSection from '@/components/landing/HeroSection';
import DropZone from '@/components/landing/DropZone';
import GitHubInput from '@/components/landing/GitHubInput';
import DemoCards from '@/components/landing/DemoCards';

export default function Home() {
  const router = useRouter();

  const handleFilesLoaded = useCallback(
    (files: { path: string; content: string }[]) => {
      // Store files in sessionStorage for the graph page to consume
      sessionStorage.setItem('anomaly:local-files', JSON.stringify(files));
      router.push('/graph?local=true');
    },
    [router],
  );

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-20">
      {/* Subtle animated background dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="animate-drift absolute -left-32 top-1/4 h-2 w-2 rounded-full bg-white/[0.03]" />
        <div className="animate-drift-slow absolute right-1/4 top-1/3 h-1.5 w-1.5 rounded-full bg-white/[0.04]" />
        <div className="animate-drift absolute bottom-1/3 left-1/3 h-1 w-1 rounded-full bg-white/[0.03]" />
        <div className="animate-drift-slow absolute bottom-1/4 right-1/3 h-2.5 w-2.5 rounded-full bg-white/[0.02]" />
        <div className="animate-drift absolute left-1/2 top-1/5 h-1.5 w-1.5 rounded-full bg-white/[0.03]" />
        <div className="animate-drift-slow absolute bottom-1/5 left-1/4 h-1 w-1 rounded-full bg-white/[0.04]" />
      </div>

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-12 animate-in fade-in duration-700">
        <HeroSection />

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <DropZone onFilesLoaded={handleFilesLoaded} />
          <GitHubInput />
        </div>

        <DemoCards />
      </div>

      <style jsx>{`
        @keyframes drift {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(30px, -20px); }
          50% { transform: translate(-10px, 30px); }
          75% { transform: translate(20px, 10px); }
        }
        @keyframes drift-slow {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-20px, 15px); }
          66% { transform: translate(15px, -25px); }
        }
        .animate-drift { animation: drift 20s ease-in-out infinite; }
        .animate-drift-slow { animation: drift-slow 30s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
