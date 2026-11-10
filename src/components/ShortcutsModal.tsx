import React from 'react';
import { X, Command, BookOpen, Cloud, ExternalLink, ShieldCheck } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Cmd + S / Ctrl + S', desc: 'Save active file directly to Cloud Provider via Extension bridge' },
    { key: 'Cmd + P / Ctrl + P', desc: 'Quick Open file switcher' },
    { key: 'Cmd + Shift + F', desc: 'Global workspace search' },
    { key: 'Alt + Z', desc: 'Toggle Word Wrap' },
    { key: 'Cmd + F / Ctrl + F', desc: 'Find within current editor' },
    { key: 'Shift + Alt + F', desc: 'Format active document' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1c1c1f] border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <span>Monarch IDE & Cloud Studio Documentation</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-zinc-300">
          {/* Overview */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300">
            <h4 className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Production Domain: ide.freshfood.rocks</span>
            </h4>
            <p className="text-zinc-300 leading-relaxed text-[11.5px]">
              This Single Page Application is designed to run at{' '}
              <a href="https://ide.freshfood.rocks" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-mono">
                https://ide.freshfood.rocks
              </a>
              , deployed automatically via GitHub Actions with GitHub Pages.
            </p>
          </div>

          {/* Shortcuts Table */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-1.5">
              <Command className="w-4 h-4 text-emerald-400" />
              <span>Keyboard Shortcuts</span>
            </h4>
            <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800 bg-zinc-900/40">
              {shortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2">
                  <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-emerald-400 font-mono text-[11px]">
                    {s.key}
                  </kbd>
                  <span className="text-zinc-300">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extension Protocol Specs */}
          <div>
            <h4 className="font-semibold text-white text-sm mb-2 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-emerald-400" />
              <span>Clockie McClockface Handshake Specs</span>
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-[11.5px] leading-relaxed">
              <li>
                <strong className="text-zinc-200 font-mono">PING_HANDSHAKE</strong>: Validates client-extension pairing.
              </li>
              <li>
                <strong className="text-zinc-200 font-mono">LOAD_FILES_PAYLOAD</strong>: Ingests cloud file structures from pCloud, Google Drive, or Dropbox.
              </li>
              <li>
                <strong className="text-zinc-200 font-mono">SAVE_CLOUD_FILE</strong>: Dispatches edited buffer back to cloud storage immediately on Ctrl+S / Cmd+S.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-semibold text-xs transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
