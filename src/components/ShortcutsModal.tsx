/**
 * Keyboard Shortcuts & H2_CLOUD_BRIDGE v1.3 Reference Modal.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Monaco Editor Keybindings: https://microsoft.github.io/monaco-editor/
 */

import React, { useEffect } from 'react';
import { X, Command, BookOpen, Cloud, ShieldCheck } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd + Shift + P / F1', desc: 'Open Command Palette (IDE commands, type/clear > to toggle)' },
    { key: 'Cmd + P / Ctrl + P', desc: 'Quick Open file switcher (type > for Command Palette)' },
    { key: 'Cmd + S / Ctrl + S', desc: 'Save active file to Cloud Storage (H2_SAVE_FILE_REQ)' },
    { key: 'Cmd + Shift + F', desc: 'Global workspace search (loaded files)' },
    { key: 'Cmd + B / Ctrl + B', desc: 'Toggle Primary Side Bar' },
    { key: 'Cmd + , / Ctrl + ,', desc: 'Open Preferences tab' },
    { key: 'Cmd + W / Ctrl + W', desc: 'Close active editor tab' },
    { key: 'Cmd + F / Ctrl + F', desc: 'Find within current editor' },
    { key: 'Shift + Alt + F', desc: 'Format active document' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#1c1c1f] border border-slate-300 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden select-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
            <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Monarch IDE & H2_CLOUD_BRIDGE v1.3 Docs</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-slate-700 dark:text-zinc-300">
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Production Domain: ide.freshfood.rocks (v1.3)</span>
            </h4>
            <p className="text-slate-700 dark:text-zinc-300 leading-relaxed text-[11.5px]">
              This Single Page Application runs at{' '}
              <a
                href="https://ide.freshfood.rocks"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 underline font-mono"
              >
                https://ide.freshfood.rocks
              </a>
              , connecting cleanly via unified <code className="font-mono text-emerald-700 dark:text-emerald-300">H2_CONNECT_REQ</code> with per-tab <code className="font-mono text-blue-700 dark:text-blue-300">sessionStorage</code> binding and clean URLs.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-1.5">
              <Command className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Keyboard Shortcuts</span>
            </h4>
            <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden divide-y divide-slate-200 dark:divide-zinc-800 bg-slate-50 dark:bg-zinc-900/40">
              {shortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2 gap-3">
                  <kbd className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-blue-700 dark:text-blue-300 font-mono text-[11px] shrink-0">
                    {s.key}
                  </kbd>
                  <span className="text-slate-700 dark:text-zinc-300 text-right">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-2 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Clockie H2 Bridge Protocol v1.3 (H2_CLOUD_BRIDGE)</span>
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-zinc-400 text-[11.5px] leading-relaxed">
              <li>
                <strong className="text-slate-900 dark:text-zinc-200 font-mono">H2_BRIDGE_READY</strong>: Emitted at document_start & DOMContentLoaded when extension listeners attach.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-zinc-200 font-mono">H2_CONNECT_REQ / H2_CONNECT_RES</strong>: Unified connection returning sessionMode (&quot;launched&quot; | &quot;direct&quot;), launchedScope, accessMode, and connected drives.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-zinc-200 font-mono">H2_WORKSPACE_TREE_REQ / H2_LIST_FOLDER_REQ</strong>: Depth-limited, multi-drive & driveRoot-switchable folder trees (childrenLoaded).
              </li>
              <li>
                <strong className="text-slate-900 dark:text-zinc-200 font-mono">H2_READ_FILE_REQ / H2_READ_FILE_RES</strong>: Lazy and concurrent (Promise.all) utf-8/base64 file reading.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-zinc-200 font-mono">H2_SAVE_FILE_REQ / H2_DELETE_FILE_REQ</strong>: Readwrite cloud saves, nested file creation, and deletion.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-zinc-200 font-mono">H2_DISCONNECT_REQ / H2_DISCONNECT_RES</strong>: Clean session termination and sessionStorage cleanup.
              </li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
