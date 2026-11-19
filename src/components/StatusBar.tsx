/**
 * Bottom IDE Status Bar (Step 2).
 * Displays a compact clickable Bridge status badge (opening Extension Bridge Status),
 * status toast notifications, active provider, cursor coordinates, tab spaces,
 * encoding, and active language.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React from 'react';
import {
  Plug,
  HardDrive,
  Bell,
  Lock,
} from 'lucide-react';
import { CloudFile, ExtensionStatus } from '../types/ide';
import { getMonacoLanguage } from '../utils/fileSystem';

interface StatusBarProps {
  activeFile: CloudFile | null;
  cursorPos: { line: number; col: number };
  selectionLength: number;
  tabSize?: number;
  extensionStatus: ExtensionStatus;
  isReadOnly: boolean;
  statusNotification: string | null;
  onOpenBridgeStatus: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  cursorPos,
  selectionLength,
  tabSize = 2,
  extensionStatus,
  isReadOnly,
  statusNotification,
  onOpenBridgeStatus,
}) => {
  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';

  return (
    <footer className="h-6 bg-slate-100 dark:bg-[#18181b] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between px-3 text-[11px] select-auto text-slate-600 dark:text-zinc-400 font-mono z-20 shrink-0">
      {/* Left: Compact Bridge Badge, Toast & Active Provider */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenBridgeStatus}
          title="Open Extension Bridge Status"
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-medium border transition cursor-pointer shrink-0 ${
            extensionStatus === 'connected'
              ? isReadOnly
                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40 hover:bg-red-100 dark:hover:bg-red-900/60'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
              : extensionStatus === 'connecting'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/40 hover:bg-blue-100 dark:hover:bg-blue-900/60'
              : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 hover:border-blue-400 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          {extensionStatus === 'connected' ? (
            isReadOnly ? (
              <>
                <Lock className="w-2.5 h-2.5" />
                <span>Read-Only</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
                <span>Connected</span>
              </>
            )
          ) : extensionStatus === 'connecting' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 inline-block animate-pulse" />
              <span>Connecting</span>
            </>
          ) : (
            <>
              <Plug className="w-2.5 h-2.5" />
              <span>Offline</span>
            </>
          )}
        </button>

        {/* Status notification toast */}
        {statusNotification && (
          <div className="hidden md:flex items-center gap-1 text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-slate-300 dark:border-zinc-700/60">
            <Bell className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate max-w-[260px]">{statusNotification}</span>
          </div>
        )}

        {/* Active Cloud Provider */}
        {activeFile && (
          <div className="hidden lg:flex items-center gap-1 text-slate-600 dark:text-zinc-400">
            <HardDrive className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
            <span>{activeFile.cloudProvider}</span>
          </div>
        )}
      </div>

      {/* Right: Editor metrics (shown when a file tab is active) */}
      {activeFile && (
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-slate-700 dark:text-zinc-300">
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            {selectionLength > 0 && (
              <span className="text-slate-400 dark:text-zinc-500 ml-1">({selectionLength} sel)</span>
            )}
          </div>

          <div className="hidden sm:block text-slate-600 dark:text-zinc-400">Spaces: {tabSize}</div>
          <div className="hidden sm:block text-slate-600 dark:text-zinc-400">
            {activeFile.encoding === 'base64' ? 'Base64' : 'UTF-8'}
          </div>

          <div className="capitalize text-emerald-700 dark:text-emerald-400 font-medium bg-white dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
            {language}
          </div>
        </div>
      )}
    </footer>
  );
};
