/**
 * Workspace File Explorer Sidebar (H2_CLOUD_BRIDGE v1.4).
 * Displays folders (including empty & lazily-loaded subdirectories where childrenLoaded === false)
 * and files from H2_WORKSPACE_TREE / H2_LIST_FOLDER_RES.
 * Supports nested file & folder creation (H2_SAVE_FILE_REQ / H2_CREATE_FOLDER_REQ),
 * dedicated deletion (H2_DELETE_FILE_REQ / H2_DELETE_FOLDER_REQ), same-drive drag & drop / inline
 * rename (H2_MOVE_FILE_REQ / H2_MOVE_FOLDER_REQ), multi-drive switching, and read-only enforcement.
 *
 * Official Documentation:
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 * - HTML Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileJson,
  Code2,
  Terminal,
  Database,
  Image as ImageIcon,
  Film,
  Plus,
  FolderPlus,
  Upload,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  FolderTree,
  Trash2,
  Edit2,
  HardDrive,
  RotateCw,
  EyeOff,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { CloudFile, FileTreeNode, CloudProvider, H2DriveStatus, H2LaunchedScope } from '../types/ide';
import { getFileExtension, isImageFile, isVideoFile, buildFileTree } from '../utils/fileSystem';

export interface SidebarFolderActionSignal {
  action: 'collapse' | 'expand-lazy' | 'expand-full';
  nonce: number;
}

export interface SidebarMoveConflict {
  itemType: 'file' | 'folder';
  provider: CloudProvider;
  driveRoot: boolean;
  itemId?: string;
  oldRelativePath: string;
  targetRelativePath: string;
  suggestedRelativePath: string;
  errorMessage: string;
}

interface DraggingItem {
  itemType: 'file' | 'folder';
  id?: string;
  path: string;
  name: string;
  parentPath: string;
  provider: CloudProvider;
}

interface SidebarProps {
  files: CloudFile[];
  activeFileId: string | null;
  cloudProvider: CloudProvider;
  workspaceName: string;
  isConnected: boolean;
  isReadOnly: boolean;
  canCreateFiles: boolean;
  canCreateFolders: boolean;
  canDeleteFiles: boolean;
  canDeleteFolders: boolean;
  canMoveFiles: boolean;
  canMoveFolders: boolean;
  defaultFoldersExpanded?: boolean;
  folderActionSignal?: SidebarFolderActionSignal | null;
  moveConflict?: SidebarMoveConflict | null;
  drives?: Record<string, H2DriveStatus>;
  selectedDrive?: CloudProvider;
  launchedScope?: H2LaunchedScope | null;
  driveRootActive?: boolean;
  onSelectDrive?: (drive: CloudProvider) => void;
  onReturnToLaunchedScope?: () => void;
  onRefreshTree?: () => void;
  onExpandFolder: (folder: CloudFile) => void;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (path: string, content?: string) => void;
  onCreateFolder: (folderPath: string, parentFolderId?: string, parentProvider?: CloudProvider) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderPath: string, folderId?: string, folderProvider?: CloudProvider) => void;
  onRenameFile: (fileId: string, newPath: string) => void;
  onRenameFolder: (folderPath: string, newFolderPath: string, folderId?: string, folderProvider?: CloudProvider) => void;
  onMoveItem: (params: {
    itemType: 'file' | 'folder';
    sourcePath: string;
    targetFolderPath: string;
    itemId?: string;
    sourceProvider: CloudProvider;
    targetProvider: CloudProvider;
  }) => void;
  onResolveMoveConflictOverwrite: () => void;
  onResolveMoveConflictRename: (newRelativePath: string) => void;
  onDismissMoveConflict: () => void;
  onCrossDriveDropBlocked?: (sourceProvider: CloudProvider, targetProvider: CloudProvider) => void;
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  activeFileId,
  cloudProvider,
  workspaceName,
  isConnected,
  isReadOnly,
  canCreateFiles,
  canCreateFolders,
  canDeleteFiles,
  canDeleteFolders,
  canMoveFiles,
  canMoveFolders,
  defaultFoldersExpanded = false,
  folderActionSignal = null,
  moveConflict = null,
  drives,
  selectedDrive,
  launchedScope,
  driveRootActive,
  onSelectDrive,
  onReturnToLaunchedScope,
  onRefreshTree,
  onExpandFolder,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
  onRenameFolder,
  onMoveItem,
  onResolveMoveConflictOverwrite,
  onResolveMoveConflictRename,
  onDismissMoveConflict,
  onCrossDriveDropBlocked,
  onUploadFiles,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [folderOpenOverrides, setFolderOpenOverrides] = useState<Record<string, boolean>>({});
  const [isFullExpanding, setIsFullExpanding] = useState(false);
  const fullExpandCountRef = useRef(0);
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newPathInput, setNewPathInput] = useState('');
  const [newFolderContext, setNewFolderContext] = useState<{
    parentFolderId?: string;
    parentProvider?: CloudProvider;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<{
    path: string;
    folderId?: string;
    provider?: CloudProvider;
  } | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<DraggingItem | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [dropInvalidReason, setDropInvalidReason] = useState<
    'same-parent' | 'self-or-child' | 'cross-drive' | null
  >(null);
  const [conflictRenameInput, setConflictRenameInput] = useState('');

  const fileCount = React.useMemo(
    () => files.filter(f => !f.isDirectory && !f.isUntitled).length,
    [files]
  );

  const connectedDrives = React.useMemo(() => {
    if (!drives) return [];
    return Object.entries(drives).filter(([, status]) => status?.connected);
  }, [drives]);

  // Filter files if searching (untitled files live strictly in the tab bar until saved)
  const filteredFiles = React.useMemo(
    () =>
      files.filter(
        f =>
          !f.isUntitled &&
          (!searchTerm ||
            f.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.name.toLowerCase().includes(searchTerm.toLowerCase()))
      ),
    [files, searchTerm]
  );

  const fileTree = React.useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

  // Reset folder overrides when default folder state preference, provider, or workspace changes
  useEffect(() => {
    setFolderOpenOverrides({});
    setIsFullExpanding(false);
    fullExpandCountRef.current = 0;
  }, [defaultFoldersExpanded, cloudProvider, workspaceName]);

  // Sync suggested path whenever a new move/rename collision occurs
  useEffect(() => {
    if (moveConflict) {
      setConflictRenameInput(moveConflict.suggestedRelativePath);
    } else {
      setConflictRenameInput('');
    }
  }, [moveConflict]);

  const isFolderCurrentlyExpanded = useCallback(
    (node: FileTreeNode): boolean => {
      if (Object.prototype.hasOwnProperty.call(folderOpenOverrides, node.path)) {
        return folderOpenOverrides[node.path];
      }
      if (node.file?.childrenLoaded === false) {
        return false;
      }
      return defaultFoldersExpanded;
    },
    [folderOpenOverrides, defaultFoldersExpanded]
  );

  // Progressively expand and fetch nested unloaded lazy folders when "Expand All - Full" is active
  useEffect(() => {
    if (!isFullExpanding) return;

    const unloadedFolders = files.filter(
      f => f.isDirectory && f.childrenLoaded === false && !f.isLoadingChildren
    );
    const anyLoading = files.some(f => f.isDirectory && f.isLoadingChildren);

    if (unloadedFolders.length > 0 && fullExpandCountRef.current < 40) {
      const remainingBudget = 40 - fullExpandCountRef.current;
      const batch = unloadedFolders.slice(0, Math.min(6, remainingBudget));
      fullExpandCountRef.current += batch.length;

      setFolderOpenOverrides(prev => {
        const next = { ...prev };
        batch.forEach(folder => {
          next[folder.path] = true;
        });
        return next;
      });

      batch.forEach(folder => {
        onExpandFolder(folder);
      });
    } else if (!anyLoading) {
      setIsFullExpanding(false);
    }
  }, [isFullExpanding, files, onExpandFolder]);

  const handleCollapseAll = useCallback(() => {
    setIsFullExpanding(false);
    fullExpandCountRef.current = 0;
    const next: Record<string, boolean> = {};
    files.forEach(item => {
      if (item.isDirectory) {
        next[item.path] = false;
      }
    });
    setFolderOpenOverrides(next);
  }, [files]);

  const handleExpandAllLazy = useCallback(() => {
    setIsFullExpanding(false);
    fullExpandCountRef.current = 0;
    const next: Record<string, boolean> = {};
    files.forEach(item => {
      if (item.isDirectory && item.childrenLoaded !== false) {
        next[item.path] = true;
      }
    });
    setFolderOpenOverrides(next);
  }, [files]);

  const handleExpandAllFull = useCallback(() => {
    const next: Record<string, boolean> = {};
    files.forEach(item => {
      if (item.isDirectory) {
        next[item.path] = true;
      }
    });
    setFolderOpenOverrides(next);
    fullExpandCountRef.current = 0;
    setIsFullExpanding(true);
  }, [files]);

  // Allow Command Palette actions to trigger Sidebar expand/collapse directly
  useEffect(() => {
    if (!folderActionSignal) return;
    if (folderActionSignal.action === 'collapse') {
      handleCollapseAll();
    } else if (folderActionSignal.action === 'expand-lazy') {
      handleExpandAllLazy();
    } else if (folderActionSignal.action === 'expand-full') {
      handleExpandAllFull();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderActionSignal?.nonce]);

  const handleToggleFolder = (node: FileTreeNode) => {
    const folderFile = node.file;
    const currentlyExpanded = isFolderCurrentlyExpanded(node);

    // If deeper folder contents were not loaded yet (childrenLoaded === false), trigger H2_LIST_FOLDER_REQ
    if (!currentlyExpanded && folderFile && folderFile.childrenLoaded === false) {
      setFolderOpenOverrides(prev => ({ ...prev, [node.path]: true }));
      if (!folderFile.isLoadingChildren) {
        onExpandFolder(folderFile);
      }
      return;
    }

    setFolderOpenOverrides(prev => ({
      ...prev,
      [node.path]: !currentlyExpanded,
    }));
  };

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    if (isImageFile(filename)) return <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    if (isVideoFile(filename)) return <Film className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
    if (['ts', 'tsx'].includes(ext)) return <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
    if (['js', 'jsx'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />;
    if (['json'].includes(ext)) return <FileJson className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
    if (['css', 'scss'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />;
    if (['md', 'markdown'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />;
    if (['sql'].includes(ext)) return <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-300 shrink-0" />;
    if (['py'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300 shrink-0" />;
    if (['sh', 'bash'].includes(ext)) return <Terminal className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />;
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newPathInput.trim().replace(/^\/+/, '');
    if (!cleaned) return;
    onCreateFile(cleaned, '');
    setNewPathInput('');
    setNewFolderContext(null);
    setShowNewFileInput(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newPathInput.trim().replace(/^\/+|\/+$/g, '');
    if (!cleaned) return;
    onCreateFolder(cleaned, newFolderContext?.parentFolderId, newFolderContext?.parentProvider);
    setNewPathInput('');
    setNewFolderContext(null);
    setShowNewFolderInput(false);
  };

  const handleRenameSubmit = (fileId: string) => {
    const cleaned = renameInput.trim().replace(/^\/+|\/+$/g, '');
    setRenamingId(null);
    setRenameInput('');
    if (!cleaned) return;
    onRenameFile(fileId, cleaned);
  };

  const handleRenameFolderSubmit = (folderPath: string, folderId?: string, folderProvider?: CloudProvider) => {
    const cleaned = renameInput.trim().replace(/^\/+|\/+$/g, '');
    setRenamingFolder(null);
    setRenameInput('');
    if (!cleaned || cleaned === folderPath) return;
    onRenameFolder(folderPath, cleaned, folderId, folderProvider);
  };

  const getParentPath = (itemPath: string) => {
    const idx = itemPath.lastIndexOf('/');
    return idx >= 0 ? itemPath.slice(0, idx) : '';
  };

  const getNodeProvider = (node: FileTreeNode): CloudProvider => {
    if (node.file?.cloudProvider) return node.file.cloudProvider;
    if (node.children) {
      for (const child of node.children) {
        const p = getNodeProvider(child);
        if (p) return p;
      }
    }
    return selectedDrive && selectedDrive !== 'all' ? selectedDrive : cloudProvider;
  };

  const evaluateDropTarget = (
    dragItem: DraggingItem,
    targetFolderPath: string,
    targetProvider: CloudProvider
  ): { valid: boolean; reason?: 'same-parent' | 'self-or-child' | 'cross-drive' } => {
    if (targetProvider && dragItem.provider && targetProvider !== dragItem.provider) {
      return { valid: false, reason: 'cross-drive' };
    }
    if (dragItem.parentPath === targetFolderPath) {
      return { valid: false, reason: 'same-parent' };
    }
    if (
      dragItem.itemType === 'folder' &&
      targetFolderPath &&
      (targetFolderPath === dragItem.path || targetFolderPath.startsWith(`${dragItem.path}/`))
    ) {
      return { valid: false, reason: 'self-or-child' };
    }
    return { valid: true };
  };

  const clearDragState = () => {
    setDraggingItem(null);
    setDropTargetPath(null);
    setDropInvalidReason(null);
  };

  // Recursive Tree Rendering
  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map(node => {
      const isFolder = node.isDirectory;
      const isLazyUnloaded = Boolean(isFolder && node.file?.childrenLoaded === false);
      const isCollapsed = isFolder
        ? searchTerm.trim()
          ? false
          : !isFolderCurrentlyExpanded(node)
        : false;
      const isLoadingChildren = Boolean(node.file?.isLoadingChildren);
      const isFileActive = !isFolder && node.file && node.file.id === activeFileId;
      const isDirty = !isFolder && node.file?.isDirty;
      const isUnloaded = !isFolder && node.file?.contentLoaded === false;
      const deleteKey = isFolder ? `dir:${node.path}` : `file:${node.file?.id}`;
      const isConfirmingDelete = confirmDeleteKey === deleteKey;

      if (isFolder) {
        const folderProvider = getNodeProvider(node);
        const isRenamingThisFolder = renamingFolder?.path === node.path && !isReadOnly;
        const isDropTarget = dropTargetPath === node.path;

        return (
          <div key={`dir-${node.path}`} className="select-auto">
            {isRenamingThisFolder ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleRenameFolderSubmit(
                    node.path,
                    renamingFolder?.folderId ?? node.file?.folderId,
                    renamingFolder?.provider ?? folderProvider
                  );
                }}
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
                className="flex items-center gap-1 py-1 pr-2 bg-slate-200 dark:bg-zinc-800"
              >
                <Folder className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <input
                  type="text"
                  value={renameInput}
                  onChange={e => setRenameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setRenamingFolder(null);
                      setRenameInput('');
                    }
                  }}
                  autoFocus
                  className="w-full bg-white dark:bg-zinc-900 border border-blue-500 text-slate-900 dark:text-white text-xs px-1.5 py-0.5 rounded outline-none font-mono"
                  onBlur={() =>
                    handleRenameFolderSubmit(
                      node.path,
                      renamingFolder?.folderId ?? node.file?.folderId,
                      renamingFolder?.provider ?? folderProvider
                    )
                  }
                />
              </form>
            ) : (
              <div
                draggable={!isReadOnly && canMoveFolders && !isConfirmingDelete}
                onDragStart={e => {
                  if (isReadOnly || !canMoveFolders) return;
                  e.stopPropagation();
                  setDraggingItem({
                    itemType: 'folder',
                    id: node.file?.folderId,
                    path: node.path,
                    name: node.name,
                    parentPath: getParentPath(node.path),
                    provider: folderProvider,
                  });
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', node.path);
                }}
                onDragEnd={clearDragState}
                onDragOver={e => {
                  if (!draggingItem || isReadOnly) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const evalResult = evaluateDropTarget(draggingItem, node.path, folderProvider);
                  setDropTargetPath(node.path);
                  setDropInvalidReason(evalResult.reason || null);
                  e.dataTransfer.dropEffect =
                    evalResult.valid || evalResult.reason === 'cross-drive' ? 'move' : 'none';
                }}
                onDragLeave={e => {
                  e.stopPropagation();
                  if (dropTargetPath === node.path) {
                    setDropTargetPath(null);
                    setDropInvalidReason(null);
                  }
                }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const currentDrag = draggingItem;
                  clearDragState();
                  if (!currentDrag || isReadOnly) return;

                  const evalResult = evaluateDropTarget(currentDrag, node.path, folderProvider);
                  if (evalResult.reason === 'cross-drive') {
                    onCrossDriveDropBlocked?.(currentDrag.provider, folderProvider);
                    return;
                  }
                  if (!evalResult.valid) return;

                  onMoveItem({
                    itemType: currentDrag.itemType,
                    sourcePath: currentDrag.path,
                    targetFolderPath: node.path,
                    itemId: currentDrag.id,
                    sourceProvider: currentDrag.provider,
                    targetProvider: folderProvider,
                  });
                }}
                onClick={() => handleToggleFolder(node)}
                style={{ paddingLeft: `${depth * 14 + 10}px` }}
                className={`flex items-center justify-between py-1 pr-2 cursor-pointer text-xs group transition-colors ${
                  isDropTarget
                    ? dropInvalidReason
                      ? 'bg-red-50 dark:bg-red-950/40 ring-1 ring-inset ring-red-500/70 text-red-700 dark:text-red-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 ring-1 ring-inset ring-emerald-500 text-emerald-900 dark:text-emerald-200'
                    : 'hover:bg-slate-200/70 dark:hover:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
                title={
                  isLazyUnloaded
                    ? `${node.path} — Click to load folder contents (H2_LIST_FOLDER_REQ)`
                    : node.path
                }
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isLoadingChildren ? (
                    <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
                  ) : isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                  )}
                  {isCollapsed ? (
                    <Folder className="w-3.5 h-3.5 text-blue-600/80 dark:text-blue-400/80 shrink-0" />
                  ) : (
                    <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  )}
                  <span className="truncate font-medium text-slate-800 dark:text-zinc-300 text-[11.5px]">
                    {node.name}
                  </span>
                  {isLazyUnloaded && (
                    <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400/80 shrink-0">
                      ...
                    </span>
                  )}
                  {isDropTarget && dropInvalidReason === 'cross-drive' && (
                    <span className="text-[9.5px] font-mono text-red-600 dark:text-red-400 shrink-0">
                      (cross-drive blocked)
                    </span>
                  )}
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    {isConfirmingDelete ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setConfirmDeleteKey(null);
                            onDeleteFolder(node.path, node.file?.folderId, folderProvider);
                          }}
                          className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-semibold"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteKey(null)}
                          className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[10px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                        {canCreateFiles && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setShowNewFileInput(true);
                              setShowNewFolderInput(false);
                              setNewFolderContext(null);
                              setNewPathInput(`${node.path}/`);
                            }}
                            className="p-1 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                            title={`New file inside ${node.path}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                        {canCreateFolders && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setShowNewFolderInput(true);
                              setShowNewFileInput(false);
                              setNewFolderContext({
                                parentFolderId: node.file?.folderId,
                                parentProvider: folderProvider,
                              });
                              setNewPathInput(`${node.path}/`);
                            }}
                            className="p-1 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                            title={`New subfolder inside ${node.path}`}
                          >
                            <FolderPlus className="w-3 h-3" />
                          </button>
                        )}
                        {canMoveFolders && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setRenamingFolder({
                                path: node.path,
                                folderId: node.file?.folderId,
                                provider: folderProvider,
                              });
                              setRenamingId(null);
                              setRenameInput(node.path);
                            }}
                            className="p-1 hover:text-slate-950 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                            title="Rename or move folder"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {canDeleteFolders && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmDeleteKey(deleteKey);
                            }}
                            className="p-1 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                            title="Delete folder"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isCollapsed && node.children && node.children.length > 0 && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      // File node
      const file = node.file;
      if (!file) return null;

      if (renamingId === file.id && !isReadOnly) {
        return (
          <form
            key={node.path}
            onSubmit={e => {
              e.preventDefault();
              handleRenameSubmit(file.id);
            }}
            className="flex items-center gap-1 py-1 px-3 bg-slate-200 dark:bg-zinc-800"
          >
            <input
              type="text"
              value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setRenamingId(null);
                  setRenameInput('');
                }
              }}
              autoFocus
              className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 text-slate-900 dark:text-white text-xs px-1.5 py-0.5 rounded outline-none font-mono"
              onBlur={() => handleRenameSubmit(file.id)}
            />
          </form>
        );
      }

      return (
        <div
          key={`${file.cloudProvider}:${node.path}`}
          draggable={!isReadOnly && canMoveFiles && !isConfirmingDelete}
          onDragStart={e => {
            if (isReadOnly || !canMoveFiles) return;
            e.stopPropagation();
            setDraggingItem({
              itemType: 'file',
              id: file.cloudFileId,
              path: file.path,
              name: file.name,
              parentPath: getParentPath(file.path),
              provider: file.cloudProvider,
            });
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', file.path);
          }}
          onDragEnd={clearDragState}
          onClick={() => onSelectFile(file.id)}
          style={{ paddingLeft: `${depth * 14 + 16}px` }}
          className={`flex items-center justify-between py-1 pr-2 cursor-pointer text-xs group transition-colors ${
            isFileActive
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium border-l-2 border-emerald-600 dark:border-emerald-400'
              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
          title={`${file.path} (${file.cloudProvider})${isUnloaded ? ' — Click to fetch via H2_READ_FILE_REQ' : ''}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {getFileIcon(file.name)}
            <span className={`truncate font-mono text-[11.5px] ${isUnloaded ? 'opacity-80' : ''}`}>
              {node.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" title="Unsaved changes" />
            )}

            {!isReadOnly && (
              <>
                {isConfirmingDelete ? (
                  <div
                    className="flex items-center gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setConfirmDeleteKey(null);
                        onDeleteFile(file.id);
                      }}
                      className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-semibold"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteKey(null)}
                      className="px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-[10px]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setRenamingId(file.id);
                        setRenameInput(file.path);
                      }}
                      className="p-1 hover:text-slate-950 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                      title="Rename file"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {canDeleteFiles && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setConfirmDeleteKey(deleteKey);
                        }}
                        className="p-1 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                        title="Delete file"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <aside className="w-full h-full bg-slate-100 dark:bg-[#1b1b1e] flex flex-col select-auto">
      {/* Workspace Cloud Header */}
      <div className="p-3 border-b border-slate-200 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/40 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs truncate">
              {workspaceName}
            </span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shrink-0">
            {cloudProvider}
          </span>
        </div>

        {/* Read-only notice */}
        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-[10.5px]">
            <Lock className="w-3 h-3 shrink-0" />
            <span>Read-Only Session</span>
          </div>
        )}

        {/* Connected Multi-Drive Switcher (v1.3 Direct & Launched driveRoot switching) */}
        {isConnected && connectedDrives.length > 0 && onSelectDrive && (
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-zinc-800/60">
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => onSelectDrive('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                  (selectedDrive || cloudProvider) === 'all'
                    ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-800 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Query all connected drives (H2_WORKSPACE_TREE_REQ driveRoot: true)"
              >
                all
              </button>
              {connectedDrives.map(([driveKey, status]) => {
                const isSelected = (selectedDrive || cloudProvider) === driveKey;
                return (
                  <button
                    key={driveKey}
                    onClick={() => onSelectDrive(driveKey)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                        : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-800 hover:border-emerald-500/40'
                    }`}
                    title={
                      status.visible
                        ? `Browse ${driveKey} drive root`
                        : `Browse ${driveKey} drive root (authenticated, hidden in extension sidebar)`
                    }
                  >
                    <span>{driveKey}</span>
                    {!status.visible && <EyeOff className="w-2.5 h-2.5 text-blue-500 dark:text-blue-300" />}
                  </button>
                );
              })}
            </div>

            {launchedScope && driveRootActive && onReturnToLaunchedScope && (
              <button
                onClick={onReturnToLaunchedScope}
                className="w-full px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 text-[10px] font-mono transition text-left truncate"
                title={`Return to launched scope: ${launchedScope.rootName}`}
              >
                Return to launched: {launchedScope.rootName}
              </button>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-800/60 text-slate-500 dark:text-zinc-400">
          <span className="text-[10px] font-bold tracking-wider">
            Files ({fileCount})
          </span>
          <div className="flex items-center gap-1">
            {isConnected && onRefreshTree && (
              <button
                onClick={onRefreshTree}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-300 rounded text-slate-500 dark:text-zinc-400 transition"
                title="Refresh workspace tree (H2_WORKSPACE_TREE_REQ)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            )}
            {!isReadOnly && canCreateFiles && (
              <button
                onClick={() => {
                  setShowNewFileInput(true);
                  setShowNewFolderInput(false);
                  setNewPathInput('');
                }}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white rounded text-slate-500 dark:text-zinc-400 transition"
                title="New File (supports nested paths e.g. src/utils/new.ts)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {!isReadOnly && canCreateFolders && (
              <button
                onClick={() => {
                  setShowNewFolderInput(true);
                  setShowNewFileInput(false);
                  setNewFolderContext(null);
                  setNewPathInput('');
                }}
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white rounded text-slate-500 dark:text-zinc-400 transition"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            )}
            {!isReadOnly && canCreateFiles && (
              <label
                className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white rounded text-slate-500 dark:text-zinc-400 transition cursor-pointer"
                title="Upload file into workspace"
              >
                <Upload className="w-3.5 h-3.5" />
                <input type="file" multiple onChange={onUploadFiles} className="hidden" />
              </label>
            )}
            <button
              type="button"
              onClick={handleExpandAllLazy}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-emerald-600 dark:hover:text-emerald-400 rounded text-slate-500 dark:text-zinc-400 transition"
              title="Expand All - Lazy (loaded folders only)"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleExpandAllFull}
              className={`p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition ${
                isFullExpanding
                  ? 'text-blue-600 dark:text-blue-400 animate-pulse bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title="Expand All - Full (expands and loads nested cloud folders)"
            >
              <FolderTree className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white rounded text-slate-500 dark:text-zinc-400 transition"
              title="Collapse All Folders"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* File Search Input */}
      <div className="px-2.5 py-2 border-b border-slate-200 dark:border-zinc-800/60 bg-slate-50 dark:bg-[#171719]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 rounded pl-7 pr-2 py-1 text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Inline New File / Folder input */}
      {showNewFileInput && !isReadOnly && (
        <form onSubmit={handleCreateFileSubmit} className="p-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900">
          <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mb-1">
            Create new file (nested paths allowed):
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="e.g. src/utils/new.ts"
              value={newPathInput}
              onChange={e => setNewPathInput(e.target.value)}
              autoFocus
              className="flex-1 bg-white dark:bg-zinc-950 border border-emerald-500/60 rounded px-2 py-1 text-xs text-slate-900 dark:text-white outline-none font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-emerald-600 text-white text-xs font-semibold rounded"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowNewFileInput(false)}
              className="px-2 py-1 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showNewFolderInput && !isReadOnly && (
        <form onSubmit={handleCreateFolderSubmit} className="p-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900">
          <div className="text-[10px] text-blue-700 dark:text-blue-400 font-mono mb-1">Create new directory:</div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="e.g. assets/icons"
              value={newPathInput}
              onChange={e => setNewPathInput(e.target.value)}
              autoFocus
              className="flex-1 bg-white dark:bg-zinc-950 border border-blue-500/60 rounded px-2 py-1 text-xs text-slate-900 dark:text-white outline-none font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-blue-600 text-white text-xs font-semibold rounded"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setNewFolderContext(null);
                setShowNewFolderInput(false);
              }}
              className="px-2 py-1 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Inline Move / Rename Collision Resolution Prompt */}
      {moveConflict && (
        <form
          onSubmit={e => {
            e.preventDefault();
            const cleaned = conflictRenameInput.trim().replace(/^\/+|\/+$/g, '');
            if (cleaned) {
              onResolveMoveConflictRename(cleaned);
            }
          }}
          className="p-2.5 border-b border-red-200 dark:border-red-500/40 bg-red-50/90 dark:bg-red-950/35 space-y-2 text-xs"
        >
          <div className="flex items-start gap-1.5 text-red-800 dark:text-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-[11px]">Destination already exists</div>
              <div className="text-[10.5px] text-red-700 dark:text-red-300/90 break-all">
                {moveConflict.errorMessage}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-600 dark:text-zinc-400 mb-1">
              Rename destination or overwrite existing:
            </label>
            <input
              type="text"
              value={conflictRenameInput}
              onChange={e => setConflictRenameInput(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950 border border-blue-400 dark:border-blue-500/60 rounded px-2 py-1 text-[11px] font-mono text-slate-900 dark:text-white outline-none"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="submit"
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10.5px] font-semibold transition"
            >
              Move as Renamed
            </button>
            <button
              type="button"
              onClick={onResolveMoveConflictOverwrite}
              className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[10.5px] font-semibold transition"
            >
              Overwrite
            </button>
            <button
              type="button"
              onClick={onDismissMoveConflict}
              className="px-2 py-1 rounded bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-[10.5px] transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Root Drop Indicator when dragging a nested item */}
      {draggingItem && draggingItem.parentPath !== '' && !isReadOnly && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setDropTargetPath('__root__');
            setDropInvalidReason(null);
            e.dataTransfer.dropEffect = 'move';
          }}
          onDragLeave={() => {
            if (dropTargetPath === '__root__') {
              setDropTargetPath(null);
            }
          }}
          onDrop={e => {
            e.preventDefault();
            const currentDrag = draggingItem;
            clearDragState();
            if (!currentDrag) return;
            onMoveItem({
              itemType: currentDrag.itemType,
              sourcePath: currentDrag.path,
              targetFolderPath: '',
              itemId: currentDrag.id,
              sourceProvider: currentDrag.provider,
              targetProvider: currentDrag.provider,
            });
          }}
          className={`mx-2 mt-1.5 px-2.5 py-1.5 rounded border border-dashed text-[10.5px] font-mono text-center transition ${
            dropTargetPath === '__root__'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-200 font-semibold'
              : 'border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/50 text-slate-500 dark:text-zinc-400'
          }`}
        >
          Drop here to move &quot;{draggingItem.name}&quot; to {draggingItem.provider} root
        </div>
      )}

      {/* File Tree List (also acts as drive root drop zone on empty space) */}
      <div
        className={`flex-1 overflow-y-auto py-1 transition-colors ${
          dropTargetPath === '__root__' ? 'bg-blue-50/40 dark:bg-blue-950/15' : ''
        }`}
        onDragOver={e => {
          if (!draggingItem || draggingItem.parentPath === '' || isReadOnly) return;
          e.preventDefault();
          setDropTargetPath('__root__');
          setDropInvalidReason(null);
          e.dataTransfer.dropEffect = 'move';
        }}
        onDragLeave={e => {
          if (e.currentTarget === e.target && dropTargetPath === '__root__') {
            setDropTargetPath(null);
          }
        }}
        onDrop={e => {
          if (!draggingItem || draggingItem.parentPath === '' || isReadOnly) return;
          e.preventDefault();
          const currentDrag = draggingItem;
          clearDragState();
          onMoveItem({
            itemType: currentDrag.itemType,
            sourcePath: currentDrag.path,
            targetFolderPath: '',
            itemId: currentDrag.id,
            sourceProvider: currentDrag.provider,
            targetProvider: currentDrag.provider,
          });
        }}
      >
        {fileTree.length === 0 ? (
          <div className="p-4 text-center text-slate-500 dark:text-zinc-500 text-xs italic">
            {searchTerm ? 'No files match search filter.' : 'Workspace is empty.'}
          </div>
        ) : (
          renderTree(fileTree)
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="px-2.5 py-1.5 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/30 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500">
        <span className="font-mono">ide.freshfood.rocks</span>
      </div>
    </aside>
  );
};
