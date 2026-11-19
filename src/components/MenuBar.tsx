/**
 * Always-Visible Top Main Menu Bar (Step 3).
 * Houses File, Edit, View, Bridge, and Help dropdown menus with hover-switching
 * and keyboard shortcut labels, replacing the old top Header toolbar.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  SlidersHorizontal,
  Radio,
  Bug,
  Search,
  Save,
  Cloud,
  PanelLeft,
  FileSearch,
  WrapText,
  Map as MapIcon,
  BookOpen,
  Info,
} from 'lucide-react';

type TopMenuKey = 'file' | 'edit' | 'view' | 'bridge' | 'help';

interface MenuBarProps {
  workspaceName: string;
  hasActiveFile: boolean;
  dirtyFilesCount: number;
  isSaving: boolean;
  isReadOnly: boolean;
  canSave: boolean;
  sidebarOpen: boolean;
  wordWrap: boolean;
  minimap: boolean;
  onOpenCommandPalette: () => void;
  onOpenQuickOpen: () => void;
  onSaveCurrent: () => void;
  onSaveAll: () => void;
  onOpenPreferences: () => void;
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
  onToggleWordWrap: () => void;
  onToggleMinimap: () => void;
  onOpenBridgeStatus: () => void;
  onOpenBridgeDebugger: () => void;
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  workspaceName,
  hasActiveFile,
  dirtyFilesCount,
  isSaving,
  isReadOnly,
  canSave,
  sidebarOpen,
  wordWrap,
  minimap,
  onOpenCommandPalette,
  onOpenQuickOpen,
  onSaveCurrent,
  onSaveAll,
  onOpenPreferences,
  onToggleSidebar,
  onOpenSearch,
  onToggleWordWrap,
  onToggleMinimap,
  onOpenBridgeStatus,
  onOpenBridgeDebugger,
  onOpenShortcuts,
  onOpenAbout,
}) => {
  const [openMenu, setOpenMenu] = useState<TopMenuKey | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside or pressing Escape (capture phase prevents also closing an active virtual tab)
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openMenu !== null) {
        e.stopPropagation();
        setOpenMenu(null);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape, true);
    };
  }, [openMenu]);

  const toggleMenu = (key: TopMenuKey) => {
    setOpenMenu(prev => (prev === key ? null : key));
  };

  const handleHoverSwitch = (key: TopMenuKey) => {
    if (openMenu && openMenu !== key) {
      setOpenMenu(key);
    }
  };

  const canSaveCurrentFile = hasActiveFile && !isSaving && !isReadOnly && canSave;
  const canSaveAllFiles = dirtyFilesCount > 0 && !isSaving && !isReadOnly && canSave;

  const menuButtonClass = (key: TopMenuKey) =>
    `px-2.5 py-1 rounded text-xs font-medium transition ${
      openMenu === key
        ? 'bg-blue-600 text-white'
        : 'hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
    }`;

  return (
    <nav
      ref={menuContainerRef}
      aria-label="Main menu"
      className="h-9 bg-slate-100 dark:bg-[#141417] border-b border-slate-200 dark:border-zinc-800 px-2 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-xs text-slate-700 dark:text-zinc-300 select-auto z-40 shrink-0"
    >
      <div className="flex items-center gap-0.5 shrink-0">
        {/* File Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('file')}
            onMouseEnter={() => handleHoverSwitch('file')}
            className={menuButtonClass('file')}
          >
            File
          </button>

          {openMenu === 'file' && (
            <div className="absolute left-0 top-full mt-0.5 w-60 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenQuickOpen();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Quick Open...</span>
                </span>
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">Ctrl+P</kbd>
              </button>

              <div className="my-1 border-t border-slate-200 dark:border-zinc-700/80" />

              <button
                type="button"
                disabled={!canSaveCurrentFile}
                onClick={() => {
                  setOpenMenu(null);
                  onSaveCurrent();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </span>
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">Ctrl+S</kbd>
              </button>

              <button
                type="button"
                disabled={!canSaveAllFiles}
                onClick={() => {
                  setOpenMenu(null);
                  onSaveAll();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="flex items-center gap-2">
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Save All</span>
                </span>
                {dirtyFilesCount > 0 && !isReadOnly && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-semibold text-[10px]">
                    {dirtyFilesCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('edit')}
            onMouseEnter={() => handleHoverSwitch('edit')}
            className={menuButtonClass('edit')}
          >
            Edit
          </button>

          {openMenu === 'edit' && (
            <div className="absolute left-0 top-full mt-0.5 w-56 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenPreferences();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Preferences</span>
                </span>
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">Ctrl+,</kbd>
              </button>
            </div>
          )}
        </div>

        {/* View Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('view')}
            onMouseEnter={() => handleHoverSwitch('view')}
            className={menuButtonClass('view')}
          >
            View
          </button>

          {openMenu === 'view' && (
            <div className="absolute left-0 top-full mt-0.5 w-64 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onToggleSidebar();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <span className="flex items-center gap-2">
                  <PanelLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Primary Side Bar</span>
                </span>
                <span className="flex items-center gap-2">
                  <kbd className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">Ctrl+B</kbd>
                  {sidebarOpen && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenSearch();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <span className="flex items-center gap-2">
                  <FileSearch className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Search Workspace...</span>
                </span>
                <kbd className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                  Ctrl+Shift+F
                </kbd>
              </button>

              <div className="my-1 border-t border-slate-200 dark:border-zinc-700/80" />

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onToggleWordWrap();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <span className="flex items-center gap-2">
                  <WrapText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Word Wrap</span>
                </span>
                {wordWrap && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onToggleMinimap();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <span className="flex items-center gap-2">
                  <MapIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Minimap</span>
                </span>
                {minimap && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              </button>
            </div>
          )}
        </div>

        {/* Bridge Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('bridge')}
            onMouseEnter={() => handleHoverSwitch('bridge')}
            className={menuButtonClass('bridge')}
          >
            Bridge
          </button>

          {openMenu === 'bridge' && (
            <div className="absolute left-0 top-full mt-0.5 w-52 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenBridgeStatus();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Status</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenBridgeDebugger();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <Bug className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Show Debugger</span>
              </button>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu('help')}
            onMouseEnter={() => handleHoverSwitch('help')}
            className={menuButtonClass('help')}
          >
            Help
          </button>

          {openMenu === 'help' && (
            <div className="absolute left-0 top-full mt-0.5 w-56 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenShortcuts();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Shortcuts and Docs</span>
              </button>

              <div className="my-1 border-t border-slate-200 dark:border-zinc-700/80" />

              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenAbout();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
              >
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>About</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Centered VS Code-Style Command Palette Bar */}
      <div className="flex items-center justify-center min-w-0 px-2">
        <button
          type="button"
          onClick={() => {
            setOpenMenu(null);
            onOpenCommandPalette();
          }}
          title="Open Command Palette (Ctrl+Shift+P / F1)"
          className="w-full max-w-md h-6 px-3 rounded-md bg-white dark:bg-[#1e1e23] hover:bg-slate-50 dark:hover:bg-[#25252b] border border-slate-300 dark:border-zinc-700/80 hover:border-blue-500/70 text-slate-600 dark:text-zinc-400 flex items-center justify-between gap-2 text-[11.5px] transition shadow-2xs"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate font-medium text-slate-700 dark:text-zinc-300">
              {workspaceName}
            </span>
            <span className="hidden sm:inline text-slate-400 dark:text-zinc-500 truncate">
              — Command Palette
            </span>
          </span>
          <kbd className="hidden md:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 shrink-0">
            Ctrl+Shift+P
          </kbd>
        </button>
      </div>

      {/* Right spacer to keep Command Palette balanced */}
      <div className="hidden lg:block w-36 shrink-0" aria-hidden="true" />
    </nav>
  );
};
