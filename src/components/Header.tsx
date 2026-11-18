/**
 * Top IDE Header & Action Toolbar.
 * Displays brand identity, H2_CLOUD_BRIDGE v1.2 connection controls (Direct & Launched modes),
 * read-only capability state, active file metadata, and Save / Run / Search actions.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React from 'react';
import {
  Cloud,
  Save,
  Search,
  HelpCircle,
  FileSearch,
  ExternalLink,
  ChevronDown,
  HardDrive,
  Check,
  RotateCw,
  Play,
  Plug,
  Radio,
  Lock,
} from 'lucide-react';
import { CloudFile, EditorTheme, ExtensionStatus, ExtensionHandshakeInfo } from '../types/ide';

interface HeaderProps {
  activeFile: CloudFile | null;
  files: CloudFile[];
  sessionId: string | null;
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  isSaving: boolean;
  isReadOnly: boolean;
  canSave: boolean;
  activeTheme: EditorTheme;
  wordWrap: boolean;
  minimap: boolean;
  lineCount: number;
  charCount: number;
  isRunningCode: boolean;
  onThemeChange: (theme: EditorTheme) => void;
  onToggleWordWrap: () => void;
  onToggleMinimap: () => void;
  onSaveCurrent: () => void;
  onSaveAll: () => void;
  onStartBridge: () => void;
  onStopBridge: () => void;
  onRunCode: () => void;
  onOpenQuickOpen: () => void;
  onOpenSearch: () => void;
  onOpenBridgeModal: () => void;
  onOpenShortcutsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeFile,
  files,
  sessionId,
  extensionStatus,
  handshakeInfo,
  isSaving,
  isReadOnly,
  canSave,
  activeTheme,
  lineCount,
  charCount,
  isRunningCode,
  onThemeChange,
  onSaveCurrent,
  onSaveAll,
  onStartBridge,
  onStopBridge,
  onRunCode,
  onOpenQuickOpen,
  onOpenSearch,
  onOpenBridgeModal,
  onOpenShortcutsModal,
}) => {
  const nonDirFiles = files.filter(f => !f.isDirectory);
  const dirtyFilesCount = nonDirFiles.filter(f => f.isDirty).length;
  const isCurrentDirty = activeFile?.isDirty;
  const providerLabel = handshakeInfo?.provider || 'cloud';
  const modeLabel = handshakeInfo?.sessionMode || (sessionId ? 'launched' : 'direct');

  return (
    <header className="h-12 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between px-3 text-xs select-auto shadow-md z-30">
      {/* Left Brand & Extension Bridge Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={onOpenBridgeModal}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-white text-sm">
              <span>FreshFood</span>
              <span className="text-emerald-400">.rocks</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-500/30 rounded font-normal">
                Monarch IDE v1.2
              </span>
            </div>
          </div>
        </div>

        {/* Production Domain Link */}
        <a
          href="https://ide.freshfood.rocks"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-300 border border-zinc-800 text-[11px] font-mono transition"
          title="Target Domain: ide.freshfood.rocks"
        >
          <span>ide.freshfood.rocks</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        <div className="h-4 w-px bg-zinc-800 hidden md:block" />

        {/* H2 Bridge Connection Controls */}
        <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-full p-0.5">
          {extensionStatus === 'connected' ? (
            <div className="flex items-center gap-2 pl-2.5 pr-1 py-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-300 font-medium text-[11px] hidden sm:inline">
                H2 v1.2 {modeLabel} ({providerLabel})
              </span>
              {isReadOnly && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-700/60 text-[10px]">
                  <Lock className="w-2.5 h-2.5" />
                  Read-Only
                </span>
              )}
              <button
                onClick={onStopBridge}
                className="px-2 py-0.5 rounded-full bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 text-[10px] font-semibold transition"
                title="Send H2_DISCONNECT_REQ and disconnect"
              >
                Disconnect
              </button>
            </div>
          ) : extensionStatus === 'connecting' ? (
            <div className="flex items-center gap-2 pl-2.5 pr-1 py-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 font-medium text-[11px]">
                Connecting...
              </span>
              <button
                onClick={onStopBridge}
                className="px-2 py-0.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] transition"
                title="Cancel connecting"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onStartBridge}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition"
              title={
                sessionId
                  ? `Reconnect launched session ${sessionId}`
                  : 'Connect directly to Clockie H2 Extension (H2_CONNECT_REQ)'
              }
            >
              <Plug className="w-3.5 h-3.5 text-emerald-400" />
              <span>Connect H2 Bridge</span>
            </button>
          )}

          <button
            onClick={onOpenBridgeModal}
            className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition mr-0.5"
            title="Extension Bridge Inspector & Protocol v1.2"
          >
            <Radio className="w-3 h-3 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Middle Active File Metadata */}
      <div className="hidden xl:flex items-center gap-3 text-zinc-400 text-xs font-mono">
        {activeFile ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/60 border border-zinc-800 rounded-lg">
            <span className="text-white font-medium">{activeFile.name}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 text-[11px] flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-emerald-400" />
              {activeFile.cloudProvider}
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-[11px] text-zinc-500">
              {lineCount} lines, {charCount} chars
            </span>
            <span className="text-zinc-600">|</span>
            {activeFile.isLoadingContent ? (
              <span className="text-[11px] text-blue-400">Loading...</span>
            ) : isReadOnly ? (
              <span className="text-[11px] text-red-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Read-Only
              </span>
            ) : isCurrentDirty ? (
              <span className="text-[11px] text-blue-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                Unsaved
              </span>
            ) : (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-500 italic">No file selected</span>
        )}
      </div>

      {/* Right Controls & Run/Save Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunCode}
          disabled={!activeFile || activeFile.isBinary || isRunningCode}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50"
          title="Run active file in Output Console"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Run</span>
        </button>

        <button
          onClick={onOpenQuickOpen}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs transition"
          title="Quick Open File (Cmd+P / Ctrl+P)"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-sans">Open</span>
          <kbd className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1 rounded">
            ⌘P
          </kbd>
        </button>

        <button
          onClick={onOpenSearch}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition"
          title="Search in Files (Cmd+Shift+F)"
        >
          <FileSearch className="w-3.5 h-3.5" />
        </button>

        <div className="relative hidden md:block">
          <select
            value={activeTheme}
            onChange={e => onThemeChange(e.target.value as EditorTheme)}
            className="appearance-none bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs rounded px-2.5 py-1 pr-6 cursor-pointer focus:outline-none focus:border-emerald-500"
            title="Monarch Editor Theme"
          >
            <option value="freshfood-dark">FreshFood Dark</option>
            <option value="freshfood-cyber">High Contrast Cyber</option>
            <option value="freshfood-light">FreshFood Light</option>
            <option value="vs-dark">VS Dark+</option>
            <option value="hc-black">High Contrast Black</option>
          </select>
          <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2 top-2 pointer-events-none" />
        </div>

        {/* Save Current File */}
        <button
          onClick={onSaveCurrent}
          disabled={!activeFile || isSaving || isReadOnly || !canSave}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium text-xs transition ${
            isCurrentDirty && !isReadOnly
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md font-semibold'
              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700'
          } disabled:opacity-40 disabled:pointer-events-none`}
          title={
            isReadOnly
              ? 'Save disabled in read-only mode'
              : 'Save file to Cloud Drive via H2_SAVE_FILE_REQ (Cmd+S / Ctrl+S)'
          }
        >
          {isSaving ? (
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>Save</span>
          <kbd className="hidden sm:inline text-[9px] font-mono px-1 rounded opacity-80">
            ⌘S
          </kbd>
        </button>

        {/* Save All to Cloud Button */}
        <button
          onClick={onSaveAll}
          disabled={isSaving || nonDirFiles.length === 0 || isReadOnly || !canSave}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition relative font-medium disabled:opacity-40 disabled:pointer-events-none"
          title={
            isReadOnly
              ? 'Save All disabled in read-only mode'
              : 'Save all modified files via H2_SAVE_FILE_REQ'
          }
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline">Save All</span>
          {dirtyFilesCount > 0 && !isReadOnly && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold text-[10px]">
              {dirtyFilesCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenShortcutsModal}
          className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          title="Shortcuts & Docs"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
