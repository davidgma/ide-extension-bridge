/**
 * Export Preferences to JSON Modal (Step 1b).
 * Exports all IDE preferences to a connected cloud drive (defaulting to
 * `pcloud/<yyyy>/downloads/ide-preferences-<yyyy-MM-dd>.json`) via the Clockie H2 Bridge,
 * supports choosing another cloud folder via a popup browser modal, asks overwrite confirmation
 * when the destination file already exists, and provides an always-available local download fallback.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Blob & Object URLs: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Download,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  HardDrive,
  Laptop,
  Loader2,
} from 'lucide-react';
import { CloudProvider, IdeSettings } from '../types/ide';
import { buildDatedPreferencesFilename, getCurrentYearString } from '../hooks/useIdeSettings';
import { CloudFolderPickerModal, DriveEntriesResult } from './CloudFolderPickerModal';
import { H2SaveFileRes } from '../utils/h2BridgeClient';

interface PreferencesExportModalProps {
  isOpen: boolean;
  settings: IdeSettings;
  isBridgeConnected: boolean;
  isReadOnly: boolean;
  canSave: boolean;
  availableDrives: CloudProvider[];
  listDriveEntries: (params: {
    provider: CloudProvider;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  }) => Promise<DriveEntriesResult>;
  saveRawCloudFile: (params: {
    provider: CloudProvider;
    relativePath: string;
    fileId?: string;
    content: string;
  }) => Promise<H2SaveFileRes>;
  onPersistExportOptions: (patch: Partial<IdeSettings>) => void;
  onExportSuccess: (message: string) => void;
  onClose: () => void;
}

export const PreferencesExportModal: React.FC<PreferencesExportModalProps> = ({
  isOpen,
  settings,
  isBridgeConnected,
  isReadOnly,
  canSave,
  availableDrives,
  listDriveEntries,
  saveRawCloudFile,
  onPersistExportOptions,
  onExportSuccess,
  onClose,
}) => {
  const [provider, setProvider] = useState<CloudProvider>(settings.preferencesExportProvider || 'pcloud');
  const [folderPath, setFolderPath] = useState<string>(
    settings.preferencesExportFolder || `${getCurrentYearString()}/downloads`
  );
  const [filename, setFilename] = useState<string>(settings.preferencesExportFilename);
  const [useAutoDate, setUseAutoDate] = useState<boolean>(settings.preferencesUseAutoDateFilename);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);

  const [isCheckingOrSaving, setIsCheckingOrSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overwritePending, setOverwritePending] = useState<{
    relativePath: string;
    fileId?: string;
  } | null>(null);

  // Sync fields each time the modal opens, updating filename to today's date when auto-date is active
  useEffect(() => {
    if (!isOpen) return;
    const defaultProvider =
      settings.preferencesExportProvider ||
      (availableDrives.includes('pcloud') ? 'pcloud' : availableDrives[0] || 'pcloud');
    const defaultFolder =
      settings.preferencesExportFolder || `${getCurrentYearString()}/downloads`;
    const autoDate = settings.preferencesUseAutoDateFilename;
    const resolvedFilename = autoDate
      ? buildDatedPreferencesFilename()
      : settings.preferencesExportFilename || buildDatedPreferencesFilename();

    setProvider(defaultProvider);
    setFolderPath(defaultFolder);
    setFilename(resolvedFilename);
    setUseAutoDate(autoDate);
    setError(null);
    setOverwritePending(null);
    setIsFolderPickerOpen(false);
  }, [isOpen, settings, availableDrives]);

  const normalizeFilename = (raw: string): string => {
    const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) return '';
    return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
  };

  const buildUpdatedSettingsPayload = useCallback(
    (finalFilename: string, cleanFolder: string) => {
      const patch: Partial<IdeSettings> = {
        preferencesExportProvider: provider,
        preferencesExportFolder: cleanFolder,
        preferencesExportFilename: finalFilename,
        preferencesUseAutoDateFilename: useAutoDate,
      };
      onPersistExportOptions(patch);
      const merged: IdeSettings = {
        ...settings,
        ...patch,
      };
      return JSON.stringify(merged, null, 2);
    },
    [provider, useAutoDate, settings, onPersistExportOptions]
  );

  const executeCloudSave = useCallback(
    async (relativePath: string, cleanFolder: string, finalFilename: string, existingFileId?: string) => {
      setIsCheckingOrSaving(true);
      setError(null);
      try {
        const jsonText = buildUpdatedSettingsPayload(finalFilename, cleanFolder);
        await saveRawCloudFile({
          provider,
          relativePath,
          fileId: existingFileId,
          content: jsonText,
        });
        setOverwritePending(null);
        onExportSuccess(`Exported preferences to ${provider}/${relativePath}`);
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to save preferences file to cloud drive.');
      } finally {
        setIsCheckingOrSaving(false);
      }
    },
    [provider, buildUpdatedSettingsPayload, saveRawCloudFile, onExportSuccess, onClose]
  );

  const handleCloudExport = useCallback(async () => {
    if (overwritePending || isFolderPickerOpen || isCheckingOrSaving) return;

    const finalFilename = normalizeFilename(filename);
    if (!finalFilename) {
      setError('Please enter a filename before exporting.');
      return;
    }

    if (!isBridgeConnected) {
      setError('Extension bridge is disconnected. Connect Clockie H2 or use Download to Computer (.json) below.');
      return;
    }

    if (isReadOnly || !canSave) {
      setError('Cloud workspace is in read-only mode. Use Download to Computer (.json) below.');
      return;
    }

    const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
    const targetRelativePath = cleanFolder ? `${cleanFolder}/${finalFilename}` : finalFilename;

    setIsCheckingOrSaving(true);
    setError(null);

    try {
      // Check if destination file already exists so we can ask overwrite confirmation
      let matchedFileId: string | undefined;
      let fileAlreadyExists = false;

      try {
        const listing = await listDriveEntries({
          provider,
          basePath: cleanFolder,
          maxDepth: 1,
        });
        const match = listing.files.find(
          f =>
            f.name.toLowerCase() === finalFilename.toLowerCase() ||
            f.relativePath.toLowerCase() === targetRelativePath.toLowerCase()
        );
        if (match) {
          fileAlreadyExists = true;
          matchedFileId = match.fileId;
        }
      } catch {
        // Folder may not exist yet; H2_SAVE_FILE_REQ creates nested subdirectories automatically
        fileAlreadyExists = false;
      }

      if (fileAlreadyExists) {
        setOverwritePending({
          relativePath: targetRelativePath,
          fileId: matchedFileId,
        });
        setIsCheckingOrSaving(false);
        return;
      }

      await executeCloudSave(targetRelativePath, cleanFolder, finalFilename);
    } catch (err: any) {
      setError(err?.message || 'Export failed.');
      setIsCheckingOrSaving(false);
    }
  }, [
    overwritePending,
    isFolderPickerOpen,
    isCheckingOrSaving,
    filename,
    isBridgeConnected,
    isReadOnly,
    canSave,
    folderPath,
    listDriveEntries,
    provider,
    executeCloudSave,
  ]);

  const handleLocalDownloadFallback = () => {
    const finalFilename = normalizeFilename(filename) || buildDatedPreferencesFilename();
    const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
    const jsonText = buildUpdatedSettingsPayload(finalFilename, cleanFolder);

    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    link.click();
    URL.revokeObjectURL(url);

    onExportSuccess(`Downloaded ${finalFilename} to computer`);
    onClose();
  };

  // Keyboard shortcuts: Escape cancels/closes, Enter submits Export (or confirms overwrite)
  useEffect(() => {
    if (!isOpen || isFolderPickerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (overwritePending) {
          setOverwritePending(null);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON') return;
        e.preventDefault();
        if (overwritePending) {
          const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
          const finalFilename = normalizeFilename(filename);
          if (finalFilename) {
            executeCloudSave(
              overwritePending.relativePath,
              cleanFolder,
              finalFilename,
              overwritePending.fileId
            );
          }
        } else {
          handleCloudExport();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    isFolderPickerOpen,
    overwritePending,
    folderPath,
    filename,
    executeCloudSave,
    handleCloudExport,
    onClose,
  ]);

  if (!isOpen) return null;

  const cleanFolderDisplay = folderPath.trim().replace(/^\/+|\/+$/g, '');
  const finalNameDisplay = normalizeFilename(filename) || '(filename required)';
  const fullTargetPreview = cleanFolderDisplay
    ? `${provider}/${cleanFolderDisplay}/${finalNameDisplay}`
    : `${provider}/${finalNameDisplay}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Export Preferences to JSON"
          className="w-full max-w-lg bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden select-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Export Preferences to JSON
                </h2>
                <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                  Save IDE settings to a connected cloud folder or download to your computer.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            {/* Cloud Drive & Folder */}
            <div className="space-y-1.5">
              <label className="block font-medium text-slate-700 dark:text-zinc-300">
                Cloud Folder Destination
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-900 font-mono text-slate-800 dark:text-zinc-200 shrink-0">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <select
                    value={provider}
                    onChange={e => {
                      setProvider(e.target.value);
                      setOverwritePending(null);
                    }}
                    className="bg-transparent focus:outline-none text-xs font-mono"
                    aria-label="Cloud Drive"
                  >
                    {(availableDrives.length > 0 ? availableDrives : [provider]).map(drive => (
                      <option
                        key={drive}
                        value={drive}
                        className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                      >
                        {drive}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  value={folderPath}
                  onChange={e => {
                    setFolderPath(e.target.value);
                    setOverwritePending(null);
                  }}
                  placeholder="2026/downloads"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />

                <button
                  type="button"
                  disabled={!isBridgeConnected}
                  onClick={() => setIsFolderPickerOpen(true)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-45 text-slate-800 dark:text-zinc-200 font-medium flex items-center gap-1.5 shrink-0 transition"
                  title={
                    isBridgeConnected
                      ? 'Browse connected cloud drives and folders'
                      : 'Connect extension bridge to browse cloud folders'
                  }
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Choose Folder...</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Missing subdirectories are created automatically when saving through Clockie H2.
              </p>
            </div>

            {/* Filename */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700 dark:text-zinc-300">
                  Filename
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setUseAutoDate(true);
                    setFilename(buildDatedPreferencesFilename());
                    setOverwritePending(null);
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Calendar className="w-3 h-3" />
                  <span>Use Today&apos;s Date</span>
                </button>
              </div>
              <input
                type="text"
                value={filename}
                onChange={e => {
                  const val = e.target.value;
                  setFilename(val);
                  setUseAutoDate(val.trim() === buildDatedPreferencesFilename());
                  setOverwritePending(null);
                }}
                placeholder={buildDatedPreferencesFilename()}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={useAutoDate}
                  onChange={e => {
                    const checked = e.target.checked;
                    setUseAutoDate(checked);
                    if (checked) {
                      setFilename(buildDatedPreferencesFilename());
                      setOverwritePending(null);
                    }
                  }}
                  className="rounded border-slate-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                />
                <span>Automatically update default filename to today&apos;s date</span>
              </label>
            </div>

            {/* Destination Preview */}
            <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-600 dark:text-zinc-400 break-all">
              Destination: <strong className="text-slate-900 dark:text-zinc-200">{fullTargetPreview}</strong>
            </div>

            {/* Read-only / Disconnected Info */}
            {(!isBridgeConnected || isReadOnly || !canSave) && (
              <div className="px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 text-[11.5px] text-blue-800 dark:text-blue-200">
                {!isBridgeConnected
                  ? 'Extension bridge is not connected. You can still export directly using "Download to Computer (.json)".'
                  : 'Cloud workspace is currently read-only. Use "Download to Computer (.json)" to save locally.'}
              </div>
            )}

            {/* Overwrite Confirmation Prompt */}
            {overwritePending && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-500/40 space-y-2.5">
                <div className="flex items-start gap-2 text-red-900 dark:text-red-100">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong>File already exists:</strong>{' '}
                    <span className="font-mono">{provider}/{overwritePending.relativePath}</span> already exists on your cloud drive. Do you want to overwrite it?
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isCheckingOrSaving}
                    onClick={() => setOverwritePending(null)}
                    className="px-3 py-1 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={isCheckingOrSaving}
                    onClick={() => {
                      const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
                      const finalFilename = normalizeFilename(filename);
                      if (finalFilename) {
                        executeCloudSave(
                          overwritePending.relativePath,
                          cleanFolder,
                          finalFilename,
                          overwritePending.fileId
                        );
                      }
                    }}
                    className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                  >
                    {isCheckingOrSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Overwrite File</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-xs text-red-800 dark:text-red-200">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={handleLocalDownloadFallback}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-medium flex items-center gap-1.5 transition"
              title="Download preferences JSON directly to your computer"
            >
              <Laptop className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Download to Computer (.json)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isBridgeConnected || isReadOnly || !canSave || isCheckingOrSaving || Boolean(overwritePending)}
                onClick={handleCloudExport}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-semibold flex items-center gap-1.5 transition"
              >
                {isCheckingOrSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popup Cloud Drive / Folder Picker Modal */}
      <CloudFolderPickerModal
        isOpen={isFolderPickerOpen}
        title="Choose Export Cloud Folder"
        availableDrives={availableDrives.length > 0 ? availableDrives : [provider]}
        initialProvider={provider}
        initialFolder={folderPath}
        listDriveEntries={listDriveEntries}
        onSelectFolder={(pickedProvider, pickedFolder) => {
          setProvider(pickedProvider);
          setFolderPath(pickedFolder);
          setOverwritePending(null);
        }}
        onClose={() => setIsFolderPickerOpen(false)}
      />
    </>
  );
};
