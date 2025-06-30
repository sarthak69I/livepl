
'use client';

import React from 'react';

interface YouTubePlayerProps {
  videoId: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId }) => {
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      <iframe
        className="w-full h-full"
        src={embedUrl}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
       <div 
        className="absolute top-2 right-2 text-xs text-white/70 z-[5] pointer-events-none"
        style={{ textShadow: '0px 0px 2px rgba(0,0,0,0.5)' }}
      >
        e-leak.vercel.app
      </div>
    </div>
  );
};

export default YouTubePlayer;
