/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CloudFile, CloudProvider, EditorTheme, OpenTab } from './types/ide';
import { INITIAL_CLOUD_FILES } from './utils/fileSystem';
import { useExtensionBridge } from './hooks/useExtensionBridge';
import { executeCode, RunResult } from './utils/codeRunner';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TabsBar } from './components/TabsBar';
import { EditorArea } from './components/EditorArea';
import { OutputConsole } from './components/OutputConsole';
import { StatusBar } from './components/StatusBar';
import { ExtensionBridgeModal } from './components/ExtensionBridgeModal';
import { QuickOpenModal } from './components/QuickOpenModal';
import { SearchWorkspaceModal } from './components/SearchWorkspaceModal';
import { ShortcutsModal } from './components/ShortcutsModal';

export default function App() {
  // State: Workspace files
  const [files, setFiles] = useState<CloudFile[]>(INITIAL_CLOUD_FILES);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('pCloud');
  const [workspaceName, setWorkspaceName] = useState('FreshFood Vault');

  // State: Tabs
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { fileId: 'file-readme', path: 'README.md', title: 'README.md', previewMode: 'split' },
    { fileId: 'file-engine-ts', path: 'src/api/freshfood-engine.ts', title: 'freshfood-engine.ts', previewMode: 'code' },
    { fileId: 'file-logo-svg', path: 'assets/freshfood-logo.svg', title: 'freshfood-logo.svg', previewMode: 'code' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('file-readme');

  // State: Editor preferences
  const [activeTheme, setActiveTheme] = useState<EditorTheme>('freshfood-dark');
  const [wordWrap, setWordWrap] = useState(true);
  const [minimap, setMinimap] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State: Cursor
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectionLength, setSelectionLength] = useState(0);

  // State: Code Execution
  const [consoleResult, setConsoleResult] = useState<RunResult | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isRunningCode, setIsRunningCode] = useState(false);

  // State: Modals & Notification
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Notification helper
  const notify = useCallback((msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(current => (current === msg ? null : current));
    }, 3500);
  }, []);

  // Extension Bridge Hook with manual start/stop
  const {
    extensionStatus,
    handshakeInfo,
    messagesLog,
    isSaving,
    startBridge,
    stopBridge,
    saveCloudFile,
    saveAllCloudFiles,
    simulateHandshake,
    simulateLoadPreset,
    clearLogs,
  } = useExtensionBridge({
    onFilesLoaded: (incomingFiles, provider, newWorkspaceName) => {
      setFiles(incomingFiles);
      if (provider) setCloudProvider(provider);
      if (newWorkspaceName) setWorkspaceName(newWorkspaceName);
      
      if (incomingFiles.length > 0) {
        const first = incomingFiles[0];
        setOpenTabs([{ fileId: first.id, path: first.path, title: first.name, previewMode: 'split' }]);
        setActiveTabId(first.id);
      }
      notify(`Loaded ${incomingFiles.length} files from ${provider || 'Cloud Extension'}`);
    },
    onFileSaveConfirmed: (fileId, timestamp) => {
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, isDirty: false, lastModified: new Date(timestamp).toLocaleTimeString() } : f))
      );
      const savedFile = files.find(f => f.id === fileId);
      notify(`Saved ${savedFile?.name || 'file'} to ${savedFile?.cloudProvider || cloudProvider}`);
    },
    onFileSaveError: (fileId, error) => {
      notify(`Save error: ${error}`);
    },
  });

  const activeFile = useMemo(() => files.find(f => f.id === activeTabId) || null, [files, activeTabId]);
  const activeTab = useMemo(() => openTabs.find(t => t.fileId === activeTabId), [openTabs, activeTabId]);

  const lineCount = useMemo(() => {
    if (!activeFile || activeFile.isBinary) return 0;
    return activeFile.content.split('\n').length;
  }, [activeFile?.content, activeFile?.isBinary]);

  const charCount = useMemo(() => {
    if (!activeFile || activeFile.isBinary) return 0;
    return activeFile.content.length;
  }, [activeFile?.content, activeFile?.isBinary]);

  const handleCursorChange = useCallback((pos: { line: number; col: number }, selLen: number) => {
    setCursorPos(prev => (prev.line === pos.line && prev.col === pos.col ? prev : pos));
    setSelectionLength(prev => (prev === selLen ? prev : selLen));
  }, []);

  // File selection
  const handleSelectFile = useCallback((fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    setOpenTabs(prev => {
      const exists = prev.some(t => t.fileId === fileId);
      if (exists) return prev;
      return [...prev, { fileId: file.id, path: file.path, title: file.name, previewMode: 'split' }];
    });
    setActiveTabId(fileId);
  }, [files]);

  // Tab close
  const handleCloseTab = useCallback((fileId: string, e?: React.MouseEvent) => {
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
  }, [activeTabId]);

  const handleCloseAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabId(null);
  }, []);

  const handleCloseOtherTabs = useCallback((keepFileId: string) => {
    setOpenTabs(prev => prev.filter(t => t.fileId === keepFileId));
    setActiveTabId(keepFileId);
  }, []);

  const handleSetPreviewMode = useCallback((fileId: string, mode: 'code' | 'split' | 'preview') => {
    setOpenTabs(prev =>
      prev.map(t => (t.fileId === fileId ? { ...t, previewMode: mode } : t))
    );
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

  // Save all files
  const handleSaveAll = useCallback(() => {
    const dirtyFiles = files.filter(f => f.isDirty);
    if (dirtyFiles.length > 0) {
      saveAllCloudFiles(dirtyFiles);
      notify(`Saved ${dirtyFiles.length} changed files to ${cloudProvider}`);
    } else {
      notify('All files are up-to-date in cloud');
    }
  }, [files, saveAllCloudFiles, cloudProvider, notify]);

  // Run Code
  const handleRunCode = useCallback(() => {
    if (!activeFile) return;
    setIsRunningCode(true);
    setIsConsoleOpen(true);
    setTimeout(() => {
      const res = executeCode(activeFile.name, activeFile.content);
      setConsoleResult(res);
      setIsRunningCode(false);
      if (res.success) {
        notify(`Executed ${activeFile.name} successfully`);
      } else {
        notify(`Execution error in ${activeFile.name}`);
      }
    }, 120);
  }, [activeFile, notify]);

  // Create new file
  const handleCreateFile = useCallback((path: string, content = '') => {
    const name = path.split('/').pop() || path;
    const newFile: CloudFile = {
      id: `file-${Date.now()}`,
      name,
      path,
      content,
      cloudProvider,
      lastModified: new Date().toLocaleTimeString(),
      isDirty: true,
    };
    setFiles(prev => [...prev, newFile]);
    handleSelectFile(newFile.id);
    notify(`Created ${name}`);
  }, [cloudProvider, handleSelectFile, notify]);

  // Create new folder
  const handleCreateFolder = useCallback((folderPath: string) => {
    const placeholder: CloudFile = {
      id: `file-${Date.now()}`,
      name: '.gitkeep',
      path: `${folderPath}/.gitkeep`,
      content: '',
      cloudProvider,
      lastModified: new Date().toLocaleTimeString(),
      isDirty: false,
    };
    setFiles(prev => [...prev, placeholder]);
    notify(`Created directory ${folderPath}`);
  }, [cloudProvider, notify]);

  // Delete file
  const handleDeleteFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    handleCloseTab(fileId);
    notify('File deleted');
  }, [handleCloseTab, notify]);

  // Rename file
  const handleRenameFile = useCallback((fileId: string, newPath: string) => {
    const newName = newPath.split('/').pop() || newPath;
    setFiles(prev =>
      prev.map(f => (f.id === fileId ? { ...f, path: newPath, name: newName, isDirty: true } : f))
    );
    setOpenTabs(prev =>
      prev.map(t => (t.fileId === fileId ? { ...t, path: newPath, title: newName } : t))
    );
    notify(`Renamed to ${newName}`);
  }, [notify]);

  // Upload files from local machine
  const handleUploadFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    Array.from(fileList).forEach(f => {
      const isImg = f.type.startsWith('image/');
      const isVid = f.type.startsWith('video/');

      if (isImg || isVid) {
        const url = URL.createObjectURL(f);
        const newFile: CloudFile = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: f.name,
          path: `uploads/${f.name}`,
          content: '',
          isBinary: true,
          binaryUrl: url,
          mimeType: f.type,
          size: f.size,
          cloudProvider,
          lastModified: new Date().toLocaleTimeString(),
        };
        setFiles(prev => [...prev, newFile]);
        handleSelectFile(newFile.id);
      } else {
        const reader = new FileReader();
        reader.onload = evt => {
          const text = (evt.target?.result as string) || '';
          const newFile: CloudFile = {
            id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: f.name,
            path: `uploads/${f.name}`,
            content: text,
            cloudProvider,
            lastModified: new Date().toLocaleTimeString(),
            isDirty: true,
          };
          setFiles(prev => [...prev, newFile]);
          handleSelectFile(newFile.id);
        };
        reader.readAsText(f);
      }
    });

    notify(`Imported ${fileList.length} files`);
    e.target.value = '';
  }, [cloudProvider, handleSelectFile, notify]);

  // Export workspace as JSON
  const handleExportWorkspace = useCallback(() => {
    const exportData = {
      workspace: workspaceName,
      domain: 'ide.freshfood.rocks',
      exportedAt: new Date().toISOString(),
      provider: cloudProvider,
      files: files.map(f => ({
        path: f.path,
        name: f.name,
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

      // Cmd+S: Save
      if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCurrent();
      }

      // Cmd+P: Quick open
      if (isCmdOrCtrl && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
      }

      // Cmd+Shift+F: Global search
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }

      // Cmd+B: Toggle sidebar
      if (isCmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSaveCurrent]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#18181b] text-zinc-200 select-none overflow-hidden">
      {/* Top Header with manual extension bridge start/stop and Run button */}
      <Header
        activeFile={activeFile}
        files={files}
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
        onStartBridge={startBridge}
        onStopBridge={stopBridge}
        onRunCode={handleRunCode}
        onOpenQuickOpen={() => setIsQuickOpenOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
        onOpenShortcutsModal={() => setIsShortcutsOpen(true)}
      />

      {/* Main Workspace: Sidebar + Editor + Console */}
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
            onSelectTab={setActiveTabId}
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
                onCursorChange={handleCursorChange}
                onOpenQuickOpen={() => setIsQuickOpenOpen(true)}
                onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
                onOpenFile={handleSelectFile}
                files={files}
              />
            </div>

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
        onStartBridge={startBridge}
        onStopBridge={stopBridge}
        onOpenBridgeModal={() => setIsBridgeModalOpen(true)}
        onToggleConsole={() => setIsConsoleOpen(prev => !prev)}
        isConsoleOpen={isConsoleOpen}
      />

      {/* Extension Bridge Console & Inspector Modal */}
      <ExtensionBridgeModal
        isOpen={isBridgeModalOpen}
        onClose={() => setIsBridgeModalOpen(false)}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        messagesLog={messagesLog}
        onSendPing={startBridge}
        onSimulateHandshake={simulateHandshake}
        onSimulateLoadPreset={simulateLoadPreset}
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
