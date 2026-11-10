import React from 'react';
import { 
  Plug,
  HardDrive, 
  Terminal,
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
  onStartBridge: () => void;
  onStopBridge: () => void;
  onOpenBridgeModal: () => void;
  onToggleConsole: () => void;
  isConsoleOpen: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  cursorPos,
  selectionLength,
  extensionStatus,
  handshakeInfo,
  statusNotification,
  onStartBridge,
  onStopBridge,
  onOpenBridgeModal,
  onToggleConsole,
  isConsoleOpen,
}) => {
  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';

  return (
    <footer className="h-6 bg-[#18181b] border-t border-zinc-800 flex items-center justify-between px-3 text-[11px] select-none text-zinc-400 font-mono z-20">
      {/* Left: Extension status & manual toggle */}
      <div className="flex items-center gap-3">
        {/* Extension Bridge Manual Toggle */}
        <div className="flex items-center gap-1.5">
          {extensionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Clockie Connected</span>
              <button
                onClick={onStopBridge}
                className="hover:text-red-300 text-[10px] text-zinc-400 underline ml-0.5 cursor-pointer"
                title="Stop Extension Bridge"
              >
                [Stop]
              </button>
            </div>
          ) : extensionStatus === 'connecting' ? (
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>Connecting...</span>
              <button
                onClick={onStopBridge}
                className="hover:text-white text-[10px] underline ml-0.5 cursor-pointer"
                title="Cancel connecting"
              >
                [Cancel]
              </button>
            </div>
          ) : (
            <button
              onClick={onStartBridge}
              className="flex items-center gap-1 text-zinc-400 hover:text-emerald-300 transition cursor-pointer"
              title="Click to start Clockie McClockface Extension bridge"
            >
              <Plug className="w-3 h-3 text-zinc-400" />
              <span>Bridge: Stopped (Click to Start)</span>
            </button>
          )}

          <button
            onClick={onOpenBridgeModal}
            className="text-zinc-500 hover:text-zinc-300 text-[10px] ml-1"
            title="Inspect Extension Bridge Protocol"
          >
            [Logs]
          </button>
        </div>

        {/* Toggle Output Console */}
        <button
          onClick={onToggleConsole}
          className={`flex items-center gap-1 px-1.5 py-0.2 rounded text-[10.5px] transition ${
            isConsoleOpen ? 'bg-zinc-800 text-emerald-400' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Output Terminal Console"
        >
          <Terminal className="w-3 h-3" />
          <span>Terminal</span>
        </button>

        {/* Status notification toast */}
        {statusNotification && (
          <div className="hidden md:flex items-center gap-1 text-zinc-300 bg-zinc-800/80 px-2 py-0.2 rounded border border-zinc-700/60">
            <Bell className="w-2.5 h-2.5 text-emerald-400" />
            <span className="truncate max-w-[240px]">{statusNotification}</span>
          </div>
        )}

        {/* Active Cloud Provider */}
        {activeFile && (
          <div className="hidden lg:flex items-center gap-1 text-zinc-400">
            <HardDrive className="w-2.5 h-2.5 text-emerald-400" />
            <span>{activeFile.cloudProvider}</span>
          </div>
        )}
      </div>

      {/* Right: Editor metrics */}
      <div className="flex items-center gap-4">
        {/* Cursor Position */}
        <div className="text-zinc-300">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          {selectionLength > 0 && (
            <span className="text-zinc-500 ml-1">({selectionLength} sel)</span>
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
      </div>
    </footer>
  );
};
