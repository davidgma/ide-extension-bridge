/**
 * Unified VS Code-Style Command Palette & File Quick Open Modal.
 * - Ctrl+P opens in File Search mode (`initialMode = 'files'`).
 * - Ctrl+Shift+P, F1, or clicking the top Command Palette Bar opens in Commands mode (`initialMode = 'commands'`, `>` prefix).
 * - Typing/deleting `>` at the start of the query or clicking the `>` toggle button switches seamlessly between File Search and Commands.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  FileCode,
  FileText,
  Image as ImageIcon,
  Film,
  ChevronRight,
  Terminal,
  Check,
} from 'lucide-react';
import { CloudFile } from '../types/ide';
import { isImageFile, isVideoFile, isMarkdownFile } from '../utils/fileSystem';

export interface IdeCommand {
  id: string;
  category: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  initialMode: 'files' | 'commands';
  files: CloudFile[];
  commands: IdeCommand[];
  onClose: () => void;
  onSelectFile: (fileId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  initialMode,
  files,
  commands,
  onClose,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialMode === 'commands' ? '>' : '');
    setSelectedIndex(0);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
  }, [isOpen, initialMode]);

  // Capture-phase Escape ensures the modal closes cleanly without bubbling to active editor tabs
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, onClose]);

  const isCommandMode = query.startsWith('>');
  const searchTerm = useMemo(
    () => (isCommandMode ? query.slice(1).trim().toLowerCase() : query.trim().toLowerCase()),
    [isCommandMode, query]
  );

  const filteredFiles = useMemo(() => {
    if (isCommandMode) return [];
    return files.filter(
      f =>
        !f.isDirectory &&
        !f.isUntitled &&
        (!searchTerm ||
          f.path.toLowerCase().includes(searchTerm) ||
          f.name.toLowerCase().includes(searchTerm))
    );
  }, [isCommandMode, files, searchTerm]);

  const filteredCommands = useMemo(() => {
    if (!isCommandMode) return [];
    if (!searchTerm) return commands;
    return commands.filter(cmd => {
      const fullTitle = `${cmd.category}: ${cmd.label} ${cmd.shortcut || ''}`.toLowerCase();
      return fullTitle.includes(searchTerm);
    });
  }, [isCommandMode, commands, searchTerm]);

  const itemCount = isCommandMode ? filteredCommands.length : filteredFiles.length;

  useEffect(() => {
    if (selectedIndex >= itemCount && itemCount > 0) {
      setSelectedIndex(0);
    }
  }, [itemCount, selectedIndex]);

  const togglePrefixMode = () => {
    setQuery(prev => {
      if (prev.startsWith('>')) {
        return prev.slice(1).trimStart();
      }
      return `>${prev}`;
    });
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (itemCount === 0) return;
      setSelectedIndex(i => (i + 1 < itemCount ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (itemCount === 0) return;
      setSelectedIndex(i => (i - 1 >= 0 ? i - 1 : itemCount - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isCommandMode) {
        const cmd = filteredCommands[selectedIndex];
        if (cmd && !cmd.disabled) {
          onClose();
          cmd.action();
        }
      } else {
        const file = filteredFiles[selectedIndex];
        if (file) {
          onSelectFile(file.id);
          onClose();
        }
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 dark:bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isCommandMode ? 'Command Palette' : 'Quick Open File'}
        className="w-full max-w-xl bg-white dark:bg-[#1c1c1f] border border-slate-300 dark:border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden select-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Input Bar with > Mode Toggle */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/90">
          {isCommandMode ? (
            <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            placeholder={
              isCommandMode
                ? 'Type a command (backspace > to search files)...'
                : 'Search files by name or path (type > for commands)...'
            }
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 outline-none font-mono"
          />

          <button
            type="button"
            onClick={togglePrefixMode}
            title={
              isCommandMode
                ? 'Switch to File Search (remove > prefix)'
                : 'Switch to Command Palette (add > prefix)'
            }
            className={`px-2 py-0.5 rounded border text-xs font-mono font-bold transition shrink-0 flex items-center gap-0.5 ${
              isCommandMode
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1 divide-y divide-slate-100 dark:divide-zinc-800/40">
          {isCommandMode ? (
            filteredCommands.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 dark:text-zinc-500">
                No matching commands found
              </div>
            ) : (
              filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    disabled={cmd.disabled}
                    onClick={() => {
                      if (cmd.disabled) return;
                      onClose();
                      cmd.action();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition ${
                      cmd.disabled
                        ? 'opacity-45 cursor-not-allowed text-slate-500 dark:text-zinc-500'
                        : isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-slate-950 dark:text-white cursor-pointer'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 shrink-0">
                        {cmd.category}:
                      </span>
                      <span className="font-medium truncate">{cmd.label}</span>
                      {cmd.active && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 shrink-0 ml-2">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })
            )
          ) : filteredFiles.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 dark:text-zinc-500">
              {files.filter(f => !f.isDirectory).length === 0
                ? 'No workspace files loaded yet'
                : 'No matching files found'}
            </div>
          ) : (
            filteredFiles.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              const isImg = isImageFile(file.name);
              const isVid = isVideoFile(file.name);
              const isMd = isMarkdownFile(file.name);

              return (
                <div
                  key={file.id}
                  onClick={() => {
                    onSelectFile(file.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-xs transition ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-slate-950 dark:text-white'
                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isImg ? (
                      <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : isVid ? (
                      <Film className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    ) : isMd ? (
                      <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    ) : (
                      <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <span className="font-mono text-slate-900 dark:text-zinc-200">{file.name}</span>
                    <span className="text-slate-500 dark:text-zinc-500 font-mono text-[11px] truncate">
                      {file.path}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 shrink-0 ml-2">
                    {file.cloudProvider}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/50 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500">
          <span>
            {isCommandMode ? (
              <>
                Remove <kbd className="bg-slate-200 dark:bg-zinc-800 px-1 rounded text-slate-700 dark:text-zinc-300">&gt;</kbd> or click toggle for files
              </>
            ) : (
              <>
                Type <kbd className="bg-slate-200 dark:bg-zinc-800 px-1 rounded text-slate-700 dark:text-zinc-300">&gt;</kbd> or click toggle for commands
              </>
            )}
          </span>
          <span>
            Navigate: <kbd className="bg-slate-200 dark:bg-zinc-800 px-1 rounded text-slate-700 dark:text-zinc-300">↑</kbd>{' '}
            <kbd className="bg-slate-200 dark:bg-zinc-800 px-1 rounded text-slate-700 dark:text-zinc-300">↓</kbd> | Select:{' '}
            <kbd className="bg-slate-200 dark:bg-zinc-800 px-1 rounded text-slate-700 dark:text-zinc-300">Enter</kbd> | Close:{' '}
            <kbd className="bg-slate-200 dark:bg-zinc-800 px-1 rounded text-slate-700 dark:text-zinc-300">Esc</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
