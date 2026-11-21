/**
 * Save / Save As Cloud Destination Modal.
 * Supports:
 * - Saving untitled scratchpad files (File -> New) to any connected cloud drive and folder.
 * - Saving existing workspace files to a new filename, folder, or different cloud drive (File -> Save As...).
 * - Quick selection of folders already loaded in the Explorer side panel as well as lazy browsing
 *   across all connected drives (H2_LIST_FOLDER_REQ) and inline folder creation (H2_CREATE_FOLDER_REQ).
 * - Overwrite confirmation if a file already exists at the destination path.
 * - Local "Download to Computer" fallback when disconnected or read-only.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 * - Monaco Editor Languages: https://microsoft.github.io/monaco-editor/
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Save,
  HardDrive,
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Laptop,
  Code2,
} from 'lucide-react';
import { CloudFile, CloudProvider, SelectedExplorerFolder } from '../types/ide';
import { getMonacoLanguage } from '../utils/fileSystem';
import { DriveEntriesResult } from './CloudFolderPickerModal';
import { H2CreateFolderRes, H2FolderMetadata } from '../utils/h2BridgeClient';

interface BreadcrumbSegment {
  label: string;
  path: string;
  folderId?: string;
}

export interface SaveAsConfirmParams {
  sourceFile: CloudFile;
  provider: CloudProvider;
  driveRoot: boolean;
  relativePath: string;
  existingFileId?: string;
  isOverwrite: boolean;
}

interface SaveAsModalProps {
  isOpen: boolean;
  targetFile: CloudFile | null;
  files: CloudFile[];
  selectedFolder?: SelectedExplorerFolder | null;
  isBridgeConnected: boolean;
  isReadOnly: boolean;
  canSave: boolean;
  canCreateFolders: boolean;
  availableDrives: CloudProvider[];
  defaultDrive: CloudProvider;
  listDriveEntries: (params: {
    provider: CloudProvider;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  }) => Promise<DriveEntriesResult>;
  createRawCloudFolder: (params: {
    provider: CloudProvider;
    driveRoot?: boolean;
    relativePath: string;
    parentRelativePath?: string;
    parentFolderId?: string;
    folderName?: string;
  }) => Promise<H2CreateFolderRes>;
  onConfirmSaveToCloud: (params: SaveAsConfirmParams) => Promise<boolean>;
  onDownloadLocalFallback: (sourceFile: CloudFile, filename: string) => void;
  onClose: () => void;
}

export const SaveAsModal: React.FC<SaveAsModalProps> = ({
  isOpen,
  targetFile,
  files,
  selectedFolder = null,
  isBridgeConnected,
  isReadOnly,
  canSave,
  canCreateFolders,
  availableDrives,
  defaultDrive,
  listDriveEntries,
  createRawCloudFolder,
  onConfirmSaveToCloud,
  onDownloadLocalFallback,
  onClose,
}) => {
  const driveOptions = useMemo(() => {
    const merged = Array.from(
      new Set([
        ...availableDrives.filter(d => d && d !== 'all'),
        ...(defaultDrive && defaultDrive !== 'all' ? [defaultDrive] : []),
      ])
    );
    return merged.length > 0 ? merged : ['pcloud'];
  }, [availableDrives, defaultDrive]);

  const [provider, setProvider] = useState<CloudProvider>(driveOptions[0]);
  const [folderPath, setFolderPath] = useState<string>('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [filename, setFilename] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);
  const [browserFolders, setBrowserFolders] = useState<H2FolderMetadata[]>([]);
  const [browserFiles, setBrowserFiles] = useState<string[]>([]);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overwritePending, setOverwritePending] = useState<{
    relativePath: string;
    existingFileId?: string;
    isSameAsSource: boolean;
  } | null>(null);

  const buildBreadcrumbsFromPath = useCallback((pathStr: string): BreadcrumbSegment[] => {
    const clean = pathStr.replace(/^\/+|\/+$/g, '');
    if (!clean) return [];
    const parts = clean.split('/').filter(Boolean);
    return parts.map((segment, index) => ({
      label: segment,
      path: parts.slice(0, index + 1).join('/'),
    }));
  }, []);

  // Currently loaded folders from the Explorer side panel for the active drive
  const explorerFoldersForDrive = useMemo(() => {
    const unique = new Map<string, CloudFile>();
    files.forEach(item => {
      if (
        item.isDirectory &&
        !item.isUntitled &&
        (!item.cloudProvider || item.cloudProvider === provider)
      ) {
        unique.set(item.path, item);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.path.localeCompare(b.path));
  }, [files, provider]);

  const loadFolder = useCallback(
    async (
      targetProvider: CloudProvider,
      targetPath: string,
      targetFolderId?: string,
      allowRootFallback = false
    ) => {
      const cleanPath = targetPath.replace(/^\/+|\/+$/g, '');
      setFolderPath(cleanPath);
      setCurrentFolderId(targetFolderId);
      setBreadcrumbs(prev => {
        const derived = buildBreadcrumbsFromPath(cleanPath);
        return derived.map(seg => {
          const match = prev.find(p => p.path === seg.path);
          return match?.folderId ? { ...seg, folderId: match.folderId } : seg;
        });
      });

      if (!isBridgeConnected) {
        // Offline / sample workspace fallback: list folders from currently loaded workspace state
        const localDirs = files
          .filter(
            f =>
              f.isDirectory &&
              f.cloudProvider === targetProvider &&
              (f.parentRelativePath || '') === cleanPath
          )
          .map(f => ({
            itemType: 'folder' as const,
            folderId: f.folderId,
            name: f.name,
            relativePath: f.path,
            parentRelativePath: f.parentRelativePath || '',
          }));
        setBrowserFolders(localDirs);
        setBrowserFiles(
          files
            .filter(
              f =>
                !f.isDirectory &&
                !f.isUntitled &&
                f.cloudProvider === targetProvider &&
                (f.parentRelativePath || '') === cleanPath
            )
            .map(f => f.name)
        );
        return;
      }

      setIsLoadingFolder(true);
      setError(null);
      setNotice(null);

      try {
        const res = await listDriveEntries({
          provider: targetProvider,
          basePath: cleanPath,
          baseFolderId: targetFolderId,
          maxDepth: 1,
        });

        const directFolders = res.folders
          .filter(f => f.relativePath !== cleanPath)
          .sort((a, b) => a.name.localeCompare(b.name));

        setBrowserFolders(directFolders);
        setBrowserFiles(res.files.map(f => f.name));
      } catch (err: any) {
        if (allowRootFallback && cleanPath) {
          setNotice(
            `Folder "${cleanPath}" could not be opened directly on ${targetProvider}. Showing drive root instead.`
          );
          try {
            const rootRes = await listDriveEntries({
              provider: targetProvider,
              basePath: '',
              maxDepth: 1,
            });
            setFolderPath('');
            setCurrentFolderId(undefined);
            setBreadcrumbs([]);
            setBrowserFolders(
              rootRes.folders
                .filter(f => f.relativePath !== '')
                .sort((a, b) => a.name.localeCompare(b.name))
            );
            setBrowserFiles(rootRes.files.map(f => f.name));
          } catch (rootErr: any) {
            setBrowserFolders([]);
            setBrowserFiles([]);
            setError(rootErr?.message || `Failed to list ${targetProvider} root`);
          }
        } else {
          setBrowserFolders([]);
          setBrowserFiles([]);
          setError(err?.message || `Failed to list folder "${cleanPath || '/'}"`);
        }
      } finally {
        setIsLoadingFolder(false);
      }
    },
    [isBridgeConnected, files, listDriveEntries, buildBreadcrumbsFromPath]
  );

  const initializedTargetKeyRef = React.useRef<string | null>(null);

  // Initialize modal values whenever opened (or target file changes), without clobbering edits on background refreshes
  useEffect(() => {
    if (!isOpen || !targetFile) {
      initializedTargetKeyRef.current = null;
      return;
    }

    const openKey = `${targetFile.id}:${targetFile.path}`;
    if (initializedTargetKeyRef.current === openKey) {
      return;
    }
    initializedTargetKeyRef.current = openKey;

    let initialProvider: CloudProvider;
    let initialFolder = '';
    let initialFolderId: string | undefined = undefined;

    if (targetFile.isUntitled) {
      // Untitled files default to the currently selected folder in the Explorer side panel
      initialProvider =
        selectedFolder?.provider && driveOptions.includes(selectedFolder.provider)
          ? selectedFolder.provider
          : driveOptions.includes(defaultDrive)
            ? defaultDrive
            : driveOptions[0];

      const matchesSelectedProvider =
        selectedFolder && (!selectedFolder.provider || selectedFolder.provider === initialProvider);
      initialFolder = matchesSelectedProvider
        ? selectedFolder.path.replace(/^\/+|\/+$/g, '')
        : '';
      initialFolderId = matchesSelectedProvider ? selectedFolder.folderId : undefined;
    } else {
      // Saved files default to their own current drive and parent folder
      initialProvider =
        targetFile.cloudProvider && driveOptions.includes(targetFile.cloudProvider)
          ? targetFile.cloudProvider
          : driveOptions.includes(defaultDrive)
            ? defaultDrive
            : driveOptions[0];
      initialFolder = (targetFile.parentRelativePath || '').replace(/^\/+|\/+$/g, '');
      initialFolderId = targetFile.parentId;
    }

    setProvider(initialProvider);
    setFilename(targetFile.name || 'Untitled-1');
    setShowNewFolderInput(false);
    setNewFolderName('');
    setError(null);
    setNotice(null);
    setOverwritePending(null);
    setIsSaving(false);

    loadFolder(initialProvider, initialFolder, initialFolderId, true);
  }, [isOpen, targetFile, selectedFolder, driveOptions, defaultDrive, loadFolder]);

  // Capture Escape so it closes only this dialog cleanly
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (overwritePending) {
          setOverwritePending(null);
        } else if (showNewFolderInput) {
          setShowNewFolderInput(false);
          setNewFolderName('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, overwritePending, showNewFolderInput, onClose]);

  if (!isOpen || !targetFile) return null;

  const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, '');
  const cleanFilename = filename.trim().replace(/^\/+|\/+$/g, '');
  const targetRelativePath = cleanFolder ? `${cleanFolder}/${cleanFilename}` : cleanFilename;
  const detectedLanguage = cleanFilename ? getMonacoLanguage(cleanFilename) : 'plaintext';

  const handleOpenSubfolder = (folder: H2FolderMetadata) => {
    const cleanSub = folder.relativePath.replace(/^\/+|\/+$/g, '');
    setOverwritePending(null);
    setBreadcrumbs(prev => {
      const base = buildBreadcrumbsFromPath(cleanSub);
      return base.map((seg, idx) => {
        if (idx === base.length - 1) {
          return { ...seg, folderId: folder.folderId };
        }
        const existing = prev.find(p => p.path === seg.path);
        return existing?.folderId ? { ...seg, folderId: existing.folderId } : seg;
      });
    });
    loadFolder(provider, cleanSub, folder.folderId, false);
  };

  const handleGoUp = () => {
    if (!cleanFolder) return;
    const parts = cleanFolder.split('/').filter(Boolean);
    const parentPath = parts.slice(0, -1).join('/');
    const parentSeg = breadcrumbs.find(b => b.path === parentPath);
    setOverwritePending(null);
    loadFolder(provider, parentPath, parentSeg?.folderId, false);
  };

  const handleCreateSubfolder = async () => {
    const trimmed = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed) return;
    if (!isBridgeConnected) {
      setError('Connect Clockie H2 to create new folders on your cloud drive.');
      return;
    }

    const fullNewFolderPath = cleanFolder ? `${cleanFolder}/${trimmed}` : trimmed;
    setIsCreatingFolder(true);
    setError(null);
    try {
      const res = await createRawCloudFolder({
        provider,
        driveRoot: true,
        relativePath: fullNewFolderPath,
        parentRelativePath: cleanFolder,
        parentFolderId: currentFolderId,
        folderName: trimmed.split('/').pop() || trimmed,
      });
      setShowNewFolderInput(false);
      setNewFolderName('');
      const createdPath = (res.relativePath || fullNewFolderPath).replace(/^\/+|\/+$/g, '');
      await loadFolder(provider, createdPath, res.folderId, false);
    } catch (err: any) {
      setError(err?.message || `Failed to create folder "${trimmed}"`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const performSave = async (existingFileId: string | undefined, isOverwrite: boolean) => {
    setIsSaving(true);
    setError(null);
    try {
      const ok = await onConfirmSaveToCloud({
        sourceFile: targetFile,
        provider,
        driveRoot: true,
        relativePath: targetRelativePath,
        existingFileId,
        isOverwrite,
      });
      if (ok) {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save file.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttemptSave = async () => {
    if (isSaving || overwritePending) return;

    if (!cleanFilename) {
      setError('Please enter a filename (e.g. notes.md or script.ts).');
      return;
    }

    if (!isBridgeConnected) {
      setError(
        'Extension bridge is disconnected. Connect Clockie H2 or use "Download to Computer" below.'
      );
      return;
    }

    if (isReadOnly || !canSave) {
      setError('Cloud workspace is read-only. Use "Download to Computer" to save a local copy.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const isSameAsSource =
        !targetFile.isUntitled &&
        provider === targetFile.cloudProvider &&
        targetRelativePath === targetFile.path;

      // Check loaded workspace files and live drive listing for an existing file collision
      let matchedFileId: string | undefined;
      let alreadyExists = false;

      const localMatch = files.find(
        f =>
          !f.isDirectory &&
          !f.isUntitled &&
          f.cloudProvider === provider &&
          f.path.toLowerCase() === targetRelativePath.toLowerCase()
      );
      if (localMatch) {
        alreadyExists = true;
        matchedFileId = localMatch.cloudFileId;
      }

      if (!alreadyExists && !cleanFilename.includes('/')) {
        try {
          const listing = await listDriveEntries({
            provider,
            basePath: cleanFolder,
            baseFolderId: currentFolderId,
            maxDepth: 1,
          });
          const match = listing.files.find(
            f =>
              f.name.toLowerCase() === cleanFilename.toLowerCase() ||
              f.relativePath.toLowerCase() === targetRelativePath.toLowerCase()
          );
          if (match) {
            alreadyExists = true;
            matchedFileId = match.fileId;
          }
        } catch {
          // Folder might not exist yet; H2_SAVE_FILE_REQ creates nested subdirectories automatically
        }
      }

      if (alreadyExists) {
        setOverwritePending({
          relativePath: targetRelativePath,
          existingFileId: matchedFileId ?? (isSameAsSource ? targetFile.cloudFileId : undefined),
          isSameAsSource,
        });
        setIsSaving(false);
        return;
      }

      await performSave(undefined, false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save file.');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={targetFile.isUntitled ? 'Save New File' : 'Save File As'}
        className="w-full max-w-2xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden select-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 shrink-0">
              <Save className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {targetFile.isUntitled ? `Save "${targetFile.name}"` : `Save "${targetFile.name}" As...`}
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-zinc-400 truncate">
                Choose a destination drive, folder (from Explorer or any connected drive), and filename.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Cloud Drive Switcher */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Destination Cloud Drive</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Switch drives to save anywhere
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {driveOptions.map(drive => (
                <button
                  key={drive}
                  type="button"
                  onClick={() => {
                    setProvider(drive);
                    setOverwritePending(null);
                    setShowNewFolderInput(false);
                    loadFolder(drive, '', undefined, false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition flex items-center gap-1.5 ${
                    provider === drive
                      ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                      : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-blue-400'
                  }`}
                >
                  <HardDrive className="w-3 h-3" />
                  <span>{drive}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Explorer Folders Quick-Pick (Loaded Side Panel Locations) */}
          {explorerFoldersForDrive.length > 0 && (
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Quick Jump to Loaded Explorer Folders ({provider})</span>
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40">
                <button
                  type="button"
                  onClick={() => {
                    setOverwritePending(null);
                    loadFolder(provider, '', undefined, false);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                    cleanFolder === ''
                      ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                      : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-emerald-400'
                  }`}
                >
                  / (Drive Root)
                </button>
                {explorerFoldersForDrive.map(dir => (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => {
                      setOverwritePending(null);
                      loadFolder(provider, dir.path, dir.folderId, false);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono border transition ${
                      cleanFolder === dir.path
                        ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                        : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-emerald-400'
                    }`}
                  >
                    {dir.path}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Folder Browser */}
          <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            {/* Browser Toolbar & Breadcrumbs */}
            <div className="px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/70 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap min-w-0 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    setOverwritePending(null);
                    loadFolder(provider, '', undefined, false);
                  }}
                  className="px-1.5 py-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 font-semibold"
                >
                  {provider}:/
                </button>
                {breadcrumbs.map(seg => (
                  <React.Fragment key={seg.path}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <button
                      type="button"
                      onClick={() => {
                        setOverwritePending(null);
                        loadFolder(provider, seg.path, seg.folderId, false);
                      }}
                      className="px-1.5 py-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate max-w-[140px]"
                      title={seg.path}
                    >
                      {seg.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {isBridgeConnected && canCreateFolders && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowNewFolderInput(prev => !prev)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-400 text-slate-700 dark:text-zinc-200 flex items-center gap-1 text-[11px] transition"
                    title="Create new subfolder here"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>New Folder</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleGoUp}
                  disabled={!cleanFolder || isLoadingFolder}
                  className="p-1.5 rounded border border-slate-200 dark:border-zinc-700 hover:bg-slate-200/70 dark:hover:bg-zinc-800 disabled:opacity-40 text-slate-600 dark:text-zinc-300 transition"
                  title="Up one folder"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => loadFolder(provider, cleanFolder, currentFolderId, false)}
                  disabled={isLoadingFolder}
                  className="p-1.5 rounded border border-slate-200 dark:border-zinc-700 hover:bg-slate-200/70 dark:hover:bg-zinc-800 disabled:opacity-40 text-slate-600 dark:text-zinc-300 transition"
                  title="Refresh folder contents"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFolder ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Inline New Folder Bar */}
            {showNewFolderInput && (
              <div className="px-3 py-2 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-500/30 flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateSubfolder();
                    }
                  }}
                  placeholder={`New folder inside ${cleanFolder || `${provider}:/`}`}
                  className="flex-1 px-2.5 py-1 rounded border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  onClick={handleCreateSubfolder}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-medium text-xs flex items-center gap-1 transition"
                >
                  {isCreatingFolder && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Create</span>
                </button>
              </div>
            )}

            {/* Subfolders List */}
            <div className="max-h-44 min-h-[120px] overflow-y-auto p-2 space-y-1 bg-white dark:bg-[#111114]">
              {isLoadingFolder ? (
                <div className="h-28 flex items-center justify-center gap-2 text-slate-500 dark:text-zinc-400">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span>Loading folders from {provider}...</span>
                </div>
              ) : browserFolders.length === 0 ? (
                <div className="h-24 flex flex-col items-center justify-center text-center text-slate-500 dark:text-zinc-500">
                  <Folder className="w-6 h-6 mb-1 opacity-40" />
                  <div>No subfolders in {cleanFolder ? `${provider}/${cleanFolder}` : `${provider}:/`}</div>
                  {browserFiles.length > 0 && (
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                      {browserFiles.length} file{browserFiles.length === 1 ? '' : 's'} currently in this folder
                    </div>
                  )}
                </div>
              ) : (
                browserFolders.map(folder => (
                  <div
                    key={`${folder.provider || provider}:${folder.relativePath}`}
                    onDoubleClick={() => handleOpenSubfolder(folder)}
                    onClick={() => handleOpenSubfolder(folder)}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/50 hover:border-blue-400 dark:hover:border-blue-500/60 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate font-medium text-slate-800 dark:text-zinc-200">
                        {folder.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0">
                      Open
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Manual Folder Path & Filename Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block font-medium text-slate-700 dark:text-zinc-300">
                Folder Path (empty = drive root)
              </label>
              <input
                type="text"
                value={folderPath}
                onChange={e => {
                  setFolderPath(e.target.value);
                  setCurrentFolderId(undefined);
                  setOverwritePending(null);
                }}
                placeholder="e.g. projects/notes"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700 dark:text-zinc-300">
                  Filename (with extension)
                </label>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-emerald-700 dark:text-emerald-400">
                  <Code2 className="w-3 h-3" />
                  <span>{detectedLanguage}</span>
                </span>
              </div>
              <input
                type="text"
                autoFocus
                value={filename}
                onChange={e => {
                  setFilename(e.target.value);
                  setOverwritePending(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !overwritePending) {
                    e.preventDefault();
                    handleAttemptSave();
                  }
                }}
                placeholder="example.ts"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Destination Path Preview */}
          <div className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-600 dark:text-zinc-400 break-all">
            Destination:{' '}
            <strong className="text-slate-900 dark:text-zinc-200">
              {cleanFilename ? `${provider}/${targetRelativePath}` : `${provider}/(enter filename)`}
            </strong>
          </div>

          {/* Notices / Errors */}
          {notice && (
            <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {(!isBridgeConnected || isReadOnly || !canSave) && (
            <div className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 text-[11.5px] text-blue-800 dark:text-blue-200">
              {!isBridgeConnected
                ? 'Clockie H2 bridge is currently disconnected. Connect the extension or click "Download to Computer" to save locally.'
                : 'Session is in read-only mode. Use "Download to Computer" to save a local copy.'}
            </div>
          )}

          {overwritePending && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-500/40 space-y-2.5">
              <div className="flex items-start gap-2 text-red-900 dark:text-red-100">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong>File already exists:</strong>{' '}
                  <span className="font-mono">
                    {provider}/{overwritePending.relativePath}
                  </span>{' '}
                  already exists on {provider}. Do you want to overwrite it?
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setOverwritePending(null)}
                  className="px-3 py-1 rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs transition"
                >
                  Change Name / Path
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => performSave(overwritePending.existingFileId, true)}
                  className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1.5 transition"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Overwrite File</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-xs text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <button
            type="button"
            onClick={() => {
              onDownloadLocalFallback(targetFile, cleanFilename || targetFile.name || 'untitled.txt');
              onClose();
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-medium flex items-center gap-1.5 transition"
            title="Download file directly to your local computer"
          >
            <Laptop className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Download to Computer</span>
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
              disabled={!isBridgeConnected || isReadOnly || !canSave || isSaving || Boolean(overwritePending)}
              onClick={handleAttemptSave}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white font-semibold flex items-center gap-1.5 transition"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{targetFile.isUntitled ? 'Save File' : 'Save As'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
