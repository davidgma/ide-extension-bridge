import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FileText, ChevronRight } from 'lucide-react';
import { CloudFile } from '../types/ide';

interface SearchWorkspaceModalProps {
  isOpen: boolean;
  files: CloudFile[];
  onClose: () => void;
  onSelectFile: (fileId: string) => void;
}

interface MatchResult {
  file: CloudFile;
  lineNumber: number;
  lineContent: string;
}

export const SearchWorkspaceModal: React.FC<SearchWorkspaceModalProps> = ({
  isOpen,
  files,
  onClose,
  onSelectFile,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const results: MatchResult[] = [];
  if (searchTerm.trim().length >= 2) {
    for (const file of files) {
      if (file.isBinary) continue;
      const lines = file.content.split('\n');
      lines.forEach((line, idx) => {
        const matches = isCaseSensitive
          ? line.includes(searchTerm)
          : line.toLowerCase().includes(searchTerm.toLowerCase());
        if (matches) {
          results.push({
            file,
            lineNumber: idx + 1,
            lineContent: line.trim(),
          });
        }
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/70 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1c1c1f] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden select-none flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="p-3 border-b border-zinc-800 bg-zinc-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search all files in workspace..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none font-mono"
          />
          <button
            onClick={() => setIsCaseSensitive(!isCaseSensitive)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition ${
              isCaseSensitive ? 'bg-emerald-600 text-black border-emerald-500 font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}
            title="Match Case"
          >
            Aa
          </button>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {searchTerm.trim().length < 2 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              Type at least 2 characters to search across all workspace files...
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No occurrences found for "{searchTerm}"
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-[11px] text-zinc-400 px-3 py-1 font-mono">
                Found {results.length} result{results.length === 1 ? '' : 's'}:
              </div>
              {results.map((res, i) => (
                <div
                  key={`${res.file.id}-${res.lineNumber}-${i}`}
                  onClick={() => {
                    onSelectFile(res.file.id);
                    onClose();
                  }}
                  className="p-2.5 rounded-lg hover:bg-zinc-800/80 cursor-pointer text-xs border border-transparent hover:border-zinc-700/60 transition group"
                >
                  <div className="flex items-center justify-between text-zinc-400 mb-1">
                    <span className="font-semibold text-zinc-200 group-hover:text-emerald-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-400" />
                      {res.file.path}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      Line {res.lineNumber}
                    </span>
                  </div>
                  <pre className="font-mono text-[11px] text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-850 truncate">
                    <code>{res.lineContent}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/60 text-[11px] text-zinc-500 flex justify-between">
          <span>Search files in workspace</span>
          <span>Press <kbd className="bg-zinc-800 px-1 rounded text-zinc-400">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
