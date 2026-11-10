import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Clock, 
  Check, 
  AlertCircle, 
  HardDrive, 
  Zap, 
  Terminal,
  RotateCw,
  Bell
} from 'lucide-react';
import { CloudFile, ExtensionStatus, ExtensionHandshakeInfo } from '../types/ide';
import { getMonacoLanguage } from '../utils/fileSystem';

interface StatusBarProps {
  activeFile: CloudFile | null;
  cursorPos: { line: number; col: number };
  selectionLength: number;
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  isSaving: boolean;
  statusNotification: string | null;
  onOpenBridgeModal: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  cursorPos,
  selectionLength,
  extensionStatus,
  handshakeInfo,
  isSaving,
  statusNotification,
  onOpenBridgeModal,
}) => {
  // Clockie McClockface dynamic clock
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';

  return (
    <footer className="h-6 bg-[#18181b] border-t border-zinc-800 flex items-center justify-between px-3 text-[11px] select-none text-zinc-400 font-mono z-20">
      {/* Left: Extension status & active notifications */}
      <div className="flex items-center gap-3">
        {/* Extension Bridge Pill */}
        <button
          onClick={onOpenBridgeModal}
          className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
          title="Clockie McClockface Chrome Extension Status"
        >
          {extensionStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-medium">Clockie McClockface Bridge</span>
              {handshakeInfo?.latencyMs && (
                <span className="text-zinc-500 text-[10px]">({handshakeInfo.latencyMs}ms)</span>
              )}
            </>
          ) : extensionStatus === 'connecting' ? (
            <>
              <RotateCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
              <span className="text-amber-400">Connecting...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-400">Standalone</span>
            </>
          )}
        </button>

        {/* Status notification toast */}
        {statusNotification && (
          <div className="flex items-center gap-1 text-zinc-300 bg-zinc-800/80 px-2 py-0.2 rounded border border-zinc-700/60 animate-fadeIn">
            <Bell className="w-2.5 h-2.5 text-emerald-400" />
            <span className="truncate max-w-[280px]">{statusNotification}</span>
          </div>
        )}

        {/* Active Cloud Provider */}
        {activeFile && (
          <div className="hidden sm:flex items-center gap-1 text-zinc-400">
            <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
            <span>{activeFile.cloudProvider}</span>
          </div>
        )}
      </div>

      {/* Right: Editor metrics & Clockie McClockface clock */}
      <div className="flex items-center gap-4">
        {/* Cursor Position */}
        <div className="text-zinc-300">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          {selectionLength > 0 && (
            <span className="text-zinc-500 ml-1">({selectionLength} selected)</span>
          )}
        </div>

        {/* Indentation */}
        <div className="hidden sm:block text-zinc-400">
          Spaces: 2
        </div>

        {/* Encoding */}
        <div className="hidden sm:block text-zinc-400">
          UTF-8
        </div>

        {/* Language */}
        <div className="capitalize text-emerald-400 font-medium bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
          {language}
        </div>

        {/* Clockie McClockface Live Clock */}
        <div
          onClick={onOpenBridgeModal}
          className="flex items-center gap-1 text-zinc-200 hover:text-emerald-400 cursor-pointer transition bg-zinc-900 px-2 py-0.2 rounded border border-zinc-800/90"
          title="Clockie McClockface Sync Timestamp"
        >
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>{currentTime}</span>
        </div>
      </div>
    </footer>
  );
};
