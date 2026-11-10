import React from 'react';
import { 
  Cloud, 
  CloudCheck, 
  CloudOff, 
  Save, 
  Layers, 
  Radio, 
  Palette, 
  Search, 
  Sparkles, 
  HelpCircle, 
  FileSearch,
  ExternalLink,
  ChevronDown,
  HardDrive,
  Check,
  RotateCw
} from 'lucide-react';
import { CloudFile, CloudProvider, EditorTheme, ExtensionStatus, ExtensionHandshakeInfo } from '../types/ide';

interface HeaderProps {
  activeFile: CloudFile | null;
  files: CloudFile[];
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  isSaving: boolean;
  activeTheme: EditorTheme;
  wordWrap: boolean;
  minimap: boolean;
  lineCount: number;
  charCount: number;
  onThemeChange: (theme: EditorTheme) => void;
  onToggleWordWrap: () => void;
  onToggleMinimap: () => void;
  onSaveCurrent: () => void;
  onSaveAll: () => void;
  onOpenQuickOpen: () => void;
  onOpenSearch: () => void;
  onOpenBridgeModal: () => void;
  onOpenShortcutsModal: () => void;
  onProviderChange?: (provider: CloudProvider) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeFile,
  files,
  extensionStatus,
  handshakeInfo,
  isSaving,
  activeTheme,
  wordWrap,
  minimap,
  lineCount,
  charCount,
  onThemeChange,
  onToggleWordWrap,
  onToggleMinimap,
  onSaveCurrent,
  onSaveAll,
  onOpenQuickOpen,
  onOpenSearch,
  onOpenBridgeModal,
  onOpenShortcutsModal,
}) => {
  const dirtyFilesCount = files.filter(f => f.isDirty).length;
  const isCurrentDirty = activeFile?.isDirty;

  return (
    <header className="h-12 bg-[#18181b] border-b border-zinc-800 flex items-center justify-between px-3 text-xs select-none shadow-md z-30">
      {/* Left Brand & Hostname badge */}
      <div className="flex items-center gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 group cursor-pointer" onClick={onOpenBridgeModal}>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <Radio className="w-4 h-4 text-black animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-white text-sm">
              <span>FreshFood</span>
              <span className="text-emerald-400">.rocks</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/30 rounded font-normal">
                Monarch IDE
              </span>
            </div>
          </div>
        </div>

        {/* Custom Domain Pill */}
        <a
          href="https://ide.freshfood.rocks"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-emerald-300 border border-zinc-800 text-[11px] font-mono transition"
          title="Deployed Live Target Domain"
        >
          <span>ide.freshfood.rocks</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        {/* Divider */}
        <div className="h-4 w-px bg-zinc-800 hidden md:block" />

        {/* Chrome Extension Status Pill */}
        <button
          onClick={onOpenBridgeModal}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-[11.5px] font-medium border transition ${
            extensionStatus === 'connected'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/90 shadow-sm shadow-emerald-950'
              : extensionStatus === 'connecting'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 hover:bg-amber-950/90'
              : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-850'
          }`}
          title="Click to view Extension Bridge Console & Message Logs"
        >
          {extensionStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              <span>🟢 Connected to Clockie McClockface Extension</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-emerald-900/80 rounded text-emerald-200 uppercase font-mono">
                {handshakeInfo?.provider || 'pCloud'}
              </span>
            </>
          ) : extensionStatus === 'connecting' ? (
            <>
              <RotateCw className="w-3 h-3 text-amber-400 animate-spin" />
              <span>Connecting Extension...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>🟡 Standalone Mode</span>
              <span className="text-[10px] text-zinc-500 underline ml-1">Connect / Test</span>
            </>
          )}
        </button>
      </div>

      {/* Middle Active File Metadata */}
      <div className="hidden lg:flex items-center gap-3 text-zinc-400 text-xs font-mono">
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
            {isCurrentDirty ? (
              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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

      {/* Right Controls & Save Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Open File */}
        <button
          onClick={onOpenQuickOpen}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs transition"
          title="Quick Open File (Cmd+P / Ctrl+P)"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden sm:inline font-sans">Open File</span>
          <kbd className="hidden md:inline text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1 rounded">
            ⌘P
          </kbd>
        </button>

        {/* Global Search */}
        <button
          onClick={onOpenSearch}
          className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition"
          title="Search in Files (Cmd+Shift+F)"
        >
          <FileSearch className="w-3.5 h-3.5" />
        </button>

        {/* Theme Switcher */}
        <div className="relative">
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
          disabled={!activeFile || isSaving}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium text-xs transition ${
            isCurrentDirty
              ? 'bg-emerald-600 hover:bg-emerald-500 text-black shadow-md shadow-emerald-950 font-semibold'
              : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700'
          } disabled:opacity-50 disabled:pointer-events-none`}
          title="Save file to Cloud Drive (Cmd+S / Ctrl+S)"
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
          disabled={isSaving || files.length === 0}
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs transition relative font-medium"
          title="Save all open changes to Cloud Extension"
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Save All to Cloud</span>
          {dirtyFilesCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold text-[10px]">
              {dirtyFilesCount}
            </span>
          )}
        </button>

        {/* Keyboard Shortcuts Helper */}
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
