"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StreamCastPlayer from '@/components/StreamCastPlayer';
import { Loader2, AlertTriangle } from 'lucide-react';

function PlayerPageContent() {
  const searchParams = useSearchParams();
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingParams, setIsLoadingParams] = useState(true);

  useEffect(() => {
    const urlParam = searchParams.get('liveurl');
    if (urlParam) {
      try {
        const parsedUrl = new URL(urlParam); // Basic validation
        if (parsedUrl.pathname.toLowerCase().endsWith('.m3u8')) {
          setLiveUrl(urlParam);
          setError(null);
        } else {
          setError("Invalid stream URL: Must be an .m3u8 file.");
          setLiveUrl(null);
        }
      } catch (e) {
        setError("Invalid stream URL format.");
        setLiveUrl(null);
      }
    } else {
      setError("No 'liveurl' parameter provided. Please use the format: ?liveurl=YOUR_STREAM_URL");
      setLiveUrl(null);
    }
    setIsLoadingParams(false);
  }, [searchParams]);

  if (isLoadingParams) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-foreground p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))] mb-4" />
        <p>Loading URL parameters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-destructive-foreground p-8 text-center bg-background">
        <AlertTriangle className="h-12 w-12 mb-4 text-destructive" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!liveUrl) {
     // This case should ideally be covered by error state, but as a fallback:
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-foreground p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))] mb-4" />
        <p>Preparing player...</p>
      </div>
    );
  }

  return <StreamCastPlayer src={liveUrl} />;
}

export default function Home() {
  return (
    <main className="w-screen h-screen bg-background text-foreground overflow-hidden flex flex-col">
      {/* Suspense is necessary for useSearchParams in Next.js App Router */}
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center w-full h-full text-foreground p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))] mb-4" />
          <p>Initializing Player...</p>
        </div>
      }>
        <PlayerPageContent />
      </Suspense>
    </main>
  );
}
