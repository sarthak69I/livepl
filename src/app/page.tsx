
"use client";

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import StreamCastPlayer from '@/components/StreamCastPlayer';
import YouTubePlayer from '@/components/YouTubePlayer';
import { Loader2, AlertTriangle } from 'lucide-react';

// Function to extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  // Regex to handle standard, shorts, live, and youtu.be links
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([^?&\n\s]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function PlayerPageContent() {
  const searchParams = useSearchParams();
  const [streamType, setStreamType] = useState<'hls' | 'youtube' | 'none'>('none');
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingParams, setIsLoadingParams] = useState(true);

  useEffect(() => {
    const urlParam = searchParams.get('liveurl');

    if (urlParam) {
      let potentialUrl = urlParam;
      // Try to decode from Base64 first. If it succeeds, use the decoded value.
      try {
        const fromBase64 = atob(urlParam);
        potentialUrl = fromBase64;
      } catch (e) {
        // Not a Base64 string, so we'll proceed with the original urlParam.
      }
      
      const videoId = getYouTubeVideoId(potentialUrl);

      if (videoId) {
        setStreamType('youtube');
        setYoutubeVideoId(videoId);
        setError(null);
      } else if (potentialUrl.toLowerCase().endsWith('.m3u8')) {
        try {
          new URL(potentialUrl); // Basic validation
          setStreamType('hls');
          setStreamUrl(potentialUrl);
          setError(null);
        } catch (e) {
          setError("Invalid HLS stream URL format.");
          setStreamType('none');
        }
      } else {
        setError("Unsupported stream URL. Please provide a valid .m3u8 or YouTube URL.");
        setStreamType('none');
      }

    } else {
      setError("The live class is not started yet.");
      setStreamType('none');
    }
    
    setIsLoadingParams(false);
    
    // Clean up the URL in the address bar
    if (urlParam && window.history.replaceState) {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
    }
  }, [searchParams]);

  if (isLoadingParams) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-foreground p-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))] mb-4" />
        <p>Loading...</p>
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

  if (streamType === 'hls' && streamUrl) {
    return <StreamCastPlayer src={streamUrl} />;
  }

  if (streamType === 'youtube' && youtubeVideoId) {
    return <YouTubePlayer videoId={youtubeVideoId} />;
  }

  // Fallback loading state
  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-foreground p-8 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))] mb-4" />
      <p>Preparing player...</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1 w-full bg-background text-foreground flex flex-col">
      <div className="w-full h-full flex flex-col">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center w-full h-full text-foreground p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))] mb-4" />
            <p>Initializing Player...</p>
          </div>
        }>
          <PlayerPageContent />
        </Suspense>
      </div>
    </main>
  );
}
