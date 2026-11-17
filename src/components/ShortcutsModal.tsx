/**
 * Keyboard Shortcuts & H2_CLOUD_BRIDGE v1.1 Reference Modal.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Monaco Editor Keybindings: https://microsoft.github.io/monaco-editor/
 */

import React from 'react';
import { X, Command, BookOpen, Cloud, ShieldCheck } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd + S / Ctrl + S', desc: 'Save active file to Cloud Storage (H2_SAVE_FILE_REQ)' },
    { key: 'Cmd + P / Ctrl + P', desc: 'Quick Open file switcher' },
    { key: 'Cmd + Shift + F', desc: 'Global workspace search (loaded files)' },
    { key: 'Cmd + B / Ctrl + B', desc: 'Toggle File Explorer Sidebar' },
    { key: 'Cmd + F / Ctrl + F', desc: 'Find within current editor' },
    { key: 'Shift + Alt + F', desc: 'Format active document' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1c1c1f] border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden select-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <span>Monarch IDE & H2_CLOUD_BRIDGE v1.1 Docs</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-zinc-300">
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300">
            <h4 className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Production Domain: ide.freshfood.rocks (v1.1)</span>
            </h4>
            <p className="text-zinc-300 leading-relaxed text-[11.5px]">
              This Single Page Application runs at{' '}
              <a
                href="https://ide.freshfood.rocks"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 underline font-mono"
              >
                https://ide.freshfood.rocks
              </a>
              , integrating dynamically with any cloud workspace opened via{' '}
              <code className="font-mono text-emerald-300">#h2Session=&lt;sessionId&gt;</code>.
            </p>
          </div>

          {/* Shortcuts Table */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-1.5">
              <Command className="w-4 h-4 text-blue-400" />
              <span>Keyboard Shortcuts</span>
            </h4>
            <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800 bg-zinc-900/40">
              {shortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2 gap-3">
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-blue-300 font-mono text-[11px] shrink-0">
                    {s.key}
                  </kbd>
                  <span className="text-zinc-300 text-right">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extension Protocol v1.1 Specs */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>Clockie H2 Bridge Protocol v1.1 (H2_CLOUD_BRIDGE)</span>
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-[11.5px] leading-relaxed">
              <li>
                <strong className="text-zinc-200 font-mono">H2_HANDSHAKE_REQ / H2_HANDSHAKE_RES</strong>: Negotiates protocol v1.1, provider, and workspace capabilities using h2Session.
              </li>
              <li>
                <strong className="text-zinc-200 font-mono">H2_WORKSPACE_TREE / H2_WORKSPACE_TREE_ACK</strong>: Loads metadata-only folder and file hierarchies and acknowledges receipt.
              </li>
              <li>
                <strong className="text-zinc-200 font-mono">H2_READ_FILE_REQ / H2_READ_FILE_RES</strong>: Lazily fetches utf-8 or base64 content when a file is opened.
              </li>
              <li>
                <strong className="text-zinc-200 font-mono">H2_SAVE_FILE_REQ / H2_SAVE_FILE_RES</strong>: Saves edited files or creates new files and nested subdirectories.
              </li>
              <li>
                <strong className="text-zinc-200 font-mono">H2_DELETE_FILE_REQ / H2_DELETE_FILE_RES</strong>: Deletes or trashes files and folders.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end">
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
