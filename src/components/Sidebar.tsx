/**
 * Workspace File Explorer Sidebar (H2_CLOUD_BRIDGE v1.3).
 * Displays folders (including empty & lazily-loaded subdirectories where childrenLoaded === false)
 * and files from H2_WORKSPACE_TREE / H2_LIST_FOLDER_RES.
 * Supports nested file creation (H2_SAVE_FILE_REQ), file/folder deletion (H2_DELETE_FILE_REQ),
 * multi-drive & driveRoot switching (H2_WORKSPACE_TREE_REQ), and read-only capability enforcement.
 *
 * Official Documentation:
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState } from 'react';
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
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  HardDrive,
  RotateCw,
  EyeOff,
  Lock,
} from 'lucide-react';
import { CloudFile, FileTreeNode, CloudProvider, H2DriveStatus, H2LaunchedScope } from '../types/ide';
import { getFileExtension, isImageFile, isVideoFile, buildFileTree } from '../utils/fileSystem';

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
  onCreateFolder: (folderPath: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (folderPath: string, folderId?: string, folderProvider?: CloudProvider) => void;
  onRenameFile: (fileId: string, newPath: string) => void;
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportWorkspace: () => void;
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
  onUploadFiles,
  onExportWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [expandedLazyFolders, setExpandedLazyFolders] = useState<Record<string, boolean>>({});
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newPathInput, setNewPathInput] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const fileCount = React.useMemo(() => files.filter(f => !f.isDirectory).length, [files]);

  const connectedDrives = React.useMemo(() => {
    if (!drives) return [];
    return Object.entries(drives).filter(([, status]) => status?.connected);
  }, [drives]);

  // Filter files if searching
  const filteredFiles = React.useMemo(
    () =>
      files.filter(
        f =>
          !searchTerm ||
          f.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [files, searchTerm]
  );

  const fileTree = React.useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

  const handleToggleFolder = (node: FileTreeNode) => {
    const folderFile = node.file;
    // If deeper folder contents were not loaded yet (childrenLoaded === false), trigger H2_LIST_FOLDER_REQ
    if (folderFile && folderFile.childrenLoaded === false) {
      const currentlyExpanded = Boolean(expandedLazyFolders[node.path]);
      if (!currentlyExpanded) {
        setExpandedLazyFolders(prev => ({ ...prev, [node.path]: true }));
        setCollapsedFolders(prev => ({ ...prev, [node.path]: false }));
        if (!folderFile.isLoadingChildren) {
          onExpandFolder(folderFile);
        }
        return;
      }
    }

    setCollapsedFolders(prev => ({
      ...prev,
      [node.path]: !prev[node.path],
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
    setShowNewFileInput(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newPathInput.trim().replace(/^\/+|\/+$/g, '');
    if (!cleaned) return;
    onCreateFolder(cleaned);
    setNewPathInput('');
    setShowNewFolderInput(false);
  };

  const handleRenameSubmit = (fileId: string) => {
    const cleaned = renameInput.trim().replace(/^\/+/, '');
    if (!cleaned) {
      setRenamingId(null);
      return;
    }
    onRenameFile(fileId, cleaned);
    setRenamingId(null);
    setRenameInput('');
  };

  // Recursive Tree Rendering
  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map(node => {
      const isFolder = node.isDirectory;
      const isLazyUnloaded = Boolean(isFolder && node.file?.childrenLoaded === false);
      const isCollapsed = isLazyUnloaded
        ? !expandedLazyFolders[node.path] || Boolean(collapsedFolders[node.path])
        : Boolean(collapsedFolders[node.path]);
      const isLoadingChildren = Boolean(node.file?.isLoadingChildren);
      const isFileActive = !isFolder && node.file && node.file.id === activeFileId;
      const isDirty = !isFolder && node.file?.isDirty;
      const isUnloaded = !isFolder && node.file?.contentLoaded === false;
      const deleteKey = isFolder ? `dir:${node.path}` : `file:${node.file?.id}`;
      const isConfirmingDelete = confirmDeleteKey === deleteKey;

      if (isFolder) {
        return (
          <div key={`dir-${node.path}`} className="select-auto">
            <div
              onClick={() => handleToggleFolder(node)}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className="flex items-center justify-between py-1 pr-2 hover:bg-slate-200/70 dark:hover:bg-zinc-800/60 cursor-pointer text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 text-xs group"
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
                <span className="truncate font-medium text-slate-800 dark:text-zinc-300 text-[11.5px]">{node.name}</span>
                {isLazyUnloaded && (
                  <span className="text-[9px] font-mono text-blue-600 dark:text-blue-400/80 shrink-0">...</span>
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
                          onDeleteFolder(node.path, node.file?.folderId, node.file?.cloudProvider);
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
                          onClick={e => {
                            e.stopPropagation();
                            setShowNewFileInput(true);
                            setShowNewFolderInput(false);
                            setNewPathInput(`${node.path}/`);
                          }}
                          className="p-1 hover:text-emerald-600 dark:hover:text-emerald-400 rounded hover:bg-slate-200 dark:hover:bg-zinc-700/60"
                          title={`New file inside ${node.path}`}
                        >
                          <Plus className="w-3 h-3" />
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
              autoFocus
              className="w-full bg-white dark:bg-zinc-900 border border-emerald-500 text-slate-900 dark:text-white text-xs px-1.5 py-0.5 rounded outline-none"
              onBlur={() => handleRenameSubmit(file.id)}
            />
          </form>
        );
      }

      return (
        <div
          key={`${file.cloudProvider}:${node.path}`}
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
              onClick={onExportWorkspace}
              className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white rounded text-slate-500 dark:text-zinc-400 transition"
              title="Export workspace JSON"
            >
              <Download className="w-3.5 h-3.5" />
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
              onClick={() => setShowNewFolderInput(false)}
              className="px-2 py-1 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.length === 0 ? (
          <div className="p-4 text-center text-slate-500 dark:text-zinc-500 text-xs italic">
            {searchTerm ? 'No files match search filter.' : 'Workspace is empty.'}
          </div>
        ) : (
          renderTree(fileTree)
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900/30 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500">
        <span className="font-mono">ide.freshfood.rocks</span>
        <button
          onClick={() => setCollapsedFolders({})}
          className="hover:text-slate-800 dark:hover:text-zinc-300 text-[10px] underline"
          title="Expand all loaded folders"
        >
          Expand All
        </button>
      </div>
    </aside>
  );
};
