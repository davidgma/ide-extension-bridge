/**
 * Compact Help -> About Modal for Monarch IDE.
 * Displays application version, Clockie H2 Bridge Protocol v1.3 status summary,
 * and active session metadata, dismissible with Esc or OK.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useEffect } from 'react';
import { X, Radio, ShieldCheck, Globe } from 'lucide-react';
import { ExtensionHandshakeInfo, ExtensionStatus } from '../types/ide';

interface AboutModalProps {
  isOpen: boolean;
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  extensionStatus,
  handshakeInfo,
  onClose,
}) => {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className="w-full max-w-md bg-white dark:bg-[#1c1c1f] border border-slate-300 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden select-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-xs">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="about-modal-title" className="text-sm font-bold text-slate-900 dark:text-white">
                Monarch IDE
              </h2>
              <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                Version 1.3
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs text-slate-700 dark:text-zinc-300">
          <p className="leading-relaxed text-slate-600 dark:text-zinc-400">
            Monarch IDE with Clockie H2 Extension Bridge support for browsing and editing connected cloud drives directly in the browser.
          </p>

          <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 divide-y divide-slate-200 dark:divide-zinc-800 font-mono text-[11.5px]">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-500 dark:text-zinc-400">Bridge Protocol</span>
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                H2_CLOUD_BRIDGE v1.3
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-500 dark:text-zinc-400">Bridge Status</span>
              <span className="capitalize text-slate-900 dark:text-zinc-100">
                {extensionStatus}
                {handshakeInfo?.sessionMode ? ` (${handshakeInfo.sessionMode})` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-500 dark:text-zinc-400">Access Mode</span>
              <span className="text-slate-900 dark:text-zinc-100">
                {handshakeInfo?.accessMode || 'Not connected'}
              </span>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-slate-500 dark:text-zinc-400">Target Host</span>
              <a
                href="https://ide.freshfood.rocks"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                <span>ide.freshfood.rocks</span>
              </a>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
