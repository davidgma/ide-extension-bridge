/**
 * Unsaved Changes Tab Close Confirmation Modal.
 * Prompts the user when closing one or more editor tabs that contain unsaved edits,
 * avoiding browser window.confirm() per runtime guidelines.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useEffect } from 'react';
import { AlertTriangle, Save, Trash2, X } from 'lucide-react';
import { CloudFile } from '../types/ide';

export interface PendingTabCloseRequest {
  mode: 'single' | 'all' | 'others';
  keepFileId?: string;
  targetFileIds: string[];
  dirtyFiles: CloudFile[];
}

interface UnsavedChangesModalProps {
  request: PendingTabCloseRequest | null;
  onSaveAndClose: () => void;
  onDiscardAndClose: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  request,
  onSaveAndClose,
  onDiscardAndClose,
  onCancel,
}) => {
  useEffect(() => {
    if (!request) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [request, onCancel]);

  if (!request) return null;

  const isSingle = request.dirtyFiles.length === 1;
  const singleFile = isSingle ? request.dirtyFiles[0] : null;
  const hasUntitled = request.dirtyFiles.some(f => f.isUntitled);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved Changes"
        className="w-full max-w-md bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden select-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Unsaved Changes
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-xs text-slate-700 dark:text-zinc-300">
          {isSingle && singleFile ? (
            <p className="leading-relaxed">
              Do you want to save the changes you made to{' '}
              <strong className="font-mono text-slate-900 dark:text-white">
                {singleFile.name}
              </strong>
              ?
            </p>
          ) : (
            <>
              <p className="leading-relaxed">
                Do you want to save the changes you made to the following{' '}
                <strong>{request.dirtyFiles.length}</strong> files before closing?
              </p>
              <ul className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-2 space-y-1 font-mono text-[11px]">
                {request.dirtyFiles.map(file => (
                  <li key={file.id} className="truncate text-slate-800 dark:text-zinc-200">
                    • {file.isUntitled ? `${file.name} (Untitled)` : file.path}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            Your changes will be lost if you don&apos;t save them.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscardAndClose}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Don&apos;t Save</span>
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {isSingle && hasUntitled
                ? 'Save As...'
                : isSingle
                  ? 'Save'
                  : 'Save All & Close'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
