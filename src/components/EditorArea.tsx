import React, { useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { CloudFile, EditorTheme, OpenTab } from '../types/ide';
import { getMonacoLanguage, isImageFile, isVideoFile, isMarkdownFile } from '../utils/fileSystem';
import { registerMonarchThemesAndLanguages } from '../utils/monarchThemes';
import { MarkdownViewer } from './MarkdownViewer';
import { MediaViewer } from './MediaViewer';
import { 
  Code2, 
  Terminal, 
  Search, 
  Radio, 
  HardDrive, 
  BookOpen, 
  Plus, 
  Zap, 
  CheckCircle2,
  FileCode
} from 'lucide-react';

interface EditorAreaProps {
  activeFile: CloudFile | null;
  activeTab: OpenTab | undefined;
  activeTheme: EditorTheme;
  wordWrap: boolean;
  minimap: boolean;
  onContentChange: (fileId: string, newContent: string) => void;
  onSaveFile: (file: CloudFile) => void;
  onCursorChange: (pos: { line: number; col: number }, selectionLength: number) => void;
  onOpenQuickOpen: () => void;
  onOpenBridgeModal: () => void;
  onOpenFile: (fileId: string) => void;
  files: CloudFile[];
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  activeFile,
  activeTab,
  activeTheme,
  wordWrap,
  minimap,
  onContentChange,
  onSaveFile,
  onCursorChange,
  onOpenQuickOpen,
  onOpenBridgeModal,
  onOpenFile,
  files,
}) => {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<any>(null);
  const onCursorChangeRef = useRef(onCursorChange);
  const onSaveFileRef = useRef(onSaveFile);
  const activeFileRef = useRef(activeFile);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    onSaveFileRef.current = onSaveFile;
    activeFileRef.current = activeFile;
  }, [onSaveFile, activeFile]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Register Monarch themes & custom tokens
    registerMonarchThemesAndLanguages(monaco);
    monaco.editor.setTheme(activeTheme);

    // Keyboard shortcut for Cmd+S / Ctrl+S inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFileRef.current) {
        onSaveFileRef.current(activeFileRef.current);
      }
    });

    // Quick open shortcut Cmd+P / Ctrl+P inside Monaco
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      onOpenQuickOpen();
    });

    // Track cursor movements and selection
    editor.onDidChangeCursorPosition(e => {
      onCursorChangeRef.current({ line: e.position.lineNumber, col: e.position.column }, 0);
    });

    editor.onDidChangeCursorSelection(e => {
      const model = editor.getModel();
      if (model) {
        const text = model.getValueInRange(e.selection);
        onCursorChangeRef.current(
          { line: e.selection.positionLineNumber, col: e.selection.positionColumn },
          text.length
        );
      }
    });
  };

  // Sync theme changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(activeTheme);
    }
  }, [activeTheme]);

  // If no file is open: Welcome Hero
  if (!activeFile) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#18181b] p-6 text-center select-auto">
        <div className="max-w-md w-full space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-2xl shadow-emerald-950/60">
            <Radio className="w-8 h-8 text-black animate-pulse" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              FreshFood Rocks <span className="text-emerald-400">Monarch IDE</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-2 font-mono">
              Target Host: <span className="text-emerald-300">https://ide.freshfood.rocks</span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Cloud Studio connected with Clockie McClockface Chrome Extension
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-left">
            <button
              onClick={onOpenQuickOpen}
              className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-850 transition group"
            >
              <div className="flex items-center gap-2 text-zinc-200 group-hover:text-emerald-400 font-semibold text-xs">
                <Search className="w-4 h-4 text-emerald-400" />
                <span>Quick Open</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono">⌘P / Ctrl+P</div>
            </button>

            <button
              onClick={onOpenBridgeModal}
              className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 hover:bg-zinc-850 transition group"
            >
              <div className="flex items-center gap-2 text-zinc-200 group-hover:text-emerald-400 font-semibold text-xs">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Bridge Protocol</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-1 font-mono font-normal">Inspect / Test</div>
            </button>
          </div>

          {/* Quick file pickers from loaded files */}
          <div className="text-left bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
            <div className="text-[10px] font-bold text-zinc-500 font-mono tracking-wider mb-2">
              Recent Workspace Files
            </div>
            <div className="space-y-1">
              {files.slice(0, 4).map(file => (
                <div
                  key={file.id}
                  onClick={() => onOpenFile(file.id)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-800/80 cursor-pointer text-xs transition"
                >
                  <span className="font-mono text-zinc-300 flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                    {file.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {file.cloudProvider}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle binary media files
  if (isImageFile(activeFile.name) || isVideoFile(activeFile.name)) {
    return <MediaViewer file={activeFile} />;
  }

  // Handle Markdown files with preview or split modes
  const isMd = isMarkdownFile(activeFile.name);
  const previewMode = activeTab?.previewMode || 'split';

  if (isMd && previewMode === 'preview') {
    return <MarkdownViewer content={activeFile.content} filename={activeFile.name} />;
  }

  const language = getMonacoLanguage(activeFile.name);

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#18181b]">
      {/* Code Editor */}
      <div className={`h-full ${isMd && previewMode === 'split' ? 'w-1/2 border-r border-zinc-800' : 'w-full'}`}>
        <Editor
          height="100%"
          language={language}
          value={activeFile.content}
          theme={activeTheme}
          onMount={handleEditorMount}
          onChange={val => onContentChange(activeFile.id, val || '')}
          options={{
            fontSize: 13.5,
            fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
            fontLigatures: true,
            tabSize: 2,
            minimap: { enabled: minimap },
            wordWrap: wordWrap ? 'on' : 'off',
            automaticLayout: true,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            contextmenu: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>

      {/* Markdown Live Preview on right (Split mode) */}
      {isMd && previewMode === 'split' && (
        <div className="h-full w-1/2 overflow-hidden bg-[#141416]">
          <MarkdownViewer content={activeFile.content} filename={activeFile.name} />
        </div>
      )}
    </div>
  );
};
