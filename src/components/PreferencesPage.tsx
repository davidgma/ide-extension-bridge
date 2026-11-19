/**
 * Full-Page Preferences Editor Tab (Edit -> Preferences / Ctrl+,).
 * Replaces the old Preferences dropdown submenu and header theme picker with a
 * tabbed VS Code-style settings page covering UI Color Mode, Monaco Editor Theme,
 * Editor Behavior, Sidebar Width, and Cloud/Local JSON Export, Import & Reset.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Tailwind CSS Dark Mode: https://tailwindcss.com/docs/dark-mode
 * - Window.localStorage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Sun,
  Moon,
  Palette,
  Type,
  WrapText,
  Map as MapIcon,
  PanelLeft,
  Download,
  Upload,
  RotateCcw,
  Check,
  X,
  HardDrive,
} from 'lucide-react';
import { EditorTheme, IdeSettings, UiColorMode } from '../types/ide';

interface PreferencesPageProps {
  settings: IdeSettings;
  isBridgeConnected: boolean;
  onSetColorMode: (mode: UiColorMode) => void;
  onSetEditorTheme: (theme: EditorTheme) => void;
  onUpdateSettings: (patch: Partial<IdeSettings>) => void;
  onOpenExportPreferences: () => void;
  onOpenImportPreferences: () => void;
  onResetPreferences: () => void;
  onClose: () => void;
}

const EDITOR_THEMES: Array<{
  id: EditorTheme;
  label: string;
  mode: UiColorMode;
  description: string;
}> = [
  {
    id: 'freshfood-dark',
    label: 'FreshFood Dark',
    mode: 'dark',
    description: 'Deep charcoal background with emerald and blue syntax accents.',
  },
  {
    id: 'freshfood-cyber',
    label: 'High Contrast Cyber',
    mode: 'dark',
    description: 'Ultra-crisp dark surface with vivid cyan, green, and blue tokens.',
  },
  {
    id: 'vs-dark',
    label: 'VS Dark+',
    mode: 'dark',
    description: 'Classic Visual Studio Code dark theme.',
  },
  {
    id: 'hc-black',
    label: 'High Contrast Black',
    mode: 'dark',
    description: 'Pure black canvas designed for maximum contrast readability.',
  },
  {
    id: 'freshfood-light',
    label: 'FreshFood Light',
    mode: 'light',
    description: 'Clean bright workspace balanced for daylight reading.',
  },
  {
    id: 'vs',
    label: 'VS Light',
    mode: 'light',
    description: 'Classic Visual Studio Code light theme.',
  },
];

export const PreferencesPage: React.FC<PreferencesPageProps> = ({
  settings,
  isBridgeConnected,
  onSetColorMode,
  onSetEditorTheme,
  onUpdateSettings,
  onOpenExportPreferences,
  onOpenImportPreferences,
  onResetPreferences,
  onClose,
}) => {
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-zinc-200 select-auto overflow-hidden">
      {/* Top Page Title & Close Action */}
      <div className="px-6 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1c1c20] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Preferences
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 shrink-0">
                Auto-Saved to localStorage
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
              Customize appearance, Monaco editor behavior, and cloud JSON preference profiles.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close tab (Esc)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 text-xs font-medium transition shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          <span>Close</span>
          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400">
            Esc
          </kbd>
        </button>
      </div>

      {/* Scrollable Settings Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Section 1: Appearance & Theme */}
          <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1e1e22] overflow-hidden shadow-2xs">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center gap-2">
              <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
                Appearance &amp; Theme
              </h2>
            </div>

            <div className="p-5 space-y-5">
              {/* Light / Dark Shell Color Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Workspace Color Mode
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Switches the entire IDE shell and restores your last matching Light or Dark editor theme.
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSetColorMode('light')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      settings.colorMode === 'light'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:border-blue-400'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light Mode</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetColorMode('dark')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      settings.colorMode === 'dark'
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:border-blue-400'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark Mode</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-800/80 pt-4">
                <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 mb-1">
                  Editor Syntax Theme
                </div>
                <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mb-3">
                  Selecting a Light or Dark syntax theme automatically switches Workspace Color Mode to match.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {EDITOR_THEMES.map(theme => {
                    const isSelected = settings.editorTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => onSetEditorTheme(theme.id)}
                        className={`p-3 rounded-lg border text-left transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-blue-500/40'
                            : 'border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                            {theme.label}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400">
                            {theme.mode === 'light' ? 'Light' : 'Dark'}
                            {isSelected && (
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                          {theme.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Editor & Layout Settings */}
          <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1e1e22] overflow-hidden shadow-2xs">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center gap-2">
              <Type className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
                Editor &amp; Workspace Layout
              </h2>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-zinc-800/80">
              {/* Font Size */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Editor Font Size
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Controls font size in the Monaco code editor (10 px – 28 px).
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ fontSize: Math.max(10, Number((settings.fontSize - 0.5).toFixed(1))) })
                    }
                    className="w-7 h-7 rounded-md border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-xs font-bold transition"
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={10}
                    max={28}
                    step={0.5}
                    value={settings.fontSize}
                    onChange={e => onUpdateSettings({ fontSize: Number(e.target.value) })}
                    className="w-32 accent-blue-600 cursor-pointer"
                    aria-label="Editor font size"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ fontSize: Math.min(28, Number((settings.fontSize + 0.5).toFixed(1))) })
                    }
                    className="w-7 h-7 rounded-md border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-xs font-bold transition"
                  >
                    +
                  </button>
                  <span className="w-14 text-right font-mono text-xs text-slate-800 dark:text-zinc-200">
                    {settings.fontSize} px
                  </span>
                </div>
              </div>

              {/* Tab Size */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                    Tab Size (Spaces)
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                    Number of spaces rendered per indentation level.
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {[2, 4, 8].map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onUpdateSettings({ tabSize: size })}
                      className={`px-3 py-1 rounded-md border font-mono text-xs transition ${
                        settings.tabSize === size
                          ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                          : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:border-blue-400'
                      }`}
                    >
                      {size} spaces
                    </button>
                  ))}
                </div>
              </div>

              {/* Word Wrap */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <WrapText className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      Word Wrap
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Wrap long lines cleanly inside the editor viewport without horizontal scrolling.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })}
                  className={`px-3 py-1 rounded-md border text-xs font-medium transition shrink-0 ${
                    settings.wordWrap
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700'
                  }`}
                >
                  {settings.wordWrap ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Minimap */}
              <div className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <MapIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      Code Minimap
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Show a scaled overview of the active file along the right edge of the editor.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ minimap: !settings.minimap })}
                  className={`px-3 py-1 rounded-md border text-xs font-medium transition shrink-0 ${
                    settings.minimap
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700'
                  }`}
                >
                  {settings.minimap ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Primary Side Bar */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <PanelLeft className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                      Primary Side Bar
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      Drag the divider between the sidebar and editor to resize (currently{' '}
                      <span className="font-mono text-slate-800 dark:text-zinc-200">
                        {settings.sidebarWidth} px
                      </span>
                      ).
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ sidebarWidth: 260 })}
                    className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-200 dark:hover:bg-zinc-800 text-xs transition"
                  >
                    Reset Width (260 px)
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ sidebarOpen: !settings.sidebarOpen })}
                    className={`px-3 py-1 rounded-md border text-xs font-medium transition ${
                      settings.sidebarOpen
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700'
                    }`}
                  >
                    {settings.sidebarOpen ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: JSON Export, Import & Reset */}
          <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1e1e22] overflow-hidden shadow-2xs">
            <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Preferences Backup &amp; Cloud JSON Sync
                </h2>
              </div>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                  isBridgeConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700'
                }`}
              >
                {isBridgeConnected ? 'Cloud Drives Ready' : 'Local Download/Upload Fallback'}
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                    Default Cloud Export Target
                  </div>
                  <div className="font-mono text-slate-800 dark:text-zinc-200 break-all">
                    {settings.preferencesExportProvider}/
                    {settings.preferencesExportFolder ? `${settings.preferencesExportFolder}/` : ''}
                    {settings.preferencesExportFilename}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                    Most Recent Import Location
                  </div>
                  <div className="font-mono text-slate-800 dark:text-zinc-200 break-all">
                    {settings.preferencesLastImportProvider
                      ? `${settings.preferencesLastImportProvider}/${
                          settings.preferencesLastImportFolder
                            ? `${settings.preferencesLastImportFolder}/`
                            : ''
                        }${settings.preferencesLastImportFile || '(folder only)'}`
                      : 'None recorded yet (defaults to export folder)'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenExportPreferences}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export to JSON...</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenImportPreferences}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import from JSON...</span>
                  </button>
                </div>

                {confirmingReset ? (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/40 px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-red-800 dark:text-red-200 font-medium">
                      Reset all settings to defaults?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onResetPreferences();
                        setConfirmingReset(false);
                      }}
                      className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingReset(false)}
                      className="px-2.5 py-1 rounded bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-xs transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/40 text-xs font-medium transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Preferences to Defaults</span>
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
