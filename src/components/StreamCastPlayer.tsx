
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
  CheckIcon,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';


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

const playbackRates = [
  { rate: 0.75, label: "0.75x" },
  { rate: 1.0, label: "Normal" },
  { rate: 1.5, label: "1.5x" },
  { rate: 2.0, label: "2.0x" },
  { rate: 3.0, label: "3.0x" },
];

const QUALITY_OPTIONS = [
  { label: "720p", id: '720p' as const },
  { label: "360p", id: '360p' as const, suffix: "_2.m3u8" },
  { label: "240p", id: '240p' as const, suffix: "_1.m3u8" },
];
const DEFAULT_720P_URL_SUFFIXES = ["_4.m3u8", "_5.m3u8"]; // File name part for 720p

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
  const [currentPlaybackRate, setCurrentPlaybackRate] = useState(1.0);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const [settingsView, setSettingsView] = useState<'main' | 'quality' | 'speed'>('main');
  const [currentQualityLabel, setCurrentQualityLabel] = useState<string>("720p");
  const [originalSrcBase, setOriginalSrcBase] = useState<string>("");
  const [original720pSuffixAndQuery, setOriginal720pSuffixAndQuery] = useState<string>("");


  const hideControlsAfterDelay = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsDialog) {
         setShowControls(false);
      }
    }, 3000);
  }, [isPlaying, showSettingsDialog]);

  useEffect(() => {
    if (!videoRef.current) return;

    const videoElement = videoRef.current;
    setIsLoading(true);
    setError(null);

    // Parse the initial src to store its base and original 720p suffix
    const urlPattern = /^(.*\/index)(_[1-5])(\.m3u8.*)$/; // Matches base, index number, and .m3u8 + query
    const match = src.match(urlPattern);

    if (match) {
      setOriginalSrcBase(match[1]); // e.g., "https://.../index"
      const detectedSuffixPart = match[2]; // e.g., "_4"
      const detectedM3u8AndQueryPart = match[3]; // e.g., ".m3u8?query=param"
      const fullOriginalSuffixAndQuery = detectedSuffixPart + detectedM3u8AndQueryPart;
      setOriginal720pSuffixAndQuery(fullOriginalSuffixAndQuery);

      if (DEFAULT_720P_URL_SUFFIXES.some(s => fullOriginalSuffixAndQuery.startsWith(s))) {
        setCurrentQualityLabel("720p");
      } else if (fullOriginalSuffixAndQuery.startsWith("_2.m3u8")) {
        setCurrentQualityLabel("360p");
      } else if (fullOriginalSuffixAndQuery.startsWith("_1.m3u8")) {
        setCurrentQualityLabel("240p");
      } else {
        setCurrentQualityLabel("720p"); // Fallback if pattern is unexpected
      }
    } else {
      // Fallback for URLs not matching the specific index_X.m3u8 pattern
      // Treat the whole src as the 720p source and try to make base assumptions.
      // This part might need refinement if URLs vary significantly.
      const lastSlash = src.lastIndexOf('/');
      const lastDot = src.lastIndexOf('.m3u8');
      if (lastSlash !== -1 && lastDot > lastSlash) {
        setOriginalSrcBase(src.substring(0, lastDot - (src.substring(lastSlash+1, lastDot).length)));
        setOriginal720pSuffixAndQuery(src.substring(lastDot - (src.substring(lastSlash+1, lastDot).length)));
      } else { // Very basic fallback
        setOriginalSrcBase(src);
        setOriginal720pSuffixAndQuery("");
      }
      setCurrentQualityLabel("720p");
      console.warn("StreamCastPlayer: Initial src URL pattern not fully recognized for quality switching. Defaulting to 720p.");
    }


    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        liveDurationInfinity: true,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoElement);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        if (data.levels.length > 0 && data.levels[0].details && data.levels[0].details.live) {
          setDuration(Infinity);
        }
        setIsLoading(false);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                setError("The live class is not started yet.");
              } else {
                setError("The live class is not started yet.");
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError(`Media error: ${data.details}`);
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
      if (video.duration !== Infinity) {
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
    const handleRateChange = () => setCurrentPlaybackRate(video.playbackRate);


    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ratechange', handleRateChange);


    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
      setShowControls(true); 
      if (!!document.fullscreenElement) {
        hideControlsAfterDelay();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [hideControlsAfterDelay]);
  
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

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(err => console.error("Play error:", err));
    } else {
      videoRef.current.pause();
    }
  }, [videoRef]);

  const handleVolumeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setShowControls(true);
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    if (!videoRef.current.muted && videoRef.current.volume === 0) { 
      videoRef.current.volume = 0.5; 
    }
  }, [videoRef]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || duration === Infinity) return; 
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setShowControls(true);
  };

  const toggleFullScreen = useCallback(() => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => {
          if (screen.orientation && typeof screen.orientation.lock === 'function') {
            screen.orientation.lock('landscape').catch(err => {
              console.warn("Could not lock to landscape orientation:", err);
            });
          }
        })
        .catch(err => {
          console.error("Error attempting to enable full-screen mode:", err);
        });
    } else {
      document.exitFullscreen()
        .then(() => {
          if (screen.orientation && typeof screen.orientation.unlock === 'function') {
            screen.orientation.unlock();
          }
        })
        .catch(err => {
          console.error("Error attempting to exit full-screen mode:", err);
        });
    }
  }, [playerContainerRef]);

  const handleVideoSingleClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !playerContainerRef.current) return;

    const videoRect = videoRef.current.getBoundingClientRect();
    const clickX = event.clientX - videoRect.left;
    const videoWidth = videoRect.width;

    if (clickX >= videoWidth / 3 && clickX <= (videoWidth * 2) / 3) {
      togglePlayPause();
    }
    setShowControls(true);
    hideControlsAfterDelay();
  };
  
  const handleVideoDoubleClick = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !playerContainerRef.current) return;

    const videoRect = videoRef.current.getBoundingClientRect();
    const clickX = event.clientX - videoRect.left;
    const videoWidth = videoRect.width;

    if (clickX < videoWidth / 3) { 
      if (duration !== Infinity) {
        const newTime = Math.max(videoRef.current.currentTime - 5, 0);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    } else if (clickX > (videoWidth * 2) / 3) { 
      if (duration !== Infinity) {
        const newTime = Math.min(videoRef.current.currentTime + 5, duration);
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    } else { 
      // No longer toggle fullscreen on double click middle
    }
    setShowControls(true);
    hideControlsAfterDelay();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    hideControlsAfterDelay();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettingsDialog) { 
      hideControlsAfterDelay();
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleQualitySelect = (selectedQuality: typeof QUALITY_OPTIONS[number]) => {
    if (!hlsRef.current || !originalSrcBase || !original720pSuffixAndQuery || !videoRef.current) return;

    let newSrcUrl = "";
    let newQualityLabel = selectedQuality.label;

    if (selectedQuality.id === '720p') {
      newSrcUrl = originalSrcBase + original720pSuffixAndQuery;
    } else if (selectedQuality.suffix) {
      // Extract query parameters from the original 720p suffix to append them
      const m3u8Marker = ".m3u8";
      const queryParamsStartIndex = original720pSuffixAndQuery.indexOf(m3u8Marker) + m3u8Marker.length;
      const queryParams = original720pSuffixAndQuery.substring(queryParamsStartIndex);
      newSrcUrl = originalSrcBase + selectedQuality.suffix + queryParams;
    } else {
      console.error("Invalid quality selection:", selectedQuality);
      return; 
    }

    // Avoid reloading if the source is already the target source
    // videoRef.current.src can be blob:http... so direct comparison with newSrcUrl might fail.
    // Better to rely on currentQualityLabel or reconstruct current playing URL if possible.
    // For now, we'll assume if labels match, it's the same quality. More robust check might be needed.
    if (currentQualityLabel === newQualityLabel && videoRef.current.src.includes(originalSrcBase + (selectedQuality.id === '720p' ? original720pSuffixAndQuery : selectedQuality.suffix))) {
        // setSettingsView('main'); // Optionally go back to main settings
        return;
    }
    
    setIsLoading(true);
    const currentTimePaused = videoRef.current.currentTime || 0;
    const wasPlaying = !videoRef.current.paused;

    hlsRef.current.loadSource(newSrcUrl);
    hlsRef.current.once(Hls.Events.MANIFEST_PARSED, () => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTimePaused;
        if (wasPlaying) {
          videoRef.current.play().catch(e => console.error("Error re-playing after quality switch", e));
        }
        // setIsLoading(false); // isLoading is also handled by 'playing' and 'canplay' events
      }
    });
    // Also handle native HLS if HLS.js is not used
     if (!Hls.isSupported() && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = newSrcUrl;
        videoRef.current.load(); // Important for native HLS
        const nativeLoadHandler = () => {
            if(videoRef.current) {
                videoRef.current.currentTime = currentTimePaused;
                if(wasPlaying) {
                    videoRef.current.play().catch(e => console.error("Error re-playing after quality switch", e));
                }
            }
            videoRef.current?.removeEventListener('loadedmetadata', nativeLoadHandler);
        }
        videoRef.current.addEventListener('loadedmetadata', nativeLoadHandler);
    }

    setCurrentQualityLabel(newQualityLabel);
    // setSettingsView('main'); // Or keep on quality view
  };


  const handleSettingsDialogOpenChange = (open: boolean) => {
    setShowSettingsDialog(open);
    if (!open) {
      setSettingsView('main'); 
    }
    setShowControls(true); 
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (!open && isPlaying) { 
      hideControlsAfterDelay();
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;

    if (!videoElement) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const targetTagName = (event.target as HTMLElement).tagName;
      if (targetTagName === 'INPUT' || targetTagName === 'TEXTAREA' || (event.target as HTMLElement).isContentEditable) {
        return;
      }

      let requireControlsUpdate = true;

      switch (event.key.toLowerCase()) {
        case 'f':
          toggleFullScreen();
          break;
        case ' ': 
          event.preventDefault(); 
          togglePlayPause();
          break;
        case 'm':
          toggleMute();
          break;
        case 'arrowright':
          if (duration !== Infinity) {
            event.preventDefault();
            const newTime = Math.min(videoElement.currentTime + 5, duration);
            videoElement.currentTime = newTime;
            setCurrentTime(newTime); 
          }
          break;
        case 'arrowleft':
          if (duration !== Infinity) {
            event.preventDefault();
            const newTime = Math.max(videoElement.currentTime - 5, 0);
            videoElement.currentTime = newTime;
            setCurrentTime(newTime); 
          }
          break;
        case 'arrowup':
          event.preventDefault();
          if (videoElement.muted) {
            videoElement.muted = false; 
          }
          let newVolumeUp = videoElement.volume + 0.1;
          if (videoElement.volume === 0 && newVolumeUp <= 0.1) {
            newVolumeUp = 0.1; 
          }
          videoElement.volume = Math.min(newVolumeUp, 1);
          break;
        case 'arrowdown':
          event.preventDefault();
          videoElement.volume = Math.max(videoElement.volume - 0.1, 0);
          break;
        default:
          requireControlsUpdate = false;
          break;
      }

      if (requireControlsUpdate) {
        setShowControls(true);
        hideControlsAfterDelay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlayPause, toggleMute, toggleFullScreen, duration, hideControlsAfterDelay, setCurrentTime, videoRef]);

  const currentSpeedLabel = playbackRates.find(r => r.rate === currentPlaybackRate)?.label || 'Normal';

  return (
    <div
      ref={playerContainerRef}
      className="relative w-full h-full bg-black flex items-center justify-center text-foreground select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-testid="player-container"
    >
      <video 
        ref={videoRef} 
        className="w-full h-full object-contain" 
        onClick={handleVideoSingleClick}
        onDoubleClick={handleVideoDoubleClick}
        playsInline 
        data-testid="video-element"
      />
      <div 
        className="absolute top-2 right-2 text-xs text-white/70 z-[5] pointer-events-none"
        style={{ textShadow: '0px 0px 2px rgba(0,0,0,0.5)' }}
      >
        e-leak.vercel.app
      </div>
      
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20" data-testid="loading-indicator">
          <Loader2 className="h-12 w-12 animate-spin text-[hsl(var(--accent))]" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-destructive-foreground p-4 z-20" data-testid="error-message">
          <AlertTriangle className="h-12 w-12 mb-2 text-destructive" />
          <p className="text-center">{error}</p>
        </div>
      )}

      {!error && (
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 md:p-4 transition-opacity duration-300 ease-in-out z-10 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()} 
          data-testid="controls-overlay"
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
                data-testid="seek-slider"
              />
          )}
         
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={togglePlayPause} className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1" data-testid="play-pause-button">
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <div className="flex items-center group">
                <button onClick={toggleMute} className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1" data-testid="mute-button">
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
                  onChange={handleVolumeInputChange}
                  className="w-0 md:w-20 h-1.5 ml-1 custom-slider accent-[hsl(var(--accent))] opacity-0 group-hover:w-20 group-hover:opacity-100 transition-all duration-300 ease-in-out"
                  data-testid="volume-slider"
                />
              </div>
              <div className="text-xs md:text-sm tabular-nums" data-testid="time-display">
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
              <Dialog open={showSettingsDialog} onOpenChange={handleSettingsDialogOpenChange}>
                  <DialogTrigger asChild>
                    <button 
                      className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1" 
                      title="Playback Settings"
                      onClick={() => setSettingsView('main')}
                      data-testid="settings-button"
                    >
                      <Settings size={20} />
                    </button>
                  </DialogTrigger>
                  <DialogContent 
                    className="w-auto max-w-xs" // Adjusted for potentially smaller content
                    onOpenAutoFocus={(e) => e.preventDefault()} 
                    portalContainer={playerContainerRef.current} // Portal into player for fullscreen
                  >
                    {settingsView === 'main' && (
                      <>
                        <DialogHeader>
                          <DialogTitle>Settings</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-2 pt-2">
                          <Button variant="ghost" onClick={() => setSettingsView('quality')} className="w-full justify-between">
                            <span>Quality</span>
                            <span className="text-muted-foreground">{currentQualityLabel}</span>
                          </Button>
                          <Button variant="ghost" onClick={() => setSettingsView('speed')} className="w-full justify-between">
                            <span>Speed</span>
                            <span className="text-muted-foreground">{currentSpeedLabel}</span>
                          </Button>
                        </div>
                      </>
                    )}
                    {settingsView === 'quality' && (
                      <>
                        <DialogHeader className="relative flex items-center justify-center">
                          <Button variant="ghost" size="icon" className="absolute left-0" onClick={() => setSettingsView('main')}>
                            <ArrowLeft size={18} />
                          </Button>
                          <DialogTitle>Video Quality</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1 pt-2 max-h-60 overflow-y-auto">
                          {QUALITY_OPTIONS.map((quality) => (
                            <Button
                              key={quality.id}
                              variant={currentQualityLabel === quality.label ? "secondary" : "ghost"}
                              size="sm"
                              className="w-full justify-start data-[active=true]:bg-[hsl(var(--accent))] data-[active=true]:text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                              onClick={() => handleQualitySelect(quality)}
                              data-active={currentQualityLabel === quality.label}
                            >
                              {currentQualityLabel === quality.label && <CheckIcon size={16} className="mr-2" />}
                              {quality.label}
                            </Button>
                          ))}
                        </div>
                      </>
                    )}
                    {settingsView === 'speed' && (
                      <>
                        <DialogHeader className="relative flex items-center justify-center">
                           <Button variant="ghost" size="icon" className="absolute left-0" onClick={() => setSettingsView('main')}>
                            <ArrowLeft size={18} />
                          </Button>
                          <DialogTitle>Playback Speed</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1 pt-2">
                          {playbackRates.map((speed) => (
                            <Button
                              key={speed.rate}
                              variant={currentPlaybackRate === speed.rate ? "secondary" : "ghost"}
                              size="sm"
                              className="w-full justify-start data-[active=true]:bg-[hsl(var(--accent))] data-[active=true]:text-[hsl(var(--accent-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                              onClick={() => handlePlaybackRateChange(speed.rate)}
                              data-active={currentPlaybackRate === speed.rate}
                            >
                              {currentPlaybackRate === speed.rate && <CheckIcon size={16} className="mr-2" />}
                              {speed.label}
                            </Button>
                          ))}
                        </div>
                      </>
                    )}
                  </DialogContent>
                </Dialog>
              <button onClick={toggleFullScreen} className="text-foreground hover:text-[hsl(var(--accent))] transition-colors p-1" data-testid="fullscreen-button">
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

