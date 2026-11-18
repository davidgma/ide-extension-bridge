/**
 * Bottom IDE Status Bar.
 * Displays H2_CLOUD_BRIDGE v1.3 connection state, session mode (launched/direct),
 * accessMode badge (readwrite/readonly), debugger/terminal toggles, toast notifications,
 * cursor position, and active language badge.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React from 'react';
import {
  Plug,
  HardDrive,
  Terminal,
  Bell,
  Bug,
  Lock,
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
  isReadOnly: boolean;
  statusNotification: string | null;
  onStartBridge: () => void;
  onStopBridge: () => void;
  onOpenBridgeModal: () => void;
  onToggleConsole: () => void;
  isConsoleOpen: boolean;
  onToggleDebugger: () => void;
  isDebuggerOpen: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  cursorPos,
  selectionLength,
  extensionStatus,
  handshakeInfo,
  isReadOnly,
  statusNotification,
  onStartBridge,
  onStopBridge,
  onOpenBridgeModal,
  onToggleConsole,
  isConsoleOpen,
  onToggleDebugger,
  isDebuggerOpen,
}) => {
  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';

  return (
    <footer className="h-6 bg-[#18181b] border-t border-zinc-800 flex items-center justify-between px-3 text-[11px] select-auto text-zinc-400 font-mono z-20">
      {/* Left: Extension status & controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {extensionStatus === 'connected' ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>
                H2 v1.3 {handshakeInfo?.sessionMode || 'connected'}
                {handshakeInfo?.provider ? ` (${handshakeInfo.provider})` : ''}
              </span>
              {isReadOnly && (
                <span className="flex items-center gap-0.5 text-red-300 px-1 rounded bg-red-950/60 border border-red-500/30 text-[10px]">
                  <Lock className="w-2.5 h-2.5" />
                  read-only
                </span>
              )}
              <button
                onClick={onStopBridge}
                className="hover:text-red-300 text-[10px] text-zinc-400 underline ml-0.5 cursor-pointer"
                title="Disconnect H2 Extension Bridge (H2_DISCONNECT_REQ)"
              >
                [Stop]
              </button>
            </div>
          ) : extensionStatus === 'connecting' ? (
            <div className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse" />
              <span>Connecting H2 v1.3...</span>
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
              title="Connect H2_CLOUD_BRIDGE v1.3"
            >
              <Plug className="w-3 h-3 text-zinc-400" />
              <span>H2 Bridge: Disconnected</span>
            </button>
          )}

          <button
            onClick={onOpenBridgeModal}
            className="text-zinc-500 hover:text-blue-300 text-[10px] ml-1"
            title="Inspect H2_CLOUD_BRIDGE v1.3 Protocol & Session"
          >
            [Protocol v1.3]
          </button>
        </div>

        {/* Toggle Debugger Drawer */}
        <button
          onClick={onToggleDebugger}
          className={`flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[10.5px] transition ${
            isDebuggerOpen
              ? 'bg-emerald-600 text-white shadow'
              : 'bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-500/30'
          }`}
          title="Toggle Extension Communication Debug Log Drawer"
        >
          <Bug className="w-3 h-3" />
          <span>Bridge Debugger</span>
        </button>

        {/* Toggle Output Console */}
        <button
          onClick={onToggleConsole}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] transition ${
            isConsoleOpen ? 'bg-zinc-800 text-blue-400' : 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Toggle Output Terminal Console"
        >
          <Terminal className="w-3 h-3" />
          <span>Terminal</span>
        </button>

        {/* Status notification toast */}
        {statusNotification && (
          <div className="hidden md:flex items-center gap-1 text-zinc-200 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700/60">
            <Bell className="w-2.5 h-2.5 text-blue-400" />
            <span className="truncate max-w-[260px]">{statusNotification}</span>
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
        <div className="text-zinc-300">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          {selectionLength > 0 && (
            <span className="text-zinc-500 ml-1">({selectionLength} sel)</span>
          )}
        </div>

        <div className="hidden sm:block text-zinc-400">Spaces: 2</div>
        <div className="hidden sm:block text-zinc-400">
          {activeFile?.encoding === 'base64' ? 'Base64' : 'UTF-8'}
        </div>

        <div className="capitalize text-emerald-400 font-medium bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
          {language}
        </div>
      </div>
    </footer>
  );
};
