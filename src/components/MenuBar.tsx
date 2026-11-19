/**
 * Minimal Always-Visible Top Main Menu Bar (Step 1a Shell).
 * Houses `File -> Preferences -> (Color Mode, Export to JSON, Import from JSON, Reset)`
 * and will be expanded with Edit, View, Bridge, and Help menus in Step 4.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Sun,
  Moon,
  Download,
  Upload,
  RotateCcw,
  Check,
  SlidersHorizontal,
} from 'lucide-react';
import { UiColorMode } from '../types/ide';

interface MenuBarProps {
  colorMode: UiColorMode;
  onSetColorMode: (mode: UiColorMode) => void;
  onToggleColorMode: () => void;
  onOpenExportPreferences: () => void;
  onOpenImportPreferences: () => void;
  onResetPreferences: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({
  colorMode,
  onSetColorMode,
  onToggleColorMode,
  onOpenExportPreferences,
  onOpenImportPreferences,
  onResetPreferences,
}) => {
  const [openMenu, setOpenMenu] = useState<'file' | null>(null);
  const [preferencesSubmenuOpen, setPreferencesSubmenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setPreferencesSubmenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setPreferencesSubmenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const closeAllMenus = () => {
    setOpenMenu(null);
    setPreferencesSubmenuOpen(false);
  };

  return (
    <nav
      ref={menuContainerRef}
      aria-label="Main menu"
      className="h-7 bg-slate-100 dark:bg-[#141417] border-b border-slate-200 dark:border-zinc-800 px-2 flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300 select-auto z-40 shrink-0"
    >
      {/* Left: Top-level always-visible menu items (expanded in Step 4) */}
      <div className="flex items-center gap-0.5">
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const next = openMenu === 'file' ? null : 'file';
              setOpenMenu(next);
              setPreferencesSubmenuOpen(false);
            }}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition ${
              openMenu === 'file'
                ? 'bg-blue-600 text-white'
                : 'hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
            }`}
          >
            File
          </button>

          {openMenu === 'file' && (
            <div className="absolute left-0 top-full mt-0.5 w-56 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
              {/* Preferences Submenu Trigger */}
              <div
                className="relative"
                onMouseEnter={() => setPreferencesSubmenuOpen(true)}
                onMouseLeave={() => setPreferencesSubmenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setPreferencesSubmenuOpen(prev => !prev)}
                  className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 text-xs transition"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Preferences</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>

                {preferencesSubmenuOpen && (
                  <div className="absolute left-full top-0 ml-0.5 w-64 rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1f1f23] shadow-xl py-1 z-50">
                    <div className="px-3 py-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                      Color Theme
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSetColorMode('light');
                        closeAllMenus();
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 text-xs transition"
                    >
                      <span className="flex items-center gap-2">
                        <Sun className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Light Mode</span>
                      </span>
                      {colorMode === 'light' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSetColorMode('dark');
                        closeAllMenus();
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 text-xs transition"
                    >
                      <span className="flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Dark Mode</span>
                      </span>
                      {colorMode === 'dark' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </button>

                    <div className="my-1 border-t border-slate-200 dark:border-zinc-700/80" />

                    <button
                      type="button"
                      onClick={() => {
                        closeAllMenus();
                        onOpenExportPreferences();
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 text-xs transition"
                    >
                      <span className="flex items-center gap-2">
                        <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Export to JSON...</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        Step 1b
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        closeAllMenus();
                        onOpenImportPreferences();
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/60 text-xs transition"
                    >
                      <span className="flex items-center gap-2">
                        <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Import from JSON...</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                        Step 1b
                      </span>
                    </button>

                    <div className="my-1 border-t border-slate-200 dark:border-zinc-700/80" />

                    <button
                      type="button"
                      onClick={() => {
                        onResetPreferences();
                        closeAllMenus();
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-700 dark:text-red-300 text-xs transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Preferences to Defaults</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Quick Light/Dark Mode Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleColorMode}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] transition"
          title={`Switch to ${colorMode === 'dark' ? 'Light' : 'Dark'} Mode (persisted in localStorage)`}
        >
          {colorMode === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-blue-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
};
