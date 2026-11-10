import React, { useState, useRef, useEffect } from 'react';
import { CloudFile } from '../types/ide';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RotateCcw, 
  Download, 
  Grid, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Film,
  Image as ImageIcon,
  Code
} from 'lucide-react';
import { getFileExtension } from '../utils/fileSystem';

interface MediaViewerProps {
  file: CloudFile;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ file }) => {
  const ext = getFileExtension(file.name);
  const isSvg = ext === 'svg';
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(ext);

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

  // Reset zoom on file change
  useEffect(() => {
    setZoom(1);
    setShowSvgCode(false);
    setIsPlaying(false);
  }, [file.id]);

  // If this is a demo video file with no external URL, render an interactive animated visual test pattern to canvas
  useEffect(() => {
    if (isVideo && !file.binaryUrl && canvasRef.current) {
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

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        // Grid
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

        // Radar circle
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 80 + Math.sin(t) * 10, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating beam
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(
          w / 2 + Math.cos(t * 1.5) * 120,
          h / 2 + Math.sin(t * 1.5) * 120
        );
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FreshFood Rocks Stream Telemetry', w / 2, h / 2 - 110);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '14px monospace';
        ctx.fillText(`Stream Telemetry Active | FPS: 60`, w / 2, h / 2 + 120);

        // Only update React state every 500ms instead of 60 times a second
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
        // Draw paused frame
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
  }, [isVideo, file.binaryUrl, file.name, isPlaying, duration]);

  // Construct image source data URL
  const getImageSource = () => {
    if (file.binaryUrl) return file.binaryUrl;
    if (isSvg) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(file.content)}`;
    }
    return '';
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = file.name;
    if (isSvg) {
      link.href = `data:image/svg+xml;utf8,${encodeURIComponent(file.content)}`;
    } else if (file.binaryUrl) {
      link.href = file.binaryUrl;
    }
    link.click();
  };

  // Video File Rendering
  if (isVideo) {
    return (
      <div className="h-full w-full flex flex-col bg-[#141416] select-none">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">{file.name}</span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] uppercase font-mono text-emerald-400">
              {ext}
            </span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span>Provider: <strong className="text-zinc-200">{file.cloudProvider}</strong></span>
          </div>
        </div>

        {/* Player Container */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[#0c0c0e]">
          <div className="relative max-w-3xl w-full rounded-xl overflow-hidden border border-zinc-800 shadow-2xl bg-black">
            {file.binaryUrl ? (
              <video
                ref={videoRef}
                src={file.binaryUrl}
                className="w-full aspect-video object-contain"
                onTimeUpdate={() => {
                  if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) setDuration(videoRef.current.duration);
                }}
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
                  onClick={() => setIsPlaying(!isPlaying)}
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
                  max={duration}
                  step={0.1}
                  value={currentTime}
                  onChange={e => setCurrentTime(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-750 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition"
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

  // Image File Rendering
  return (
    <div className="h-full w-full flex flex-col bg-[#141416] select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-300">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white">{file.name}</span>
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] uppercase font-mono text-emerald-400">
            {ext}
          </span>
          {imgDimensions && (
            <span className="text-zinc-500 font-mono text-[11px]">
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
                showSvgCode ? 'bg-emerald-600 text-black font-semibold' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showSvgCode ? 'Preview' : 'View SVG Code'}</span>
            </button>
          )}

          <div className="h-4 w-px bg-zinc-750 mx-1" />

          <button
            onClick={() => setZoom(z => Math.max(0.2, z - 0.2))}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] text-zinc-400 min-w-[45px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(4, z + 0.2))}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1.5 rounded transition ${showGrid ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800'}`}
            title="Toggle Transparency Checkerboard"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-300 transition"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Area or SVG Code */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-8 bg-[#0a0a0c]">
        {showSvgCode ? (
          <div className="w-full h-full p-4 overflow-auto">
            <pre className="text-xs font-mono text-emerald-300 bg-zinc-950 p-6 rounded-xl border border-zinc-800 leading-relaxed select-text">
              <code>{file.content}</code>
            </pre>
          </div>
        ) : (
          <div
            className={`relative rounded-xl border border-zinc-800/80 p-6 transition-all duration-200 flex items-center justify-center shadow-2xl ${
              showGrid
                ? 'bg-[linear-gradient(45deg,#1f1f23_25%,transparent_25%),linear-gradient(-45deg,#1f1f23_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f1f23_75%),linear-gradient(-45deg,transparent_75%,#1f1f23_75%)] bg-[size:20px_20px] bg-[#141416]'
                : 'bg-zinc-900/60'
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
