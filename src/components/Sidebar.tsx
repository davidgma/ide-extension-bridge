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
  MoreVertical, 
  Trash2, 
  Edit2, 
  HardDrive,
  RefreshCw,
  FolderTree
} from 'lucide-react';
import { CloudFile, FileTreeNode, CloudProvider } from '../types/ide';
import { getFileExtension, isMarkdownFile, isImageFile, isVideoFile, buildFileTree } from '../utils/fileSystem';

interface SidebarProps {
  files: CloudFile[];
  activeFileId: string | null;
  cloudProvider: CloudProvider;
  workspaceName: string;
  onSelectFile: (fileId: string) => void;
  onCreateFile: (path: string, content?: string) => void;
  onCreateFolder: (folderPath: string) => void;
  onDeleteFile: (fileId: string) => void;
  onRenameFile: (fileId: string, newPath: string) => void;
  onUploadFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportWorkspace: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  activeFileId,
  cloudProvider,
  workspaceName,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onDeleteFile,
  onRenameFile,
  onUploadFiles,
  onExportWorkspace,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newPathInput, setNewPathInput] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // Filter files if searching
  const filteredFiles = files.filter(f => 
    !searchTerm || f.path.toLowerCase().includes(searchTerm.toLowerCase()) || f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fileTree = buildFileTree(filteredFiles);

  const toggleFolder = (path: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [path]: !prev[path],
    }));
  };

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    if (isImageFile(filename)) return <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    if (isVideoFile(filename)) return <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    if (['ts', 'tsx'].includes(ext)) return <Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    if (['js', 'jsx'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (['json'].includes(ext)) return <FileJson className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (['css', 'scss'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    if (['md', 'markdown'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    if (['sql'].includes(ext)) return <Database className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    if (['py'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
    if (['sh', 'bash'].includes(ext)) return <Terminal className="w-3.5 h-3.5 text-green-400 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPathInput.trim()) return;
    onCreateFile(newPathInput.trim(), '// FreshFood Cloud File\n');
    setNewPathInput('');
    setShowNewFileInput(false);
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPathInput.trim()) return;
    onCreateFolder(newPathInput.trim());
    setNewPathInput('');
    setShowNewFolderInput(false);
  };

  const handleRenameSubmit = (fileId: string) => {
    if (!renameInput.trim()) return;
    onRenameFile(fileId, renameInput.trim());
    setRenamingId(null);
    setRenameInput('');
  };

  // Recursive Tree Rendering
  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map(node => {
      const isFolder = node.isDirectory;
      const isCollapsed = Boolean(collapsedFolders[node.path]);
      const isFileActive = !isFolder && node.file && node.file.id === activeFileId;
      const isDirty = !isFolder && node.file?.isDirty;

      if (isFolder) {
        return (
          <div key={node.path} className="select-none">
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className="flex items-center gap-1.5 py-1 pr-2 hover:bg-zinc-800/60 cursor-pointer text-zinc-400 hover:text-zinc-200 text-xs group"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              )}
              {isCollapsed ? (
                <Folder className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span className="truncate font-medium text-zinc-300 text-[11.5px]">{node.name}</span>
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

      if (renamingId === file.id) {
        return (
          <form
            key={node.path}
            onSubmit={e => {
              e.preventDefault();
              handleRenameSubmit(file.id);
            }}
            className="flex items-center gap-1 py-1 px-3 bg-zinc-800"
          >
            <input
              type="text"
              value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              autoFocus
              className="w-full bg-zinc-900 border border-emerald-500 text-white text-xs px-1.5 py-0.5 rounded outline-none"
              onBlur={() => handleRenameSubmit(file.id)}
            />
          </form>
        );
      }

      return (
        <div
          key={node.path}
          onClick={() => onSelectFile(file.id)}
          style={{ paddingLeft: `${depth * 14 + 16}px` }}
          className={`flex items-center justify-between py-1 pr-2 cursor-pointer text-xs group transition-colors ${
            isFileActive
              ? 'bg-emerald-950/40 text-emerald-300 font-medium border-l-2 border-emerald-400'
              : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
          }`}
          title={`${file.path} (${file.cloudProvider})`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {getFileIcon(file.name)}
            <span className="truncate font-mono text-[11.5px]">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved" />
            )}
            {/* Quick action buttons on hover */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setRenamingId(file.id);
                  setRenameInput(file.path);
                }}
                className="p-1 hover:text-white rounded hover:bg-zinc-700/60"
                title="Rename file"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (confirm(`Delete ${file.name}?`)) {
                    onDeleteFile(file.id);
                  }
                }}
                className="p-1 hover:text-red-400 rounded hover:bg-zinc-700/60"
                title="Delete file"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <aside className="w-64 h-full bg-[#1b1b1e] border-r border-zinc-800 flex flex-col select-none shrink-0">
      {/* Workspace Cloud Header */}
      <div className="p-3 border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-zinc-200 text-xs truncate">
              {workspaceName}
            </span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-emerald-950 text-emerald-400 border border-emerald-500/30">
            {cloudProvider}
          </span>
        </div>

        {/* Toolbar: New File, New Folder, Upload, Download */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/60 text-zinc-400">
          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
            Files ({files.length})
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setShowNewFileInput(true);
                setShowNewFolderInput(false);
                setNewPathInput('');
              }}
              className="p-1 hover:bg-zinc-800 hover:text-white rounded text-zinc-400 transition"
              title="New File"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setShowNewFolderInput(true);
                setShowNewFileInput(false);
                setNewPathInput('');
              }}
              className="p-1 hover:bg-zinc-800 hover:text-white rounded text-zinc-400 transition"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            {/* Upload file */}
            <label
              className="p-1 hover:bg-zinc-800 hover:text-white rounded text-zinc-400 transition cursor-pointer"
              title="Upload file into workspace"
            >
              <Upload className="w-3.5 h-3.5" />
              <input type="file" multiple onChange={onUploadFiles} className="hidden" />
            </label>
            {/* Export workspace */}
            <button
              onClick={onExportWorkspace}
              className="p-1 hover:bg-zinc-800 hover:text-white rounded text-zinc-400 transition"
              title="Export workspace JSON"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* File Search Input */}
      <div className="px-2.5 py-2 border-b border-zinc-800/60 bg-[#171719]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Inline New File / Folder input */}
      {showNewFileInput && (
        <form onSubmit={handleCreateFileSubmit} className="p-2 border-b border-zinc-800 bg-zinc-900">
          <div className="text-[10px] text-emerald-400 font-mono mb-1">Create new file:</div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="e.g. src/utils/math.ts"
              value={newPathInput}
              onChange={e => setNewPathInput(e.target.value)}
              autoFocus
              className="flex-1 bg-zinc-950 border border-emerald-500/60 rounded px-2 py-1 text-xs text-white outline-none font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-emerald-600 text-black text-xs font-semibold rounded"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowNewFileInput(false)}
              className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {showNewFolderInput && (
        <form onSubmit={handleCreateFolderSubmit} className="p-2 border-b border-zinc-800 bg-zinc-900">
          <div className="text-[10px] text-amber-400 font-mono mb-1">Create new directory:</div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="e.g. assets/icons"
              value={newPathInput}
              onChange={e => setNewPathInput(e.target.value)}
              autoFocus
              className="flex-1 bg-zinc-950 border border-amber-500/60 rounded px-2 py-1 text-xs text-white outline-none font-mono"
            />
            <button
              type="submit"
              className="px-2 py-1 bg-amber-500 text-black text-xs font-semibold rounded"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolderInput(false)}
              className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-xs italic">
            {searchTerm ? 'No files match search filter.' : 'Workspace is empty.'}
          </div>
        ) : (
          renderTree(fileTree)
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="font-mono">ide.freshfood.rocks</span>
        <button
          onClick={() => setCollapsedFolders({})}
          className="hover:text-zinc-300 text-[10px] underline"
          title="Expand all tree folders"
        >
          Expand All
        </button>
      </div>
    </aside>
  );
};
