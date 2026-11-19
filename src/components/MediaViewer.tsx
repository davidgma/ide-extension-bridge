/**
 * Media, PDF, Audio, and Binary File Viewer for Monarch IDE.
 * Handles:
 * - PDF documents via Chrome's built-in PDFium viewer (Blob URL inside an iframe)
 * - Audio files via native HTML5 <audio> controls backed by Blob object URLs
 * - Video files via <video> playback controls (and canvas fallback for URL-less samples)
 * - Images (raster + SVG with preview/source toggle, zoom, and transparency checkerboard)
 * - Safe read-only fallback card for non-text binary files (archives, Office docs, binaries)
 *
 * Official Documentation:
 * - URL.createObjectURL: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
 * - HTMLMediaElement (<audio>/<video>): https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement
 * - Blob API: https://developer.mozilla.org/en-US/docs/Web/API/Blob
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CloudFile } from '../types/ide';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Grid,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Film,
  Image as ImageIcon,
  Code,
  FileText,
  Music,
  FileArchive,
  RotateCw,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import {
  getFileExtension,
  inferMimeType,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isPdfFile,
  base64ToBlob,
  formatFileSize,
} from '../utils/fileSystem';

interface MediaViewerProps {
  file: CloudFile;
  /** Optional handler to re-fetch a file from Clockie H2 explicitly requesting base64 */
  onRetryBase64?: () => void;
  /** Allows opening an unrecognized file as raw UTF-8 text if binary detection was only heuristic */
  canForceTextOpen?: boolean;
  onForceTextOpen?: () => void;
}

/**
 * Resolves a Blob from a CloudFile's binaryUrl or content payload so object URLs stay valid
 * for Chrome's PDF viewer, <audio>, <video>, and browser downloads.
 */
function buildFileBlob(file: CloudFile, fallbackMime: string): Blob | null {
  const mime = fallbackMime || file.mimeType || inferMimeType(file.name) || 'application/octet-stream';

  if (file.binaryUrl) {
    if (file.binaryUrl.startsWith('data:')) {
      const fromDataUrl = base64ToBlob(file.binaryUrl, mime);
      if (fromDataUrl) return fromDataUrl;
    }
  }

  if (file.content) {
    if (file.encoding === 'base64' || file.isBinary || file.content.startsWith('data:')) {
      const fromBase64 = base64ToBlob(file.content, mime);
      if (fromBase64) return fromBase64;
    }

    // Fallback for raw %PDF- payloads if extension returned unencoded bytes as string
    if (isPdfFile(file.name, mime) && file.content.startsWith('%PDF-')) {
      const bytes = new Uint8Array(file.content.length);
      for (let i = 0; i < file.content.length; i++) {
        bytes[i] = file.content.charCodeAt(i) & 0xff;
      }
      return new Blob([bytes], { type: 'application/pdf' });
    }

    return new Blob([file.content], { type: mime });
  }

  return null;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({
  file,
  onRetryBase64,
  canForceTextOpen = false,
  onForceTextOpen,
}) => {
  const ext = getFileExtension(file.name);
  const resolvedMime = file.mimeType || inferMimeType(file.name);
  const isPdf = isPdfFile(file.name, resolvedMime);
  const isAudio = isAudioFile(file.name, resolvedMime);
  const isVideo = isVideoFile(file.name);
  const isImg = isImageFile(file.name);
  const isSvg = ext === 'svg';
  const isGenericBinary = !isPdf && !isAudio && !isVideo && !isImg;
  const formattedSize = formatFileSize(file.size);

  // Image controls state
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showSvgCode, setShowSvgCode] = useState(false);
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);

  // Video controls state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(12.5);

  // Manage Blob Object URL lifecycle cleanly for PDF, Audio, and Video playback
  const mediaBlob = useMemo(() => {
    if (!isPdf && !isAudio && !isVideo) return null;
    if (file.binaryUrl && !file.binaryUrl.startsWith('data:')) {
      return null;
    }
    return buildFileBlob(file, resolvedMime);
  }, [isPdf, isAudio, isVideo, file, resolvedMime]);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaBlob) {
      setObjectUrl(null);
      return;
    }
    const createdUrl = URL.createObjectURL(mediaBlob);
    setObjectUrl(createdUrl);
    return () => {
      URL.revokeObjectURL(createdUrl);
    };
  }, [mediaBlob]);

  const effectiveMediaUrl =
    objectUrl || (file.binaryUrl && !file.binaryUrl.startsWith('data:') ? file.binaryUrl : null);

  // Reset per-file viewer state when switching tabs
  useEffect(() => {
    setZoom(1);
    setShowSvgCode(false);
    setImgDimensions(null);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [file.id]);

  // Keep native <video> element synchronized with React playback controls
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = playbackRate;
  }, [playbackRate]);

  const handleToggleVideoPlay = () => {
    const vid = videoRef.current;
    if (vid && effectiveMediaUrl) {
      if (vid.paused) {
        vid.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } else {
        vid.pause();
        setIsPlaying(false);
      }
      return;
    }
    setIsPlaying(prev => !prev);
  };

  // Demo canvas animation when inspecting a sample video file without a streamable binaryUrl
  useEffect(() => {
    if (isVideo && !effectiveMediaUrl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let animationFrameId: number;
      let frame = 0;
      let lastStateUpdate = performance.now();

      const renderCanvas = () => {
        if (!isPlaying) return;
        frame++;
        const t = frame * 0.03;
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 80 + Math.sin(t) * 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(w / 2 + Math.cos(t * 1.5) * 120, h / 2 + Math.sin(t * 1.5) * 120);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FreshFood Rocks Stream Telemetry', w / 2, h / 2 - 110);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '14px monospace';
        ctx.fillText('Stream Telemetry Active | FPS: 60', w / 2, h / 2 + 120);

        const now = performance.now();
        if (now - lastStateUpdate > 500) {
          lastStateUpdate = now;
          setCurrentTime(c => (c >= duration ? 0 : c + 0.5));
        }

        animationFrameId = requestAnimationFrame(renderCanvas);
      };

      if (isPlaying) {
        animationFrameId = requestAnimationFrame(renderCanvas);
      } else {
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#34d399';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[ ${file.name} - Ready for Playback ]`, w / 2, h / 2 - 10);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText('Click Play button below to stream video', w / 2, h / 2 + 20);
      }

      return () => {
        cancelAnimationFrame(animationFrameId);
      };
    }
  }, [isVideo, effectiveMediaUrl, file.name, isPlaying, duration]);

  const getImageSource = () => {
    if (file.binaryUrl) return file.binaryUrl;
    if (isSvg) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(file.content)}`;
    }
    if (file.content && (file.encoding === 'base64' || file.isBinary)) {
      return `data:${resolvedMime || 'image/png'};base64,${file.content}`;
    }
    return '';
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = file.name;

    if (isSvg) {
      const svgBlob = new Blob([file.content], { type: 'image/svg+xml;charset=utf-8' });
      const tempUrl = URL.createObjectURL(svgBlob);
      link.href = tempUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
      return;
    }

    const blob = mediaBlob || buildFileBlob(file, resolvedMime);
    if (blob) {
      const tempUrl = URL.createObjectURL(blob);
      link.href = tempUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(tempUrl), 1000);
      return;
    }

    if (file.binaryUrl) {
      link.href = file.binaryUrl;
      link.click();
    }
  };

  // 1. PDF Document Rendering (Chrome built-in viewer via Blob URL iframe)
  if (isPdf) {
    const hasDecodablePdf = Boolean(effectiveMediaUrl);
    return (
      <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#141416] select-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white truncate">{file.name}</span>
            <span className="px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/30 text-[10px] font-mono text-red-700 dark:text-red-300 shrink-0">
              pdf
            </span>
            {formattedSize && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 shrink-0">
                ({formattedSize})
              </span>
            )}
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10.5px] text-slate-600 dark:text-zinc-400 shrink-0">
              <Lock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              Read-only viewer
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline text-slate-500 dark:text-zinc-400">
              Provider: <strong className="text-slate-900 dark:text-zinc-200">{file.cloudProvider}</strong>
            </span>
            {onRetryBase64 && (
              <button
                type="button"
                onClick={onRetryBase64}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition"
                title="Re-fetch PDF from bridge using Base64 encoding"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Reload</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Built-in Chrome PDFium Iframe */}
        <div className="flex-1 min-h-0 bg-slate-200 dark:bg-[#0c0c0e]">
          {hasDecodablePdf ? (
            <iframe
              key={effectiveMediaUrl}
              src={effectiveMediaUrl!}
              title={file.name}
              className="w-full h-full border-0 bg-white dark:bg-zinc-900"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Unable to render PDF document
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-md">
                No valid PDF binary stream was received. Try reloading the file as Base64 or downloading it directly.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {onRetryBase64 && (
                  <button
                    type="button"
                    onClick={onRetryBase64}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Reload as Base64</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Audio Player Rendering
  if (isAudio) {
    return (
      <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#141416] select-auto">
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Music className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white truncate">{file.name}</span>
            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 text-[10px] font-mono text-blue-700 dark:text-blue-300 shrink-0">
              {ext || 'audio'}
            </span>
            {formattedSize && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 shrink-0">
                ({formattedSize})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-slate-500 dark:text-zinc-400">
              Provider: <strong className="text-slate-900 dark:text-zinc-200">{file.cloudProvider}</strong>
            </span>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition"
              title="Download Audio File"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 bg-slate-100 dark:bg-[#0c0c0e]">
          <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl p-6 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shrink-0">
                <Music className="w-7 h-7 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {file.name}
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                  {file.path}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-2">
                  <span>{resolvedMime}</span>
                  {formattedSize && <span>• {formattedSize}</span>}
                </div>
              </div>
            </div>

            {effectiveMediaUrl ? (
              <audio
                key={effectiveMediaUrl}
                controls
                src={effectiveMediaUrl}
                className="w-full"
              />
            ) : (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
                <span>No playable audio data loaded.</span>
                {onRetryBase64 && (
                  <button
                    type="button"
                    onClick={onRetryBase64}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0"
                  >
                    Reload Base64
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Video File Rendering
  if (isVideo) {
    return (
      <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#141416] select-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-slate-900 dark:text-white">{file.name}</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] normal-case font-mono text-emerald-700 dark:text-emerald-400">
              {ext}
            </span>
            {formattedSize && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                ({formattedSize})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
            <span>
              Provider: <strong className="text-slate-900 dark:text-zinc-200">{file.cloudProvider}</strong>
            </span>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition"
              title="Download Video"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Player Container */}
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-100 dark:bg-[#0c0c0e]">
          <div className="relative max-w-3xl w-full rounded-xl overflow-hidden border border-slate-300 dark:border-zinc-800 shadow-2xl bg-black">
            {effectiveMediaUrl ? (
              <video
                ref={videoRef}
                key={effectiveMediaUrl}
                src={effectiveMediaUrl}
                className="w-full aspect-video object-contain"
                onClick={handleToggleVideoPlay}
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
                    setDuration(videoRef.current.duration);
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <canvas
                ref={canvasRef}
                width={800}
                height={450}
                className="w-full aspect-video object-contain"
              />
            )}

            {/* Video Controls Overlay */}
            <div className="p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleVideoPlay}
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-semibold transition"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-black" />}
                </button>
                <div className="font-mono text-xs text-zinc-300">
                  {Math.floor(currentTime)}s / {Math.floor(duration)}s
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex-1 mx-4">
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={e => {
                    const nextTime = parseFloat(e.target.value);
                    setCurrentTime(nextTime);
                    if (videoRef.current) {
                      videoRef.current.currentTime = nextTime;
                    }
                  }}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-750 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <select
                  value={playbackRate}
                  onChange={e => setPlaybackRate(parseFloat(e.target.value))}
                  className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Generic Binary File Fallback Rendering
  if (isGenericBinary) {
    return (
      <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#141416] select-auto">
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileArchive className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-white truncate">{file.name}</span>
            {ext && (
              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono text-blue-700 dark:text-blue-400 shrink-0">
                {ext}
              </span>
            )}
            {formattedSize && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 shrink-0">
                ({formattedSize})
              </span>
            )}
          </div>
          <div className="text-slate-500 dark:text-zinc-400 shrink-0">
            Provider: <strong className="text-slate-900 dark:text-zinc-200">{file.cloudProvider}</strong>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 bg-slate-100 dark:bg-[#0c0c0e]">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl p-6 text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center">
              <FileArchive className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white break-all">
                {file.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                This file appears to be binary ({resolvedMime}) and cannot be displayed in the text editor.
              </p>
              {formattedSize && (
                <p className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                  Size: {formattedSize}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>

              {canForceTextOpen && onForceTextOpen && (
                <button
                  type="button"
                  onClick={onForceTextOpen}
                  className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Open as Text Anyway</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Image File Rendering
  return (
    <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#141416] select-auto">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-slate-900 dark:text-white">{file.name}</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
            {ext}
          </span>
          {imgDimensions && (
            <span className="text-slate-500 dark:text-zinc-500 font-mono text-[11px]">
              ({imgDimensions.width} × {imgDimensions.height}px)
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {isSvg && (
            <button
              onClick={() => setShowSvgCode(!showSvgCode)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded transition text-xs ${
                showSvgCode
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showSvgCode ? 'Preview' : 'View SVG Code'}</span>
            </button>
          )}

          <div className="h-4 w-px bg-slate-300 dark:bg-zinc-700 mx-1" />

          <button
            onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400 min-w-[45px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(4, z + 0.2))}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition ${
              showGrid
                ? 'bg-slate-200 dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
            title="Toggle Transparency Checkerboard"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-600 dark:text-zinc-300 transition"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Area or SVG Code */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-8 bg-slate-100 dark:bg-[#0a0a0c]">
        {showSvgCode ? (
          <div className="w-full h-full p-4 overflow-auto">
            <pre className="text-xs font-mono text-emerald-700 dark:text-emerald-300 bg-white dark:bg-zinc-950 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 leading-relaxed select-text">
              <code>{file.content}</code>
            </pre>
          </div>
        ) : (
          <div
            className={`relative rounded-xl border border-slate-300 dark:border-zinc-800/80 p-6 transition-all duration-200 flex items-center justify-center shadow-xl ${
              showGrid
                ? 'bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] dark:bg-[linear-gradient(45deg,#1f1f23_25%,transparent_25%),linear-gradient(-45deg,#1f1f23_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f23_75%),linear-gradient(-45deg,transparent_75%,#1f1f23_75%)] bg-[size:20px_20px] bg-white dark:bg-[#141416]'
                : 'bg-white dark:bg-zinc-900/60'
            }`}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {isSvg ? (
              <div
                dangerouslySetInnerHTML={{ __html: file.content }}
                className="max-w-[650px] max-h-[480px] drop-shadow-lg"
              />
            ) : (
              <img
                src={getImageSource()}
                alt={file.name}
                onLoad={e => {
                  const target = e.currentTarget;
                  setImgDimensions({ width: target.naturalWidth, height: target.naturalHeight });
                }}
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
