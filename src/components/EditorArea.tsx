/**
 * Monaco Editor & Media/Markdown Workspace Area.
 * Supports lazy file loading states for H2_CLOUD_BRIDGE v1.3 (H2_READ_FILE_REQ)
 * and read-only session enforcement (accessMode === "readonly").
 *
 * Official Documentation:
 * - Monaco Editor React: https://github.com/suren-atoyan/monaco-react
 */

import React, { useRef, useEffect, useState } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { CloudFile, EditorTheme, OpenTab } from '../types/ide';
import {
  getMonacoLanguage,
  isImageFile,
  isVideoFile,
  isAudioFile,
  isPdfFile,
  isMarkdownFile,
  isKnownBinaryExtension,
  looksLikeBinaryContent,
} from '../utils/fileSystem';
import { registerMonarchThemesAndLanguages } from '../utils/monarchThemes';
import { MarkdownViewer } from './MarkdownViewer';
import { MediaViewer } from './MediaViewer';
import {
  Search,
  Radio,
  FileCode,
  FileSearch,
  RotateCw,
  AlertTriangle,
  DownloadCloud,
  Lock,
  FilePlus,
} from 'lucide-react';

interface EditorAreaProps {
  activeFile: CloudFile | null;
  activeTab: OpenTab | undefined;
  activeTheme: EditorTheme;
  wordWrap: boolean;
  minimap: boolean;
  fontSize?: number;
  tabSize?: number;
  isReadOnly?: boolean;
  isConnectingBridge?: boolean;
  isBridgeConnected?: boolean;
  bridgeStatusView?: React.ReactNode;
  bridgeDebuggerView?: React.ReactNode;
  preferencesView?: React.ReactNode;
  onLoadSampleWorkspace?: () => void;
  onContentChange: (fileId: string, newContent: string) => void;
  onSaveFile: (file: CloudFile) => void;
  onSaveAsFile?: (file: CloudFile) => void;
  onNewFile?: () => void;
  onRetryLoadFile: (file: CloudFile, encodingOverride?: 'utf-8' | 'base64') => void;
  onCursorChange: (pos: { line: number; col: number }, selectionLength: number) => void;
  onOpenQuickOpen: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSearch: () => void;
  onOpenFile: (fileId: string) => void;
  files: CloudFile[];
  focusTrigger?: { fileId: string; nonce: number } | null;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  activeFile,
  activeTab,
  activeTheme,
  wordWrap,
  minimap,
  fontSize = 13.5,
  tabSize = 2,
  isReadOnly = false,
  isConnectingBridge = false,
  isBridgeConnected = false,
  bridgeStatusView,
  bridgeDebuggerView,
  preferencesView,
  onLoadSampleWorkspace,
  onContentChange,
  onSaveFile,
  onSaveAsFile,
  onNewFile,
  onRetryLoadFile,
  onCursorChange,
  onOpenQuickOpen,
  onOpenCommandPalette,
  onOpenSearch,
  onOpenFile,
  files,
  focusTrigger = null,
}) => {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<any>(null);
  const onCursorChangeRef = useRef(onCursorChange);
  const onSaveFileRef = useRef(onSaveFile);
  const onSaveAsFileRef = useRef(onSaveAsFile);
  const onNewFileRef = useRef(onNewFile);
  const onOpenQuickOpenRef = useRef(onOpenQuickOpen);
  const onOpenCommandPaletteRef = useRef(onOpenCommandPalette);
  const activeFileRef = useRef(activeFile);
  const focusTriggerRef = useRef(focusTrigger);
  // Tracks the last externalVersion synced into each Monaco model so rapid local typing is never overwritten
  const syncedExternalVersionRef = useRef<Record<string, number>>({});
  const [forcedTextFileIds, setForcedTextFileIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    focusTriggerRef.current = focusTrigger;
  }, [focusTrigger]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    onOpenQuickOpenRef.current = onOpenQuickOpen;
    onOpenCommandPaletteRef.current = onOpenCommandPalette;
  }, [onOpenQuickOpen, onOpenCommandPalette]);

  useEffect(() => {
    onSaveFileRef.current = onSaveFile;
    onSaveAsFileRef.current = onSaveAsFile;
    onNewFileRef.current = onNewFile;
    activeFileRef.current = activeFile;
  }, [onSaveFile, onSaveAsFile, onNewFile, activeFile]);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    registerMonarchThemesAndLanguages(monaco);
    monaco.editor.setTheme(activeTheme);

    if (activeFileRef.current) {
      syncedExternalVersionRef.current[activeFileRef.current.id] =
        activeFileRef.current.externalVersion ?? 0;
    }

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFileRef.current) {
        onSaveFileRef.current(activeFileRef.current);
      }
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
      () => {
        if (activeFileRef.current) {
          onSaveAsFileRef.current?.(activeFileRef.current);
        }
      }
    );

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyN,
      () => {
        if (activeFileRef.current) {
          onSaveAsFileRef.current?.(activeFileRef.current);
        }
      }
    );

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyN, () => {
      onNewFileRef.current?.();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      onOpenQuickOpenRef.current();
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      () => {
        onOpenCommandPaletteRef.current?.();
      }
    );

    editor.addCommand(monaco.KeyCode.F1, () => {
      onOpenCommandPaletteRef.current?.();
    });

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

    // If editor just mounted specifically for a newly created file, jump cursor to start and focus
    if (
      activeFileRef.current &&
      (focusTriggerRef.current?.fileId === activeFileRef.current.id ||
        activeFileRef.current.isUntitled)
    ) {
      requestAnimationFrame(() => {
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.revealPosition({ lineNumber: 1, column: 1 });
        editor.focus();
      });
    }
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(activeTheme);
    }
  }, [activeTheme]);

  // Synchronize Monaco model content ONLY when content changed externally (never during user typing)
  useEffect(() => {
    if (!activeFile || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const model = monaco.editor.getModel(monaco.Uri.parse(activeFile.id));
    if (!model) return;

    const extVer = activeFile.externalVersion ?? 0;
    const prevSynced = syncedExternalVersionRef.current[activeFile.id];

    if (prevSynced !== extVer) {
      if (model.getValue() !== activeFile.content) {
        model.setValue(activeFile.content);
      }
      syncedExternalVersionRef.current[activeFile.id] = extVer;
    }
  }, [activeFile?.id, activeFile?.externalVersion, activeFile?.content]);

  const activeLanguage = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';

  // Ensure Monaco switches syntax highlighting cleanly when an untitled or renamed file gets a new extension
  useEffect(() => {
    if (!activeFile || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const model = monaco.editor.getModel(monaco.Uri.parse(activeFile.id));
    if (model && model.getLanguageId() !== activeLanguage) {
      monaco.editor.setModelLanguage(model, activeLanguage);
    }
  }, [activeFile?.id, activeLanguage]);

  // Jump cursor to line 1 col 1 and focus Monaco whenever a new file is triggered (File -> New / Alt+N)
  useEffect(() => {
    if (!focusTrigger || !activeFile || activeFile.id !== focusTrigger.fileId) return;
    if (!editorRef.current) return;

    const timer = window.setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.setPosition({ lineNumber: 1, column: 1 });
      editor.revealPosition({ lineNumber: 1, column: 1 });
      editor.focus();
    }, 20);

    return () => window.clearTimeout(timer);
  }, [focusTrigger, activeFile?.id]);

  // Render full-page Extension Bridge & Preferences views when selected as tabs
  if (activeTab?.kind === 'bridge-status' && bridgeStatusView) {
    return <>{bridgeStatusView}</>;
  }

  if (activeTab?.kind === 'bridge-debugger' && bridgeDebuggerView) {
    return <>{bridgeDebuggerView}</>;
  }

  if (activeTab?.kind === 'preferences' && preferencesView) {
    return <>{preferencesView}</>;
  }

  // Welcome Hero when no file or virtual tab is open
  if (!activeFile) {
    const workspaceFiles = files.filter(f => !f.isDirectory && !f.isUntitled);
    const recentFiles = workspaceFiles.slice(0, 6);
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#18181b] p-6 text-center select-auto">
        <div className="max-w-lg w-full space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-xl shadow-emerald-950/30">
            <Radio className="w-8 h-8 text-white" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              FreshFood Rocks <span className="text-emerald-600 dark:text-emerald-400">Monarch IDE</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 font-mono">
              Target Host: <span className="text-emerald-700 dark:text-emerald-300">https://ide.freshfood.rocks</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <button
              type="button"
              onClick={onNewFile}
              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-blue-500/60 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 transition group shadow-2xs"
            >
              <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-semibold text-xs">
                <FilePlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>New File</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 font-mono">
                Alt+N
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenQuickOpen}
              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-emerald-500/60 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 transition group shadow-2xs"
            >
              <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 font-semibold text-xs">
                <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Quick Open</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 font-mono">Ctrl+P</div>
            </button>

            <button
              type="button"
              onClick={onOpenSearch}
              className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-blue-500/60 hover:bg-slate-100/70 dark:hover:bg-zinc-800/70 transition group shadow-2xs"
            >
              <div className="flex items-center gap-2 text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 font-semibold text-xs">
                <FileSearch className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Search Workspace</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1 font-mono font-normal">
                Ctrl+Shift+F
              </div>
            </button>
          </div>

          <div className="text-left bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 font-mono tracking-wider mb-2">
              Workspace Files ({workspaceFiles.length})
            </div>
            <div className="space-y-1">
              {recentFiles.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-zinc-500 py-2 space-y-2">
                  <div className="italic">
                    {isConnectingBridge
                      ? 'Connecting to Clockie H2 extension bridge...'
                      : isBridgeConnected
                      ? 'Bridge connected. Select a drive in the sidebar to load its files.'
                      : 'No workspace files loaded yet. Open Bridge → Status or select a connected drive.'}
                  </div>
                  {!isConnectingBridge && !isBridgeConnected && onLoadSampleWorkspace && (
                    <button
                      type="button"
                      onClick={onLoadSampleWorkspace}
                      className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Load sample workspace files
                    </button>
                  )}
                </div>
              ) : (
                recentFiles.map(file => (
                  <div
                    key={file.id}
                    onClick={() => onOpenFile(file.id)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/80 cursor-pointer text-xs transition"
                  >
                    <span className="font-mono text-slate-700 dark:text-zinc-300 flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{file.path}</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 shrink-0 ml-2">
                      {file.cloudProvider}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lazy load state
  if (activeFile.isLoadingContent) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#18181b] p-6 text-center select-auto">
        <RotateCw className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-spin mb-3" />
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          Fetching {activeFile.name}...
        </div>
        <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-1">
          Sending H2_READ_FILE_REQ ({activeFile.cloudProvider}) for {activeFile.path}
        </div>
      </div>
    );
  }

  // Lazy load error or unloaded state
  if (activeFile.loadError || activeFile.contentLoaded === false) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#18181b] p-6 text-center select-auto space-y-3">
        {activeFile.loadError ? (
          <>
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            <div className="text-sm font-semibold text-red-700 dark:text-red-300">
              Failed to load {activeFile.name}
            </div>
            <div className="text-xs text-slate-600 dark:text-zinc-400 font-mono max-w-md">
              {activeFile.loadError}
            </div>
          </>
        ) : (
          <>
            <DownloadCloud className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {activeFile.name} (Metadata Loaded)
            </div>
            <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono max-w-md">
              Content is fetched lazily over H2_READ_FILE_REQ when requested.
            </div>
          </>
        )}
        <button
          onClick={() => onRetryLoadFile(activeFile)}
          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Fetch File Content</span>
        </button>
      </div>
    );
  }

  const isImg = isImageFile(activeFile.name);
  const isVid = isVideoFile(activeFile.name);
  const isAud = isAudioFile(activeFile.name, activeFile.mimeType);
  const isPdf = isPdfFile(activeFile.name, activeFile.mimeType);
  const isExplicitBinary =
    Boolean(activeFile.isBinary) ||
    activeFile.contentType === 'binary' ||
    activeFile.encoding === 'base64' ||
    isKnownBinaryExtension(activeFile.name);
  const isHeuristicBinary =
    !isExplicitBinary &&
    !forcedTextFileIds[activeFile.id] &&
    looksLikeBinaryContent(activeFile.content);

  if (isImg || isVid || isAud || isPdf || isExplicitBinary || isHeuristicBinary) {
    return (
      <MediaViewer
        file={activeFile}
        onRetryBase64={() => onRetryLoadFile(activeFile, 'base64')}
        canForceTextOpen={isHeuristicBinary}
        onForceTextOpen={() =>
          setForcedTextFileIds(prev => ({ ...prev, [activeFile.id]: true }))
        }
      />
    );
  }

  const isMd = isMarkdownFile(activeFile.name);
  const previewMode = activeTab?.previewMode || 'split';

  if (isMd && previewMode === 'preview') {
    return <MarkdownViewer content={activeFile.content} filename={activeFile.name} />;
  }

  const language = getMonacoLanguage(activeFile.name);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white dark:bg-[#18181b]">
      {isReadOnly && (
        <div className="px-3 py-1 bg-red-50 dark:bg-red-950/60 border-b border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200 text-[11px] flex items-center gap-2 shrink-0">
          <Lock className="w-3 h-3 text-red-600 dark:text-red-400" />
          <span>Read-only session active — editing and saving are disabled by the extension.</span>
        </div>
      )}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Code Editor */}
        <div className={`h-full ${isMd && previewMode === 'split' ? 'w-1/2 border-r border-slate-200 dark:border-zinc-800' : 'w-full'}`}>
          <Editor
            height="100%"
            path={activeFile.id}
            language={language}
            defaultValue={activeFile.content}
            theme={activeTheme}
            onMount={handleEditorMount}
            onChange={val => {
              if (!isReadOnly) {
                onContentChange(activeFile.id, val ?? '');
              }
            }}
            options={{
              readOnly: isReadOnly,
              fontSize,
              fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
              fontLigatures: true,
              tabSize,
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
          <div className="h-full w-1/2 overflow-hidden bg-slate-50 dark:bg-[#141416]">
            <MarkdownViewer content={activeFile.content} filename={activeFile.name} />
          </div>
        )}
      </div>
    </div>
  );
};
