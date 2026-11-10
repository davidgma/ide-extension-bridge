import React from 'react';
import { OpenTab, CloudFile } from '../types/ide';
import { 
  X, 
  FileCode, 
  FileText, 
  FileJson, 
  Code2, 
  Terminal, 
  Database, 
  Image as ImageIcon, 
  Film,
  Columns,
  Eye,
  Code
} from 'lucide-react';
import { getFileExtension, isMarkdownFile, isImageFile, isVideoFile } from '../utils/fileSystem';

interface TabsBarProps {
  openTabs: OpenTab[];
  activeTabId: string | null;
  files: CloudFile[];
  onSelectTab: (fileId: string) => void;
  onCloseTab: (fileId: string, e?: React.MouseEvent) => void;
  onCloseAllTabs: () => void;
  onCloseOtherTabs: (fileId: string) => void;
  onSetPreviewMode: (fileId: string, mode: 'code' | 'split' | 'preview') => void;
}

export const TabsBar: React.FC<TabsBarProps> = ({
  openTabs,
  activeTabId,
  files,
  onSelectTab,
  onCloseTab,
  onCloseAllTabs,
  onCloseOtherTabs,
  onSetPreviewMode,
}) => {
  const activeTab = openTabs.find(t => t.fileId === activeTabId);
  const activeFile = files.find(f => f.id === activeTabId);
  const isMd = activeFile && isMarkdownFile(activeFile.name);

  const getTabIcon = (filename: string) => {
    const ext = getFileExtension(filename);
    if (isImageFile(filename)) return <ImageIcon className="w-3.5 h-3.5 text-pink-400" />;
    if (isVideoFile(filename)) return <Film className="w-3.5 h-3.5 text-purple-400" />;
    if (['ts', 'tsx'].includes(ext)) return <Code2 className="w-3.5 h-3.5 text-blue-400" />;
    if (['js', 'jsx'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-amber-400" />;
    if (['json'].includes(ext)) return <FileJson className="w-3.5 h-3.5 text-emerald-400" />;
    if (['css', 'scss'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-sky-400" />;
    if (['md', 'markdown'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-teal-400" />;
    if (['sql'].includes(ext)) return <Database className="w-3.5 h-3.5 text-indigo-400" />;
    if (['py'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-yellow-500" />;
    if (['sh', 'bash'].includes(ext)) return <Terminal className="w-3.5 h-3.5 text-green-400" />;
    return <FileCode className="w-3.5 h-3.5 text-zinc-400" />;
  };

  if (openTabs.length === 0) {
    return (
      <div className="h-9 bg-[#1e1e20] border-b border-zinc-800 flex items-center px-4 text-xs text-zinc-500 italic">
        No files open. Click a file in the sidebar or press Cmd+P to open.
      </div>
    );
  }

  return (
    <div className="h-9 bg-[#1b1b1e] border-b border-zinc-800/90 flex items-center justify-between select-none overflow-hidden">
      {/* Scrollable Tabs */}
      <div className="flex items-center h-full overflow-x-auto no-scrollbar flex-1">
        {openTabs.map(tab => {
          const file = files.find(f => f.id === tab.fileId);
          const isActive = tab.fileId === activeTabId;
          const isDirty = file?.isDirty;

          return (
            <div
              key={tab.fileId}
              onClick={() => onSelectTab(tab.fileId)}
              onContextMenu={e => {
                e.preventDefault();
                onCloseOtherTabs(tab.fileId);
              }}
              title={`${tab.path} ${isDirty ? '(Unsaved Changes)' : ''}`}
              className={`group relative h-full flex items-center gap-2 px-3 border-r border-zinc-800/80 cursor-pointer text-xs transition-colors shrink-0 ${
                isActive
                  ? 'bg-[#18181b] text-white font-medium shadow-inner'
                  : 'bg-[#212124] text-zinc-400 hover:bg-[#252529] hover:text-zinc-200'
              }`}
            >
              {/* Active top accent line */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-400" />
              )}

              {/* Icon */}
              {getTabIcon(tab.title)}

              {/* Filename */}
              <span className="truncate max-w-[150px] font-mono text-[11.5px]">
                {tab.title}
              </span>

              {/* Dirty indicator or close button */}
              <div className="flex items-center ml-1">
                {isDirty ? (
                  <span
                    className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden animate-pulse"
                    title="Unsaved Changes"
                  />
                ) : null}

                <button
                  onClick={e => onCloseTab(tab.fileId, e)}
                  className={`p-0.5 rounded hover:bg-zinc-700/80 hover:text-white text-zinc-400 transition ${
                    isDirty ? 'hidden group-hover:block' : 'opacity-60 group-hover:opacity-100'
                  }`}
                  title="Close tab (Cmd+W)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right controls: Markdown preview toggles & close actions */}
      <div className="flex items-center gap-1 px-2 border-l border-zinc-800/80 bg-[#1b1b1e] shrink-0">
        {isMd && activeTab && (
          <div className="flex items-center bg-zinc-900/90 rounded border border-zinc-750 p-0.5 mr-2">
            <button
              onClick={() => onSetPreviewMode(activeTab.fileId, 'code')}
              className={`p-1 rounded text-[11px] flex items-center gap-1 transition ${
                activeTab.previewMode === 'code' ? 'bg-emerald-600 text-black font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
              title="Code Editor Only"
            >
              <Code className="w-3 h-3" />
            </button>
            <button
              onClick={() => onSetPreviewMode(activeTab.fileId, 'split')}
              className={`p-1 rounded text-[11px] flex items-center gap-1 transition ${
                activeTab.previewMode === 'split' ? 'bg-emerald-600 text-black font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
              title="Split Code & Preview"
            >
              <Columns className="w-3 h-3" />
            </button>
            <button
              onClick={() => onSetPreviewMode(activeTab.fileId, 'preview')}
              className={`p-1 rounded text-[11px] flex items-center gap-1 transition ${
                activeTab.previewMode === 'preview' ? 'bg-emerald-600 text-black font-semibold' : 'text-zinc-400 hover:text-white'
              }`}
              title="Rendered Markdown Preview"
            >
              <Eye className="w-3 h-3" />
            </button>
          </div>
        )}

        <button
          onClick={onCloseAllTabs}
          className="text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition"
          title="Close All Tabs"
        >
          Close All
        </button>
      </div>
    </div>
  );
};
