import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileCode, FileText, Image as ImageIcon, Film } from 'lucide-react';
import { CloudFile } from '../types/ide';
import { getFileExtension, isImageFile, isVideoFile, isMarkdownFile } from '../utils/fileSystem';

interface QuickOpenModalProps {
  isOpen: boolean;
  files: CloudFile[];
  onClose: () => void;
  onSelectFile: (fileId: string) => void;
}

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  isOpen,
  files,
  onClose,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = files.filter(f =>
    !query || f.path.toLowerCase().includes(query.toLowerCase()) || f.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1 < filtered.length ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 >= 0 ? i - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectFile(filtered[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#1c1c1f] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden select-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900/90">
          <Search className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a file name or path to open..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-mono"
          />
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results list */}
        <div className="max-h-72 overflow-y-auto p-1 divide-y divide-zinc-800/40">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-500">
              No matching files found
            </div>
          ) : (
            filtered.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              const isImg = isImageFile(file.name);
              const isVid = isVideoFile(file.name);
              const isMd = isMarkdownFile(file.name);

              return (
                <div
                  key={file.id}
                  onClick={() => {
                    onSelectFile(file.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg text-xs transition ${
                    isSelected ? 'bg-emerald-950/60 text-white' : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isImg ? (
                      <ImageIcon className="w-4 h-4 text-pink-400 shrink-0" />
                    ) : isVid ? (
                      <Film className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : isMd ? (
                      <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                    ) : (
                      <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <span className="font-mono text-zinc-200">{file.name}</span>
                    <span className="text-zinc-500 font-mono text-[11px] truncate">
                      {file.path}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 shrink-0 ml-2">
                    {file.cloudProvider}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Modal footer hints */}
        <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-[11px] text-zinc-500">
          <span>
            Navigate: <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">↑</kbd> <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">↓</kbd>
          </span>
          <span>
            Select: <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Enter</kbd> | Close: <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Esc</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
