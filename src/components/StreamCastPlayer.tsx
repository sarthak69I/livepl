// @ts-nocheck
"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Settings,
  Maximize,
  Minimize,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface StreamCastPlayerProps {
  src: string;
}

const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds < 0) return '00:00';
  const date = new Date(0);
  date.setSeconds(timeInSeconds);
  const timeString = date.toISOString().substr(11, 8);
  return timeString.startsWith('00:') ? timeString.substr(3) : timeString;
};

const StreamCastPlayer: React.FC<StreamCastPlayerProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) { // Only hide if playing
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = videoRef.current;
    setIsLoading(true);
    setError(null);

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
         // For live streams, these configurations might be useful
        liveSyncDurationCount: 3, // Number of segments to buffer ahead of the live edge
        liveMaxLatencyDurationCount: 5, // Number of segments that can be behind live before seeking to live edge
        liveDurationInfinity: true, // Indicates a live stream
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // For live streams, duration might be Infinity.
        // We can check if it's a live stream
        if (hls.levels.length > 0 && hls.levels[0].details && hls.levels[0].details.live) {
          setDuration(Infinity); // Indicate live stream
        }
        // Autoplay is often blocked by browsers, so we might not call videoElement.play() here.
        // User interaction is usually required.
        setIsLoading(false);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError(`Network error: ${data.details}`);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError(`Media error: ${data.details}`);
              // hls.recoverMediaError(); // Attempt to recover
              break;
            default:
              setError('An unrecoverable error occurred.');
              hls.destroy();
              break;
          }
        }
        setIsLoading(false);
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = src;
      videoElement.addEventListener('loadedmetadata', () => {
        setDuration(videoElement.duration);
        setIsLoading(false);
      });
       videoElement.addEventListener('error', () => {
        setError('Error loading native HLS stream.');
        setIsLoading(false);
      });
    } else {
      setError('HLS is not supported in this browser.');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.src = '';
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      if (video.duration !== Infinity) { // Don't override if HLS set Infinity for live
         setDuration(video.duration);
      }
    }
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleCanPlay = () => setIsLoading(false);


    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  useEffect(() => {
    if (showControls) {
      hideControlsAfterDelay();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, hideControlsAfterDelay]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(err => console.error("Play error:", err));
    } else {
      videoRef.current.pause();
    }
    setShowControls(true); // Show controls on interaction
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    setShowControls(true);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
    if (!videoRef.current.muted && volume === 0) { // Unmuting when volume is 0, set to a default
      videoRef.current.volume = 0.5;
      setVolume(0.5);
    }
    setShowControls(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || duration === Infinity) return; // Seeking not typical for live
    videoRef.current.currentTime = parseFloat(e.target.value);
    setCurrentTime(parseFloat(e.target.value));
    setShowControls(true);
  };

  const toggleFullScreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
    } else {
      document.exitFullscreen();
    }
    setShowControls(true);
  };
  
  const handlePlayerClick = () => {
    togglePlayPause();
  }

  const handleMouseMove = () => {
    setShowControls(true);
    hideControlsAfterDelay();
  };

  const handleMouseLeave = () => {
    if (isPlaying) { // Only start hide timer if playing
      hideControlsAfterDelay();
    }
  };


  return (
    <div
      ref={playerContainerRef}
      className="relative w-full h-full bg-black flex items-center justify-center text-foreground select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video ref={videoRef} className="w-full h-full object-contain" onClick={handlePlayerClick} playsInline />
      
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
          <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))]" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-destructive-foreground p-4 z-20">
          <AlertTriangle className="h-12 w-12 mb-2" />
          <p className="text-center">{error}</p>
        </div>
      )}

      {!error && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 md:p-4 transition-opacity duration-300 ease-in-out z-10 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()} // Prevent player click through controls
        >
          {duration !== Infinity && (
             <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 mb-2 custom-slider accent-[hsl(var(--accent))]"
                disabled={duration === Infinity}
              />
          )}
         
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={togglePlayPause} className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1">
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <div className="flex items-center group">
                <button onClick={toggleMute} className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1">
                  {isMuted || volume === 0 ? (
                    <VolumeX size={20} />
                  ) : volume < 0.5 ? (
                    <Volume1 size={20} />
                  ) : (
                    <Volume2 size={20} />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 md:w-20 h-1.5 ml-1 custom-slider accent-[hsl(var(--accent))] opacity-0 group-hover:w-20 group-hover:opacity-100 transition-all duration-300 ease-in-out"
                />
              </div>
              <div className="text-xs md:text-sm tabular-nums">
                <span>{formatTime(currentTime)}</span>
                {duration !== Infinity && (
                  <>
                    <span> / </span>
                    <span>{formatTime(duration)}</span>
                  </>
                )}
                 {duration === Infinity && <span className="ml-2 px-2 py-0.5 bg-red-600 text-white text-xs rounded">LIVE</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <button className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1 opacity-50 cursor-not-allowed" title="Settings (not available)">
                <Settings size={20} />
              </button>
              <button onClick={toggleFullScreen} className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1">
                {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamCastPlayer;
