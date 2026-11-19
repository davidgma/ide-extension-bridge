/**
 * Top IDE Header & Action Toolbar.
 * Displays brand identity, H2_CLOUD_BRIDGE v1.3 connection controls (Direct & Launched modes),
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
  Radio,
  Lock,
} from 'lucide-react';
import { CloudFile, EditorTheme } from '../types/ide';

interface HeaderProps {
  activeFile: CloudFile | null;
  files: CloudFile[];
  isSaving: boolean;
  isReadOnly: boolean;
  canSave: boolean;
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
  onOpenShortcutsModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeFile,
  files,
  isSaving,
  isReadOnly,
  canSave,
  activeTheme,
  lineCount,
  charCount,
  onThemeChange,
  onSaveCurrent,
  onSaveAll,
  onOpenQuickOpen,
  onOpenSearch,
  onOpenShortcutsModal,
}) => {
  const nonDirFiles = files.filter(f => !f.isDirectory);
  const dirtyFilesCount = nonDirFiles.filter(f => f.isDirty).length;
  const isCurrentDirty = activeFile?.isDirty;

  return (
    <header className="h-12 bg-white dark:bg-[#18181b] border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between px-3 text-xs select-auto shadow-sm dark:shadow-md z-30 shrink-0">
      {/* Left Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-md shadow-emerald-900/20">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-slate-900 dark:text-white text-sm">
              <span>FreshFood</span>
              <span className="text-emerald-600 dark:text-emerald-400">.rocks</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded font-normal">
                Monarch IDE v1.3
              </span>
            </div>
          </div>
        </div>

        {/* Production Domain Link */}
        <a
          href="https://ide.freshfood.rocks"
          target="_blank"
          rel="noreferrer"
          className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-900/80 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono transition"
          title="Target Domain: ide.freshfood.rocks"
        >
          <span>ide.freshfood.rocks</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      </div>

      {/* Middle Active File Metadata */}
      <div className="hidden xl:flex items-center gap-3 text-slate-500 dark:text-zinc-400 text-xs font-mono">
        {activeFile ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-lg">
            <span className="text-slate-900 dark:text-white font-medium">{activeFile.name}</span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            <span className="text-slate-600 dark:text-zinc-400 text-[11px] flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              {activeFile.cloudProvider}
            </span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">
              {lineCount} lines, {charCount} chars
            </span>
            <span className="text-slate-300 dark:text-zinc-600">|</span>
            {activeFile.isLoadingContent ? (
              <span className="text-[11px] text-blue-600 dark:text-blue-400">Loading...</span>
            ) : isReadOnly ? (
              <span className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Read-Only
              </span>
            ) : isCurrentDirty ? (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                Unsaved
              </span>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-400 dark:text-zinc-500 italic">No file selected</span>
        )}
      </div>

      {/* Right Controls & Save Actions */}
      <div className="flex items-center gap-2">

        <button
          onClick={onOpenQuickOpen}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800 text-xs transition"
          title="Quick Open File (Cmd+P / Ctrl+P)"
        >
          <Search className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
          <span className="font-sans">Open</span>
          <kbd className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 bg-slate-200 dark:bg-zinc-800 px-1 rounded">
            ⌘P
          </kbd>
        </button>

        <button
          onClick={onOpenSearch}
          className="p-1.5 rounded bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800 transition"
          title="Search in Files (Cmd+Shift+F)"
        >
          <FileSearch className="w-3.5 h-3.5" />
        </button>

        <div className="relative hidden md:block">
          <select
            value={activeTheme}
            onChange={e => onThemeChange(e.target.value as EditorTheme)}
            className="appearance-none bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800 text-xs rounded px-2.5 py-1 pr-6 cursor-pointer focus:outline-none focus:border-emerald-500"
            title="Monarch Editor Theme"
          >
            <option value="freshfood-dark">FreshFood Dark</option>
            <option value="freshfood-cyber">High Contrast Cyber</option>
            <option value="freshfood-light">FreshFood Light</option>
            <option value="vs-dark">VS Dark+</option>
            <option value="vs">VS Light</option>
            <option value="hc-black">High Contrast Black</option>
          </select>
          <ChevronDown className="w-3 h-3 text-slate-500 dark:text-zinc-400 absolute right-2 top-2 pointer-events-none" />
        </div>

        {/* Save Current File */}
        <button
          onClick={onSaveCurrent}
          disabled={!activeFile || isSaving || isReadOnly || !canSave}
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-medium text-xs transition ${
            isCurrentDirty && !isReadOnly
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md font-semibold'
              : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white border border-slate-300 dark:border-zinc-700'
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
          className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 text-xs transition relative font-medium disabled:opacity-40 disabled:pointer-events-none"
          title={
            isReadOnly
              ? 'Save All disabled in read-only mode'
              : 'Save all modified files via H2_SAVE_FILE_REQ'
          }
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden lg:inline">Save All</span>
          {dirtyFilesCount > 0 && !isReadOnly && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-bold text-[10px]">
              {dirtyFilesCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenShortcutsModal}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
          title="Shortcuts & Docs"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
