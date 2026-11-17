/**
 * Main Application Entry & Workspace Orchestrator for FreshFood Rocks - Monarch IDE.
 * Coordinates file state, open editor tabs, Monaco editor preferences, and
 * Clockie H2 Bridge Protocol v1.1 (H2_CLOUD_BRIDGE) communication.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - FileReader Web API: https://developer.mozilla.org/en-US/docs/Web/API/FileReader
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CloudFile, CloudProvider, EditorTheme, OpenTab } from './types/ide';
import { INITIAL_CLOUD_FILES, inferMimeType } from './utils/fileSystem';
import { H2SaveFileRes, H2DeleteFileRes } from './utils/h2BridgeClient';
import { useExtensionBridge } from './hooks/useExtensionBridge';
import { executeCode, RunResult } from './utils/codeRunner';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TabsBar } from './components/TabsBar';
import { EditorArea } from './components/EditorArea';
import { OutputConsole } from './components/OutputConsole';
import { ExtensionDebugger } from './components/ExtensionDebugger';
import { StatusBar } from './components/StatusBar';
import { ExtensionBridgeModal } from './components/ExtensionBridgeModal';
import { QuickOpenModal } from './components/QuickOpenModal';
import { SearchWorkspaceModal } from './components/SearchWorkspaceModal';
import { ShortcutsModal } from './components/ShortcutsModal';

export default function App() {
  // State: Workspace files & cloud provider metadata
  const [files, setFiles] = useState<CloudFile[]>(INITIAL_CLOUD_FILES);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('Standalone');
  const [workspaceName, setWorkspaceName] = useState('FreshFood Vault');

  // State: Open tabs
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { fileId: 'file-readme', path: 'README.md', title: 'README.md', previewMode: 'split' },
    { fileId: 'file-engine-ts', path: 'src/api/freshfood-engine.ts', title: 'freshfood-engine.ts', previewMode: 'code' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('file-readme');

  // State: Editor preferences
  const [activeTheme, setActiveTheme] = useState<EditorTheme>('freshfood-dark');
  const [wordWrap, setWordWrap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State: Cursor telemetry
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectionLength, setSelectionLength] = useState(0);

  // State: Code execution
  const [consoleResult, setConsoleResult] = useState<RunResult | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // State: Extension Debugger drawer & modals
  const [isDebuggerOpen, setIsDebuggerOpen] = useState(false);
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const readCloudFileRef = useRef<((file: CloudFile) => Promise<void>) | null>(null);

  // Status toast helper
  const notify = useCallback((msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(current => (current === msg ? null : current));
    }, 3500);
  }, []);

  // Clockie H2 Bridge Protocol v1.1 (H2_CLOUD_BRIDGE) hook
  const {
    sessionId,
    extensionStatus,
    handshakeInfo,
    messagesLog,
    isSaving,
    startBridge,
    stopBridge,
    readCloudFile,
    saveCloudFile,
    saveAllCloudFiles,
    deleteCloudItem,
    clearLogs,
  } = useExtensionBridge({
    onWorkspaceTreeLoaded: (incomingItems, provider, rootName, primaryRelativePath) => {
      const primaryFile = primaryRelativePath
        ? incomingItems.find(item => !item.isDirectory && item.path === primaryRelativePath)
        : undefined;

      // Replace standalone demo workspace with live metadata tree from extension
      const hydratedList = primaryFile
        ? incomingItems.map(item =>
            item.id === primaryFile.id
              ? { ...item, isLoadingContent: true, loadError: undefined }
              : item
          )
        : incomingItems;

      setFiles(hydratedList);
      setCloudProvider(provider);
      setWorkspaceName(rootName || 'Cloud Workspace');

      if (primaryFile) {
        setOpenTabs([
          {
            fileId: primaryFile.id,
            path: primaryFile.path,
            title: primaryFile.name,
            previewMode: 'split',
          },
        ]);
        setActiveTabId(primaryFile.id);
        readCloudFileRef.current?.(primaryFile);
      } else {
        setOpenTabs([]);
        setActiveTabId(null);
      }

      const fileCount = incomingItems.filter(i => !i.isDirectory).length;
      const folderCount = incomingItems.filter(i => i.isDirectory).length;
      notify(`Loaded ${fileCount} files, ${folderCount} folders from ${provider}`);
    },

    onFileContentLoaded: (relativePath, updatedFields) => {
      setFiles(prev =>
        prev.map(f =>
          !f.isDirectory && f.path === relativePath ? { ...f, ...updatedFields } : f
        )
      );
    },

    onFileContentLoadError: (relativePath, error) => {
      setFiles(prev =>
        prev.map(f =>
          !f.isDirectory && f.path === relativePath
            ? { ...f, isLoadingContent: false, loadError: error }
            : f
        )
      );
      notify(`Failed to load ${relativePath}: ${error}`);
    },

    onFileSaveConfirmed: (localId, res: H2SaveFileRes) => {
      setFiles(prev =>
        prev.map(f =>
          f.id === localId
            ? {
                ...f,
                cloudFileId: res.fileId ?? f.cloudFileId,
                parentId: res.parentFolderId ?? f.parentId,
                path: res.relativePath || f.path,
                name: res.filename || f.name,
                size: res.sizeBytes ?? f.size,
                modifiedMs: res.modifiedMs ?? f.modifiedMs,
                lastModified: res.modifiedMs
                  ? new Date(res.modifiedMs).toLocaleTimeString()
                  : new Date().toLocaleTimeString(),
                isDirty: false,
              }
            : f
        )
      );
      setOpenTabs(prev =>
        prev.map(t =>
          t.fileId === localId
            ? {
                ...t,
                path: res.relativePath || t.path,
                title: res.filename || t.title,
                isDirty: false,
              }
            : t
        )
      );
      notify(`Saved ${res.filename || res.relativePath} to ${res.provider || cloudProvider}`);
    },

    onFileSaveError: (_localId, error) => {
      notify(`Save error: ${error}`);
    },

    onItemDeleted: (itemType, relativePath, res: H2DeleteFileRes) => {
      const removedIds = new Set<string>();
      setFiles(prev => {
        const next: CloudFile[] = [];
        for (const item of prev) {
          const isMatch =
            itemType === 'folder'
              ? item.path === relativePath || item.path.startsWith(`${relativePath}/`)
              : item.path === relativePath || (Boolean(res.fileId) && item.cloudFileId === res.fileId);
          if (isMatch) {
            removedIds.add(item.id);
          } else {
            next.push(item);
          }
        }
        return next;
      });

      setOpenTabs(prevTabs => {
        const remaining = prevTabs.filter(
          t =>
            !removedIds.has(t.fileId) &&
            !(itemType === 'folder' && (t.path === relativePath || t.path.startsWith(`${relativePath}/`))) &&
            t.path !== relativePath
        );
        setActiveTabId(curr => {
          if (!curr) return null;
          const stillOpen = remaining.some(t => t.fileId === curr);
          return stillOpen ? curr : remaining[remaining.length - 1]?.fileId ?? null;
        });
        return remaining;
      });

      notify(`${res.trashed ? 'Trashed' : 'Deleted'} ${relativePath}`);
    },

    onItemDeleteError: (relativePath, error) => {
      notify(`Delete failed (${relativePath}): ${error}`);
    },
  });

  useEffect(() => {
    readCloudFileRef.current = readCloudFile;
  }, [readCloudFile]);

  const activeFile = useMemo(
    () => files.find(f => f.id === activeTabId && !f.isDirectory) || null,
    [files, activeTabId]
  );
  const activeTab = useMemo(
    () => openTabs.find(t => t.fileId === activeTabId),
    [openTabs, activeTabId]
  );

  const lineCount = useMemo(() => {
    if (!activeFile || activeFile.isBinary || activeFile.contentLoaded === false) return 0;
    return activeFile.content.split('\n').length;
  }, [activeFile?.content, activeFile?.isBinary, activeFile?.contentLoaded]);

  const charCount = useMemo(() => {
    if (!activeFile || activeFile.isBinary || activeFile.contentLoaded === false) return 0;
    return activeFile.content.length;
  }, [activeFile?.content, activeFile?.isBinary, activeFile?.contentLoaded]);

  const handleCursorChange = useCallback((pos: { line: number; col: number }, selLen: number) => {
    setCursorPos(prev => (prev.line === pos.line && prev.col === pos.col ? prev : pos));
    setSelectionLength(prev => (prev === selLen ? prev : selLen));
  }, []);

  // File selection & lazy H2_READ_FILE_REQ hydration
  const handleSelectFile = useCallback(
    (fileId: string) => {
      const file = files.find(f => f.id === fileId);
      if (!file || file.isDirectory) return;

      setOpenTabs(prev => {
        const exists = prev.some(t => t.fileId === fileId);
        if (exists) return prev;
        return [...prev, { fileId: file.id, path: file.path, title: file.name, previewMode: 'split' }];
      });
      setActiveTabId(fileId);

      if (file.contentLoaded === false && !file.isLoadingContent) {
        setFiles(prev =>
          prev.map(f => (f.id === fileId ? { ...f, isLoadingContent: true, loadError: undefined } : f))
        );
        readCloudFile(file);
      }
    },
    [files, readCloudFile]
  );

  // Retry failed lazy load
  const handleRetryLoadFile = useCallback(
    (file: CloudFile) => {
      setFiles(prev =>
        prev.map(f => (f.id === file.id ? { ...f, isLoadingContent: true, loadError: undefined } : f))
      );
      readCloudFile(file);
    },
    [readCloudFile]
  );

  // Tab close
  const handleCloseTab = useCallback(
    (fileId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setOpenTabs(prev => {
        const nextTabs = prev.filter(t => t.fileId !== fileId);
        if (activeTabId === fileId) {
          if (nextTabs.length > 0) {
            const closedIdx = prev.findIndex(t => t.fileId === fileId);
            const nextActive = nextTabs[Math.max(0, closedIdx - 1)];
            setActiveTabId(nextActive.fileId);
          } else {
            setActiveTabId(null);
          }
        }
        return nextTabs;
      });
    },
    [activeTabId]
  );

  const handleCloseAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabId(null);
  }, []);

  const handleCloseOtherTabs = useCallback((keepFileId: string) => {
    setOpenTabs(prev => prev.filter(t => t.fileId === keepFileId));
    setActiveTabId(keepFileId);
  }, []);

  const handleSetPreviewMode = useCallback((fileId: string, mode: 'code' | 'split' | 'preview') => {
    setOpenTabs(prev => prev.map(t => (t.fileId === fileId ? { ...t, previewMode: mode } : t)));
  }, []);

  // Content edits
  const handleContentChange = useCallback((fileId: string, newContent: string) => {
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, content: newContent, isDirty: true } : f))
    );
  }, []);

  // Save current file
  const handleSaveCurrent = useCallback(() => {
    if (activeFile) {
      saveCloudFile(activeFile);
    }
  }, [activeFile, saveCloudFile]);

  // Save all dirty files
  const handleSaveAll = useCallback(() => {
    const dirtyFiles = files.filter(f => !f.isDirectory && f.isDirty);
    if (dirtyFiles.length > 0) {
      saveAllCloudFiles(dirtyFiles);
      notify(`Saving ${dirtyFiles.length} files to ${cloudProvider}...`);
    } else {
      notify('All files are up-to-date');
    }
  }, [files, saveAllCloudFiles, cloudProvider, notify]);

  // Run Code (blocks if content has not been lazily loaded yet)
  const handleRunCode = useCallback(() => {
    if (!activeFile) return;
    if (activeFile.contentLoaded === false) {
      notify('Fetching file content before executing...');
      handleRetryLoadFile(activeFile);
      return;
    }

    setIsRunningCode(true);
    setIsConsoleOpen(true);
    setTimeout(() => {
      const res = executeCode(activeFile.name, activeFile.content);
      setConsoleResult(res);
      setIsRunningCode(false);
      if (res.success) {
        notify(`Executed ${activeFile.name}`);
      } else {
        notify(`Execution error in ${activeFile.name}`);
      }
    }, 120);
  }, [activeFile, handleRetryLoadFile, notify]);

  // Create new file (supports nested relative paths like src/utils/new.ts via H2_SAVE_FILE_REQ)
  const handleCreateFile = useCallback(
    (rawPath: string, content = '') => {
      const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/');
      const name = parts[parts.length - 1];
      const parentRelativePath = parts.slice(0, -1).join('/');

      const newFile: CloudFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        path: cleanPath,
        parentRelativePath,
        content,
        contentLoaded: true,
        mimeType: inferMimeType(name),
        contentType: 'text',
        encoding: 'utf-8',
        cloudProvider,
        lastModified: new Date().toLocaleTimeString(),
        isDirty: extensionStatus !== 'connected',
      };

      setFiles(prev => [...prev, newFile]);
      setOpenTabs(prev => [
        ...prev,
        { fileId: newFile.id, path: newFile.path, title: newFile.name, previewMode: 'split' },
      ]);
      setActiveTabId(newFile.id);

      if (extensionStatus === 'connected') {
        saveCloudFile(newFile);
      } else {
        notify(`Created ${cleanPath}`);
      }
    },
    [cloudProvider, extensionStatus, saveCloudFile, notify]
  );

  // Create empty directory entry
  const handleCreateFolder = useCallback(
    (rawFolderPath: string) => {
      const cleanPath = rawFolderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/');
      const name = parts[parts.length - 1];
      const parentRelativePath = parts.slice(0, -1).join('/');

      setFiles(prev => {
        if (prev.some(item => item.isDirectory && item.path === cleanPath)) {
          return prev;
        }
        const newFolder: CloudFile = {
          id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          path: cleanPath,
          parentRelativePath,
          content: '',
          contentLoaded: true,
          isDirectory: true,
          cloudProvider,
          lastModified: new Date().toLocaleTimeString(),
        };
        return [...prev, newFolder];
      });
      notify(`Created folder ${cleanPath}`);
    },
    [cloudProvider, notify]
  );

  // Delete file (dispatches H2_DELETE_FILE_REQ when bridge is connected)
  const handleDeleteFile = useCallback(
    (fileId: string) => {
      const target = files.find(f => f.id === fileId && !f.isDirectory);
      if (!target) return;

      if (extensionStatus === 'connected') {
        deleteCloudItem({
          itemType: 'file',
          relativePath: target.path,
          fileId: target.cloudFileId,
          permanent: false,
        });
      } else {
        setFiles(prev => prev.filter(f => f.id !== fileId));
        handleCloseTab(fileId);
        notify(`Deleted ${target.path}`);
      }
    },
    [files, extensionStatus, deleteCloudItem, handleCloseTab, notify]
  );

  // Delete folder & descendants (dispatches H2_DELETE_FILE_REQ when bridge is connected)
  const handleDeleteFolder = useCallback(
    (folderPath: string, folderId?: string) => {
      const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      if (extensionStatus === 'connected') {
        deleteCloudItem({
          itemType: 'folder',
          relativePath: cleanPath,
          folderId,
          permanent: false,
        });
      } else {
        const removedIds = new Set(
          files
            .filter(f => f.path === cleanPath || f.path.startsWith(`${cleanPath}/`))
            .map(f => f.id)
        );
        setFiles(prev => prev.filter(f => !removedIds.has(f.id)));
        setOpenTabs(prev => prev.filter(t => !removedIds.has(t.fileId)));
        if (activeTabId && removedIds.has(activeTabId)) {
          setActiveTabId(null);
        }
        notify(`Deleted folder ${cleanPath}`);
      }
    },
    [extensionStatus, deleteCloudItem, files, activeTabId, notify]
  );

  // Rename file locally (marks dirty so Cmd+S syncs to cloud path)
  const handleRenameFile = useCallback(
    (fileId: string, newPath: string) => {
      const cleanPath = newPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;
      const newName = cleanPath.split('/').pop() || cleanPath;
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, path: cleanPath, name: newName, isDirty: true } : f))
      );
      setOpenTabs(prev =>
        prev.map(t => (t.fileId === fileId ? { ...t, path: cleanPath, title: newName } : t))
      );
      notify(`Renamed to ${newName}`);
    },
    [notify]
  );

  // Upload files from local disk
  const handleUploadFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      Array.from(fileList).forEach(f => {
        const isImg = f.type.startsWith('image/') && !f.type.includes('svg');
        const isVid = f.type.startsWith('video/');
        const resolvedMime = f.type || inferMimeType(f.name);
        const targetPath = `uploads/${f.name}`;

        if (isImg || isVid) {
          const reader = new FileReader();
          reader.onload = evt => {
            const dataUrl = (evt.target?.result as string) || '';
            const commaIdx = dataUrl.indexOf(',');
            const base64Content = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
            const newFile: CloudFile = {
              id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: f.name,
              path: targetPath,
              parentRelativePath: 'uploads',
              content: base64Content,
              contentLoaded: true,
              isBinary: true,
              contentType: 'binary',
              encoding: 'base64',
              binaryUrl: dataUrl,
              mimeType: resolvedMime,
              size: f.size,
              cloudProvider,
              lastModified: new Date().toLocaleTimeString(),
              isDirty: true,
            };
            setFiles(prev => [...prev, newFile]);
            setOpenTabs(prev => [
              ...prev,
              { fileId: newFile.id, path: newFile.path, title: newFile.name, previewMode: 'code' },
            ]);
            setActiveTabId(newFile.id);
          };
          reader.readAsDataURL(f);
        } else {
          const reader = new FileReader();
          reader.onload = evt => {
            const text = (evt.target?.result as string) || '';
            const newFile: CloudFile = {
              id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: f.name,
              path: targetPath,
              parentRelativePath: 'uploads',
              content: text,
              contentLoaded: true,
              contentType: 'text',
              encoding: 'utf-8',
              mimeType: resolvedMime,
              size: f.size,
              cloudProvider,
              lastModified: new Date().toLocaleTimeString(),
              isDirty: true,
            };
            setFiles(prev => [...prev, newFile]);
            setOpenTabs(prev => [
              ...prev,
              { fileId: newFile.id, path: newFile.path, title: newFile.name, previewMode: 'split' },
            ]);
            setActiveTabId(newFile.id);
          };
          reader.readAsText(f);
        }
      });

      notify(`Imported ${fileList.length} files`);
      e.target.value = '';
    },
    [cloudProvider, notify]
  );

  // Export workspace as JSON
  const handleExportWorkspace = useCallback(() => {
    const exportData = {
      workspace: workspaceName,
      domain: 'ide.freshfood.rocks',
      protocol: 'H2_CLOUD_BRIDGE',
      protocolVersion: '1.1',
      exportedAt: new Date().toISOString(),
      provider: cloudProvider,
      files: files
        .filter(f => !f.isDirectory)
        .map(f => ({
          path: f.path,
          name: f.name,
          contentLoaded: f.contentLoaded !== false,
          content: f.content,
          cloudProvider: f.cloudProvider,
        })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freshfood-monarch-workspace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Workspace JSON exported');
  }, [workspaceName, cloudProvider, files, notify]);

  // Global keybindings
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCurrent();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSaveCurrent]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-zinc-200 select-auto overflow-hidden">
      {/* Top Header */}
      <Header
        activeFile={activeFile}
        files={files}
        sessionId={sessionId}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        isSaving={isSaving}
        activeTheme={activeTheme}
        wordWrap={wordWrap}
        minimap={minimap}
        lineCount={lineCount}
        charCount={charCount}
        isRunningCode={isRunningCode}
        onThemeChange={setActiveTheme}
        onToggleWordWrap={() => setWordWrap(!wordWrap)}
        onToggleMinimap={() => setMinimap(!minimap)}
        onSaveCurrent={handleSaveCurrent}
        onSaveAll={handleSaveAll}
        onStartBridge={() => startBridge()}
        onStopBridge={stopBridge}
        onRunCode={handleRunCode}
        onOpenQuickOpen={() => setIsQuickOpenOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
      />

      {/* Main Workspace: Sidebar + Editor + Drawers */}
      <div className="flex-1 flex overflow-hidden">
        {isSidebarOpen && (
          <Sidebar
            files={files}
            activeFileId={activeTabId}
            cloudProvider={cloudProvider}
            workspaceName={workspaceName}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onCreateFolder={handleCreateFolder}
            onDeleteFile={handleDeleteFile}
            onDeleteFolder={handleDeleteFolder}
            onRenameFile={handleRenameFile}
            onUploadFiles={handleUploadFiles}
            onExportWorkspace={handleExportWorkspace}
          />
        )}

        {/* Center Editor Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#18181b]">
          <TabsBar
            openTabs={openTabs}
            activeTabId={activeTabId}
            files={files}
            onSelectTab={handleSelectFile}
            onCloseTab={handleCloseTab}
            onCloseAllTabs={handleCloseAllTabs}
            onCloseOtherTabs={handleCloseOtherTabs}
            onSetPreviewMode={handleSetPreviewMode}
          />

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <EditorArea
                activeFile={activeFile}
                activeTab={activeTab}
                activeTheme={activeTheme}
                wordWrap={wordWrap}
                minimap={minimap}
                onContentChange={handleContentChange}
                onSaveFile={saveCloudFile}
                onRetryLoadFile={handleRetryLoadFile}
                onCursorChange={handleCursorChange}
                onOpenQuickOpen={() => setIsQuickOpenOpen(true)}
                onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
                onOpenFile={handleSelectFile}
                files={files}
              />
            </div>

            {/* Extension Debugger Drawer */}
            <ExtensionDebugger
              isOpen={isDebuggerOpen}
              sessionId={sessionId}
              messagesLog={messagesLog}
              extensionStatus={extensionStatus}
              handshakeInfo={handshakeInfo}
              onClose={() => setIsDebuggerOpen(false)}
              onClearLogs={clearLogs}
              onConnectWithSession={startBridge}
            />

            {/* Output / Terminal Drawer */}
            <OutputConsole
              isOpen={isConsoleOpen}
              activeFile={activeFile?.name || 'Untitled'}
              result={consoleResult}
              isRunning={isRunningCode}
              onClose={() => setIsConsoleOpen(false)}
              onClear={() => setConsoleResult(null)}
              onRunAgain={handleRunCode}
            />
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        activeFile={activeFile}
        cursorPos={cursorPos}
        selectionLength={selectionLength}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        isSaving={isSaving}
        statusNotification={statusNotification}
        onStartBridge={() => startBridge()}
        onStopBridge={stopBridge}
        onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
        onToggleConsole={() => setIsConsoleOpen(prev => !prev)}
        isConsoleOpen={isConsoleOpen}
        onToggleDebugger={() => setIsDebuggerOpen(prev => !prev)}
        isDebuggerOpen={isDebuggerOpen}
      />

      {/* Extension Bridge Inspector Modal */}
      <ExtensionBridgeModal
        isOpen={isBridgeModalOpen}
        onClose={() => setIsBridgeModalOpen(false)}
        sessionId={sessionId}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        messagesLog={messagesLog}
        onStartBridge={startBridge}
        onStopBridge={stopBridge}
        onClearLogs={clearLogs}
      />

      {/* Quick Open (Cmd+P) Modal */}
      <QuickOpenModal
        isOpen={isQuickOpenOpen}
        files={files}
        onClose={() => setIsQuickOpenOpen(false)}
        onSelectFile={handleSelectFile}
      />

      {/* Global Workspace Search (Cmd+Shift+F) Modal */}
      <SearchWorkspaceModal
        isOpen={isSearchOpen}
        files={files}
        onClose={() => setIsSearchOpen(false)}
        onSelectFile={handleSelectFile}
      />

      {/* Shortcuts & Documentation Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
