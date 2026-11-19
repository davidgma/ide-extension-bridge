/**
 * Cloud Folder Picker Modal (Step 1b).
 * Popup browser launched from Preferences modals to list connected cloud drives
 * and lazily browse folders via Clockie H2 Bridge Protocol v1.3 (H2_LIST_FOLDER_REQ).
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  HardDrive,
  ChevronRight,
  ArrowUp,
  RefreshCw,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { CloudProvider } from '../types/ide';
import { H2FileMetadata, H2FolderMetadata } from '../utils/h2BridgeClient';

export interface DriveEntriesResult {
  provider: CloudProvider;
  basePath: string;
  rootName?: string;
  folders: H2FolderMetadata[];
  files: H2FileMetadata[];
}

interface BreadcrumbSegment {
  label: string;
  path: string;
  folderId?: string;
}

interface CloudFolderPickerModalProps {
  isOpen: boolean;
  title?: string;
  availableDrives: CloudProvider[];
  initialProvider: CloudProvider;
  initialFolder: string;
  listDriveEntries: (params: {
    provider: CloudProvider;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  }) => Promise<DriveEntriesResult>;
  onSelectFolder: (provider: CloudProvider, folderPath: string) => void;
  onClose: () => void;
}

export const CloudFolderPickerModal: React.FC<CloudFolderPickerModalProps> = ({
  isOpen,
  title = 'Choose Cloud Folder',
  availableDrives,
  initialProvider,
  initialFolder,
  listDriveEntries,
  onSelectFolder,
  onClose,
}) => {
  const resolvedInitialProvider =
    availableDrives.includes(initialProvider)
      ? initialProvider
      : availableDrives[0] || initialProvider || 'pcloud';

  const [provider, setProvider] = useState<CloudProvider>(resolvedInitialProvider);
  const [currentPath, setCurrentPath] = useState<string>(initialFolder.replace(/^\/+|\/+$/g, ''));
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);
  const [folders, setFolders] = useState<H2FolderMetadata[]>([]);
  const [selectedSubfolder, setSelectedSubfolder] = useState<H2FolderMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      targetFolderId?: string,
      allowRootFallback = false
    ) => {
      const cleanPath = targetPath.replace(/^\/+|\/+$/g, '');
      setIsLoading(true);
      setError(null);
      setNotice(null);
      setSelectedSubfolder(null);

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

        setFolders(directFolders);
        setCurrentPath(cleanPath);
        setCurrentFolderId(targetFolderId);
        setBreadcrumbs(prev => {
          const derived = buildBreadcrumbsFromPath(cleanPath);
          return derived.map(seg => {
            const match = prev.find(p => p.path === seg.path);
            return match?.folderId ? { ...seg, folderId: match.folderId } : seg;
          });
        });
      } catch (err: any) {
        if (allowRootFallback && cleanPath) {
          setNotice(
            `Folder "${cleanPath}" was not found on ${targetProvider}. Showing drive root instead.`
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
            setCurrentPath('');
            setCurrentFolderId(undefined);
            setBreadcrumbs([]);
          } catch (rootErr: any) {
            setFolders([]);
            setError(rootErr?.message || `Failed to list ${targetProvider} root`);
          }
        } else {
          setFolders([]);
          setError(err?.message || `Failed to list folder "${cleanPath || '/'}"`);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [listDriveEntries, buildBreadcrumbsFromPath]
  );

  // Initialize state and load initial folder whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const nextProvider =
      availableDrives.includes(initialProvider)
        ? initialProvider
        : availableDrives[0] || initialProvider || 'pcloud';
    const nextPath = initialFolder.replace(/^\/+|\/+$/g, '');
    setProvider(nextProvider);
    setCurrentPath(nextPath);
    setCurrentFolderId(undefined);
    setBreadcrumbs(buildBreadcrumbsFromPath(nextPath));
    loadFolder(nextProvider, nextPath, undefined, true);
  }, [isOpen, initialProvider, initialFolder, availableDrives, buildBreadcrumbsFromPath, loadFolder]);

  // Handle Escape and Enter inside child picker without closing parent modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

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
    loadFolder(provider, cleanPath, folder.folderId, false);
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    const parentPath = parts.slice(0, -1).join('/');
    const parentSeg = breadcrumbs.find(b => b.path === parentPath);
    loadFolder(provider, parentPath, parentSeg?.folderId, false);
  };

  const effectiveChosenPath = selectedSubfolder
    ? selectedSubfolder.relativePath.replace(/^\/+|\/+$/g, '')
    : currentPath;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 dark:bg-black/75 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xl bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden select-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected Drives Selector */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/40 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Drives:</span>
          </span>
          {availableDrives.map(drive => (
            <button
              key={drive}
              type="button"
              onClick={() => {
                setProvider(drive);
                setBreadcrumbs([]);
                loadFolder(drive, '', undefined, false);
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

        {/* Breadcrumb & Toolbar */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs bg-white dark:bg-[#141417]">
          <div className="flex items-center gap-1 flex-wrap min-w-0 font-mono">
            <button
              type="button"
              onClick={() => loadFolder(provider, '', undefined, false)}
              className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-blue-600 dark:text-blue-400 font-semibold"
            >
              {provider}:/
            </button>
            {breadcrumbs.map(seg => (
              <React.Fragment key={seg.path}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => loadFolder(provider, seg.path, seg.folderId, false)}
                  className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 truncate max-w-[140px]"
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
              onClick={() => loadFolder(provider, currentPath, currentFolderId, false)}
              disabled={isLoading}
              className="p-1.5 rounded border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40 text-slate-600 dark:text-zinc-300 transition"
              title="Refresh folder contents"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notice / Error */}
        {notice && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/40 text-xs text-red-800 dark:text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-[220px] bg-white dark:bg-[#0f0f11]">
          {isLoading ? (
            <div className="h-44 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Loading folders from {provider}...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-slate-500 dark:text-zinc-500 px-4">
              <Folder className="w-7 h-7 mb-2 opacity-40" />
              <div>No subfolders inside this directory.</div>
              <div className="text-[11px] mt-1">
                Click &quot;Select Folder&quot; below to choose {provider}:/{currentPath || ''}.
              </div>
            </div>
          ) : (
            folders.map(folder => {
              const isSelected = selectedSubfolder?.relativePath === folder.relativePath;
              return (
                <div
                  key={`${folder.provider || provider}:${folder.relativePath}`}
                  onClick={() => setSelectedSubfolder(isSelected ? null : folder)}
                  onDoubleClick={() => handleOpenSubfolder(folder)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-500/60 text-blue-900 dark:text-blue-100'
                      : 'bg-slate-50/60 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-zinc-700 text-slate-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate font-medium">{folder.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenSubfolder(folder);
                    }}
                    className="px-2 py-0.5 rounded text-[11px] bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:border-blue-400 text-slate-600 dark:text-zinc-300 transition shrink-0"
                  >
                    Open
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-mono text-[11px] text-slate-600 dark:text-zinc-400 truncate max-w-[300px]">
            Target:{' '}
            <strong className="text-slate-900 dark:text-zinc-200">
              {provider}/{effectiveChosenPath || ''}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSelectFolder(provider, effectiveChosenPath);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
