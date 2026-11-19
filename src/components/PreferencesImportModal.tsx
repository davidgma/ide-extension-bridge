/**
 * Import Preferences from JSON Modal (Step 1b).
 * Defaults to the most recent cloud folder used to import (or falls back to the
 * Export modal's configured folder), lets the user browse cloud drives and JSON files
 * via Clockie H2 Bridge v1.3, gives the import location just used precedence over any
 * path saved inside the imported JSON, and provides an always-available local file picker fallback.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - FileReader API: https://developer.mozilla.org/en-US/docs/Web/API/FileReader
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Folder,
  FileJson,
  HardDrive,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  AlertCircle,
  Laptop,
  Loader2,
  Check,
} from 'lucide-react';
import { CloudProvider, IdeSettings } from '../types/ide';
import { getCurrentYearString } from '../hooks/useIdeSettings';
import { DriveEntriesResult } from './CloudFolderPickerModal';
import { H2FileMetadata, H2FolderMetadata, H2ReadFileRes } from '../utils/h2BridgeClient';

interface BreadcrumbSegment {
  label: string;
  path: string;
  folderId?: string;
}

interface PreferencesImportModalProps {
  isOpen: boolean;
  settings: IdeSettings;
  isBridgeConnected: boolean;
  availableDrives: CloudProvider[];
  listDriveEntries: (params: {
    provider: CloudProvider;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  }) => Promise<DriveEntriesResult>;
  readRawCloudFile: (params: {
    provider: CloudProvider;
    relativePath: string;
    fileId?: string;
  }) => Promise<H2ReadFileRes>;
  onImportPreferences: (
    rawJson: unknown,
    importLocationUsed?: { provider: string; folder: string; filename: string }
  ) => IdeSettings;
  onImportSuccess: (message: string) => void;
  onClose: () => void;
}

export const PreferencesImportModal: React.FC<PreferencesImportModalProps> = ({
  isOpen,
  settings,
  isBridgeConnected,
  availableDrives,
  listDriveEntries,
  readRawCloudFile,
  onImportPreferences,
  onImportSuccess,
  onClose,
}) => {
  const [provider, setProvider] = useState<CloudProvider>('pcloud');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);
  const [folders, setFolders] = useState<H2FolderMetadata[]>([]);
  const [jsonFiles, setJsonFiles] = useState<H2FileMetadata[]>([]);
  const [selectedFile, setSelectedFile] = useState<H2FileMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localFileInputRef = useRef<HTMLInputElement>(null);

  const buildBreadcrumbsFromPath = useCallback((pathStr: string): BreadcrumbSegment[] => {
    const clean = pathStr.replace(/^\/+|\/+$/g, '');
    if (!clean) return [];
    const parts = clean.split('/').filter(Boolean);
    return parts.map((segment, index) => ({
      label: segment,
      path: parts.slice(0, index + 1).join('/'),
    }));
  }, []);

  const loadFolder = useCallback(
    async (
      targetProvider: CloudProvider,
      targetPath: string,
      preferredFilename?: string,
      targetFolderId?: string,
      allowRootFallback = false
    ) => {
      if (!isBridgeConnected) return;
      const cleanPath = targetPath.replace(/^\/+|\/+$/g, '');
      setIsLoading(true);
      setError(null);
      setNotice(null);
      setSelectedFile(null);

      try {
        const res = await listDriveEntries({
          provider: targetProvider,
          basePath: cleanPath,
          baseFolderId: targetFolderId,
          maxDepth: 1,
        });

        const sortedFolders = res.folders
          .filter(f => f.relativePath !== cleanPath)
          .sort((a, b) => a.name.localeCompare(b.name));

        const sortedJsonFiles = res.files
          .filter(f => f.name.toLowerCase().endsWith('.json'))
          .sort((a, b) => a.name.localeCompare(b.name));

        setFolders(sortedFolders);
        setJsonFiles(sortedJsonFiles);
        setCurrentPath(cleanPath);
        setCurrentFolderId(targetFolderId);
        setBreadcrumbs(prev => {
          const derived = buildBreadcrumbsFromPath(cleanPath);
          return derived.map(seg => {
            const match = prev.find(p => p.path === seg.path);
            return match?.folderId ? { ...seg, folderId: match.folderId } : seg;
          });
        });

        if (preferredFilename) {
          const match = sortedJsonFiles.find(
            f => f.name.toLowerCase() === preferredFilename.toLowerCase()
          );
          if (match) {
            setSelectedFile(match);
          }
        }
      } catch (err: any) {
        if (allowRootFallback && cleanPath) {
          setNotice(
            `Default folder "${cleanPath}" was not found on ${targetProvider}. Showing drive root instead.`
          );
          try {
            const rootRes = await listDriveEntries({
              provider: targetProvider,
              basePath: '',
              maxDepth: 1,
            });
            setFolders(
              rootRes.folders
                .filter(f => f.relativePath !== '')
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            setJsonFiles(
              rootRes.files
                .filter(f => f.name.toLowerCase().endsWith('.json'))
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            setCurrentPath('');
            setCurrentFolderId(undefined);
            setBreadcrumbs([]);
          } catch (rootErr: any) {
            setFolders([]);
            setJsonFiles([]);
            setError(rootErr?.message || `Failed to list ${targetProvider} root`);
          }
        } else {
          setFolders([]);
          setJsonFiles([]);
          setError(err?.message || `Failed to load folder "${cleanPath || '/'}"`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isBridgeConnected, listDriveEntries, buildBreadcrumbsFromPath]
  );

  // Determine initial folder: most recent import folder -> export folder -> pcloud root
  useEffect(() => {
    if (!isOpen) return;

    const hasLastImportFolder = Boolean(settings.preferencesLastImportFolder);
    const desiredProvider =
      (hasLastImportFolder ? settings.preferencesLastImportProvider : settings.preferencesExportProvider) ||
      settings.preferencesExportProvider ||
      'pcloud';
    const resolvedProvider = availableDrives.includes(desiredProvider)
      ? desiredProvider
      : availableDrives[0] || desiredProvider;

    const desiredFolder = hasLastImportFolder
      ? settings.preferencesLastImportFolder
      : settings.preferencesExportFolder || `${getCurrentYearString()}/downloads`;

    const preferredFile = hasLastImportFolder
      ? settings.preferencesLastImportFile
      : settings.preferencesExportFilename;

    setProvider(resolvedProvider);
    setCurrentPath(desiredFolder.replace(/^\/+|\/+$/g, ''));
    setCurrentFolderId(undefined);
    setBreadcrumbs(buildBreadcrumbsFromPath(desiredFolder));
    setSelectedFile(null);
    setNotice(null);
    setError(null);

    if (isBridgeConnected) {
      loadFolder(resolvedProvider, desiredFolder, preferredFile, undefined, true);
    } else {
      setFolders([]);
      setJsonFiles([]);
    }
  }, [isOpen, settings, isBridgeConnected, availableDrives, buildBreadcrumbsFromPath, loadFolder]);

  const validateAndApplyJsonText = useCallback(
    (
      rawText: string,
      sourceLabel: string,
      importLocationUsed?: { provider: string; folder: string; filename: string }
    ) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error(`"${sourceLabel}" is not valid JSON.`);
      }

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`"${sourceLabel}" does not contain a valid preferences JSON object.`);
      }

      onImportPreferences(parsed, importLocationUsed);
      onImportSuccess(`Imported preferences from ${sourceLabel}`);
      onClose();
    },
    [onImportPreferences, onImportSuccess, onClose]
  );

  const handleCloudImport = useCallback(
    async (fileOverride?: H2FileMetadata) => {
      const targetFile = fileOverride || selectedFile;
      if (!targetFile || isImporting) return;

      setIsImporting(true);
      setError(null);
      try {
        const res = await readRawCloudFile({
          provider: targetFile.provider || provider,
          relativePath: targetFile.relativePath,
          fileId: targetFile.fileId,
        });

        let textContent = res.content ?? '';
        if (res.encoding === 'base64' && textContent) {
          const cleanB64 = textContent.includes(',') ? textContent.split(',')[1] : textContent;
          textContent = atob(cleanB64);
        }

        const usedFolder = (targetFile.parentRelativePath ?? currentPath).replace(/^\/+|\/+$/g, '');
        validateAndApplyJsonText(
          textContent,
          `${targetFile.provider || provider}/${targetFile.relativePath}`,
          {
            provider: targetFile.provider || provider,
            folder: usedFolder,
            filename: targetFile.name,
          }
        );
      } catch (err: any) {
        setError(err?.message || `Failed to import "${targetFile.name}".`);
      } finally {
        setIsImporting(false);
      }
    },
    [selectedFile, isImporting, readRawCloudFile, provider, currentPath, validateAndApplyJsonText]
  );

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const text = (evt.target?.result as string) || '';
        validateAndApplyJsonText(text, file.name);
      } catch (err: any) {
        setError(err?.message || `Failed to read "${file.name}".`);
      }
    };
    reader.onerror = () => {
      setError(`Unable to read local file "${file.name}".`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Keyboard shortcuts: Escape closes modal, Enter imports selected cloud JSON file
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && selectedFile && !isImporting) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT') return;
        e.preventDefault();
        handleCloudImport();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedFile, isImporting, handleCloudImport, onClose]);

  if (!isOpen) return null;

  const handleOpenSubfolder = (folder: H2FolderMetadata) => {
    const cleanPath = folder.relativePath.replace(/^\/+|\/+$/g, '');
    setBreadcrumbs(prev => {
      const base = buildBreadcrumbsFromPath(cleanPath);
      return base.map((seg, idx) => {
        if (idx === base.length - 1) {
          return { ...seg, folderId: folder.folderId };
        }
        const existing = prev.find(p => p.path === seg.path);
        return existing?.folderId ? { ...seg, folderId: existing.folderId } : seg;
      });
    });
    loadFolder(provider, cleanPath, undefined, folder.folderId, false);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    const parentPath = parts.slice(0, -1).join('/');
    const parentSeg = breadcrumbs.find(b => b.path === parentPath);
    loadFolder(provider, parentPath, undefined, parentSeg?.folderId, false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import Preferences from JSON"
        className="w-full max-w-2xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden select-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Import Preferences from JSON
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-zinc-400">
                Choose a saved preferences JSON file from your cloud drives or upload one from your computer.
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

        {/* Cloud Drive Tabs */}
        {isBridgeConnected && (
          <>
            <div className="px-5 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Cloud Drives:</span>
              </span>
              {(availableDrives.length > 0 ? availableDrives : [provider]).map(drive => (
                <button
                  key={drive}
                  type="button"
                  onClick={() => {
                    setProvider(drive);
                    setBreadcrumbs([]);
                    loadFolder(drive, '', undefined, undefined, false);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono border transition ${
                    provider === drive
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                      : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-blue-400'
                  }`}
                >
                  {drive}
                </button>
              ))}
            </div>

            {/* Breadcrumbs + Actions */}
            <div className="px-5 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs bg-white dark:bg-[#141417]">
              <div className="flex items-center gap-1 flex-wrap min-w-0 font-mono">
                <button
                  type="button"
                  onClick={() => loadFolder(provider, '', undefined, undefined, false)}
                  className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 font-semibold"
                >
                  {provider}:/
                </button>
                {breadcrumbs.map(seg => (
                  <React.Fragment key={seg.path}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <button
                      type="button"
                      onClick={() => loadFolder(provider, seg.path, undefined, seg.folderId, false)}
                      className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate max-w-[160px]"
                      title={seg.path}
                    >
                      {seg.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleGoUp}
                  disabled={!currentPath || isLoading}
                  className="p-1.5 rounded border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-slate-600 dark:text-zinc-300 transition"
                  title="Up one folder"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => loadFolder(provider, currentPath, selectedFile?.name, currentFolderId, false)}
                  disabled={isLoading}
                  className="p-1.5 rounded border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-slate-600 dark:text-zinc-300 transition"
                  title="Refresh directory"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Notice & Error Messages */}
        {notice && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cloud Folder & File Listing */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[240px] bg-white dark:bg-[#0f0f11]">
          {!isBridgeConnected ? (
            <div className="h-52 flex flex-col items-center justify-center text-center gap-2 text-xs text-slate-500 dark:text-zinc-400 px-6">
              <HardDrive className="w-8 h-8 opacity-40 text-blue-600 dark:text-blue-400" />
              <div className="font-semibold text-slate-700 dark:text-zinc-200">
                Extension Bridge Not Connected
              </div>
              <p className="max-w-sm">
                Connect the Clockie H2 extension bridge to browse cloud folders, or use &quot;Import from Computer (.json)&quot; below.
              </p>
            </div>
          ) : isLoading ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Listing {provider}/{currentPath || ''}...</span>
            </div>
          ) : folders.length === 0 && jsonFiles.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center text-center gap-1.5 text-xs text-slate-500 dark:text-zinc-500">
              <FileJson className="w-7 h-7 opacity-40" />
              <div>No folders or .json files found in this directory.</div>
            </div>
          ) : (
            <>
              {folders.map(folder => (
                <div
                  key={`dir:${folder.provider || provider}:${folder.relativePath}`}
                  onClick={() => handleOpenSubfolder(folder)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 hover:border-blue-400 dark:hover:border-blue-500/50 text-xs text-slate-800 dark:text-zinc-200 cursor-pointer transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate font-medium">{folder.name}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </div>
              ))}

              {jsonFiles.map(file => {
                const isSelected = selectedFile?.relativePath === file.relativePath;
                return (
                  <div
                    key={`file:${file.provider || provider}:${file.relativePath}`}
                    onClick={() => setSelectedFile(file)}
                    onDoubleClick={() => handleCloudImport(file)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-500/70 text-emerald-950 dark:text-emerald-100'
                        : 'bg-white dark:bg-zinc-900/30 border-slate-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 text-slate-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileJson className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate font-mono">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500 dark:text-zinc-400">
                      {typeof file.sizeBytes === 'number' && (
                        <span>{(file.sizeBytes / 1024).toFixed(1)} KB</span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Selected File Summary */}
        {isBridgeConnected && (
          <div className="px-5 py-2 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 text-[11px] font-mono text-slate-600 dark:text-zinc-400 truncate">
            Selected:{' '}
            <strong className="text-slate-900 dark:text-zinc-200">
              {selectedFile ? `${provider}/${selectedFile.relativePath}` : 'Click a .json file above to select'}
            </strong>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <input
              ref={localFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleLocalFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => localFileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-medium flex items-center gap-1.5 transition"
              title="Choose a preferences JSON file from your computer"
            >
              <Laptop className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Import from Computer (.json)...</span>
            </button>
          </div>

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
              disabled={!isBridgeConnected || !selectedFile || isImporting}
              onClick={() => handleCloudImport()}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-45 text-white font-semibold flex items-center gap-1.5 transition"
            >
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Import</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
