/**
 * Main Application Entry & Workspace Orchestrator for FreshFood Rocks - Monarch IDE.
 * Coordinates file state, open editor tabs, Monaco editor preferences, and
 * Clockie H2 Bridge Protocol v1.3 (H2_CLOUD_BRIDGE) communication:
 * - Zero-URL session binding via per-tab window.sessionStorage
 * - Unified H2_CONNECT_REQ/RES startup (launchedScope & direct modes)
 * - Depth-limited multi-drive & driveRoot switching + lazy folder expansion
 * - Lazy / concurrent file reads, read-only capability guards, and clean disconnect
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CloudFile, CloudProvider, EditorTheme, OpenTab } from './types/ide';
import { INITIAL_CLOUD_FILES, inferMimeType } from './utils/fileSystem';
import { H2SaveFileRes, H2DeleteFileRes } from './utils/h2BridgeClient';
import { useExtensionBridge } from './hooks/useExtensionBridge';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';
import { useIdeSettings } from './hooks/useIdeSettings';
import { executeCode, RunResult } from './utils/codeRunner';
import { MenuBar } from './components/MenuBar';
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
import { PreferencesExportModal } from './components/PreferencesExportModal';
import { PreferencesImportModal } from './components/PreferencesImportModal';
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  // State: Workspace files & cloud provider metadata
  const [files, setFiles] = useState<CloudFile[]>(INITIAL_CLOUD_FILES);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('Standalone');
  const [selectedDrive, setSelectedDrive] = useState<CloudProvider | undefined>(undefined);
  const [workspaceName, setWorkspaceName] = useState('FreshFood Vault');

  // State: Open tabs
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    { fileId: 'file-readme', path: 'README.md', title: 'README.md', previewMode: 'split' },
    { fileId: 'file-engine-ts', path: 'src/api/freshfood-engine.ts', title: 'freshfood-engine.ts', previewMode: 'code' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>('file-readme');

  // State: Persisted IDE preferences & Light/Dark theme (stored in localStorage)
  const {
    settings,
    setColorMode,
    toggleColorMode,
    setEditorTheme,
    updateSettings,
    resetSettings,
    importSettingsFromJson,
  } = useIdeSettings();
  const activeTheme = settings.editorTheme;
  const wordWrap = settings.wordWrap;
  const minimap = settings.minimap;
  const isSidebarOpen = settings.sidebarOpen;

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
  const [isExportPrefsOpen, setIsExportPrefsOpen] = useState(false);
  const [isImportPrefsOpen, setIsImportPrefsOpen] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const readCloudFileRef = useRef<((file: CloudFile) => Promise<void>) | null>(null);

  // Status toast helper
  const notify = useCallback((msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(current => (current === msg ? null : current));
    }, 3500);
  }, []);

  // Clockie H2 Bridge Protocol v1.3 (H2_CLOUD_BRIDGE) hook
  const {
    sessionId,
    extensionStatus,
    handshakeInfo,
    connectionError,
    connectionReasonCode,
    messagesLog,
    isSaving,
    startBridge,
    stopBridge,
    requestWorkspaceTree,
    switchDriveRoot,
    expandFolder,
    readCloudFile,
    saveCloudFile,
    saveAllCloudFiles,
    deleteCloudItem,
    listDriveEntries,
    readRawCloudFile,
    saveRawCloudFile,
    dismissConnectionError,
    clearLogs,
  } = useExtensionBridge({
    onWorkspaceTreeLoaded: (incomingItems, provider, rootName, primaryRelativePath) => {
      const primaryFile = primaryRelativePath
        ? incomingItems.find(item => !item.isDirectory && item.path === primaryRelativePath)
        : undefined;

      const hydratedList = primaryFile
        ? incomingItems.map(item =>
            item.id === primaryFile.id
              ? { ...item, isLoadingContent: true, loadError: undefined }
              : item
          )
        : incomingItems;

      setFiles(hydratedList);
      setCloudProvider(provider);
      setSelectedDrive(provider);
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

    onFolderChildrenLoaded: (basePath, provider, childrenItems) => {
      setFiles(prev => {
        const cleanBase = basePath.replace(/^\/+|\/+$/g, '');
        const existingMap = new Map<string, CloudFile>();
        for (const item of prev) {
          const key = `${item.isDirectory ? 'dir' : 'file'}:${item.cloudProvider}:${item.path}`;
          if (item.isDirectory && item.path === cleanBase && (!provider || item.cloudProvider === provider)) {
            existingMap.set(key, {
              ...item,
              childrenLoaded: true,
              isLoadingChildren: false,
            });
          } else {
            existingMap.set(key, item);
          }
        }

        for (const child of childrenItems) {
          const key = `${child.isDirectory ? 'dir' : 'file'}:${child.cloudProvider}:${child.path}`;
          const prevItem = existingMap.get(key);
          if (prevItem && !child.isDirectory && prevItem.contentLoaded) {
            existingMap.set(key, {
              ...prevItem,
              size: child.size ?? prevItem.size,
              modifiedMs: child.modifiedMs ?? prevItem.modifiedMs,
            });
          } else {
            existingMap.set(key, child);
          }
        }

        return Array.from(existingMap.values());
      });
    },

    onFolderChildrenLoadError: (basePath, error) => {
      const cleanBase = basePath.replace(/^\/+|\/+$/g, '');
      setFiles(prev =>
        prev.map(item =>
          item.isDirectory && item.path === cleanBase
            ? { ...item, isLoadingChildren: false }
            : item
        )
      );
      notify(`Failed to list ${cleanBase}: ${error}`);
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

  // Keep the browser tab favicon black when disconnected/connecting and deep red when connected
  useDynamicFavicon(extensionStatus === 'connected');

  // Derived v1.3 permission / capability flags
  const isReadOnly = extensionStatus === 'connected' && handshakeInfo?.accessMode === 'readonly';
  const canSave = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.save !== false);
  const canCreateFiles = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.createFiles !== false);
  const canCreateFolders = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.createFolders !== false);
  const canDeleteFiles = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.deleteFiles !== false);
  const canDeleteFolders = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.deleteFolders !== false);

  const connectedDrives = useMemo<CloudProvider[]>(() => {
    const driveMap = handshakeInfo?.drives;
    if (driveMap && typeof driveMap === 'object') {
      const list = Object.entries(driveMap)
        .filter(([, st]) => st?.connected)
        .map(([drive]) => drive);
      if (list.length > 0) return list;
    }
    if (handshakeInfo?.provider && handshakeInfo.provider !== 'all') {
      return [handshakeInfo.provider];
    }
    return ['pcloud'];
  }, [handshakeInfo?.drives, handshakeInfo?.provider]);

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

  // Lazy folder expansion via H2_LIST_FOLDER_REQ
  const handleExpandFolder = useCallback(
    (folder: CloudFile) => {
      setFiles(prev =>
        prev.map(item =>
          item.id === folder.id ? { ...item, isLoadingChildren: true } : item
        )
      );
      expandFolder(folder, 1);
    },
    [expandFolder]
  );

  // Switch connected drives (passes driveRoot: true so launched sessions can also browse full drive roots)
  const handleSelectDrive = useCallback(
    (drive: CloudProvider) => {
      setSelectedDrive(drive);
      switchDriveRoot(drive, 2);
    },
    [switchDriveRoot]
  );

  // Return from full driveRoot view back to originally launchedScope
  const handleReturnToLaunchedScope = useCallback(() => {
    const scope = handshakeInfo?.launchedScope;
    if (!scope) return;
    setSelectedDrive(scope.provider);
    requestWorkspaceTree({
      provider: scope.provider,
      driveRoot: false,
      maxDepth: 2,
      primaryRelativePathOverride: scope.primaryRelativePath || '',
      launchedItemTypeOverride: scope.launchedItemType,
      fallbackRootName: scope.rootName,
    });
  }, [handshakeInfo?.launchedScope, requestWorkspaceTree]);

  const handleRefreshTree = useCallback(() => {
    requestWorkspaceTree({
      provider: selectedDrive || handshakeInfo?.provider || 'all',
      driveRoot: Boolean(handshakeInfo?.driveRootActive),
      maxDepth: 2,
    });
  }, [selectedDrive, handshakeInfo?.provider, handshakeInfo?.driveRootActive, requestWorkspaceTree]);

  // Retry failed lazy file load
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
  const handleContentChange = useCallback(
    (fileId: string, newContent: string) => {
      if (isReadOnly) return;
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, content: newContent, isDirty: true } : f))
      );
    },
    [isReadOnly]
  );

  // Save current file
  const handleSaveCurrent = useCallback(() => {
    if (!activeFile) return;
    if (isReadOnly || !canSave) {
      notify('Workspace is in read-only mode (saving disabled)');
      return;
    }
    saveCloudFile(activeFile);
  }, [activeFile, isReadOnly, canSave, saveCloudFile, notify]);

  // Save all dirty files
  const handleSaveAll = useCallback(() => {
    if (isReadOnly || !canSave) {
      notify('Workspace is in read-only mode (saving disabled)');
      return;
    }
    const dirtyFiles = files.filter(f => !f.isDirectory && f.isDirty);
    if (dirtyFiles.length > 0) {
      saveAllCloudFiles(dirtyFiles);
      notify(`Saving ${dirtyFiles.length} files to ${cloudProvider}...`);
    } else {
      notify('All files are up-to-date');
    }
  }, [isReadOnly, canSave, files, saveAllCloudFiles, cloudProvider, notify]);

  // Run Code
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

  // Create new file
  const handleCreateFile = useCallback(
    (rawPath: string, content = '') => {
      if (isReadOnly || !canCreateFiles) {
        notify('File creation is disabled in read-only mode');
        return;
      }

      const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/');
      const name = parts[parts.length - 1];
      const parentRelativePath = parts.slice(0, -1).join('/');
      const targetProvider =
        selectedDrive && selectedDrive !== 'all' ? selectedDrive : cloudProvider;

      const newFile: CloudFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        path: cleanPath,
        parentRelativePath,
        content,
        contentLoaded: true,
        driveRoot: Boolean(handshakeInfo?.driveRootActive),
        mimeType: inferMimeType(name),
        contentType: 'text',
        encoding: 'utf-8',
        cloudProvider: targetProvider,
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
    [
      isReadOnly,
      canCreateFiles,
      selectedDrive,
      cloudProvider,
      handshakeInfo?.driveRootActive,
      extensionStatus,
      saveCloudFile,
      notify,
    ]
  );

  // Create directory entry
  const handleCreateFolder = useCallback(
    (rawFolderPath: string) => {
      if (isReadOnly || !canCreateFolders) {
        notify('Folder creation is disabled in read-only mode');
        return;
      }

      const cleanPath = rawFolderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/');
      const name = parts[parts.length - 1];
      const parentRelativePath = parts.slice(0, -1).join('/');
      const targetProvider =
        selectedDrive && selectedDrive !== 'all' ? selectedDrive : cloudProvider;

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
          childrenLoaded: true,
          driveRoot: Boolean(handshakeInfo?.driveRootActive),
          isDirectory: true,
          cloudProvider: targetProvider,
          lastModified: new Date().toLocaleTimeString(),
        };
        return [...prev, newFolder];
      });
      notify(`Created folder ${cleanPath}`);
    },
    [isReadOnly, canCreateFolders, selectedDrive, cloudProvider, handshakeInfo?.driveRootActive, notify]
  );

  // Delete file
  const handleDeleteFile = useCallback(
    (fileId: string) => {
      if (isReadOnly || !canDeleteFiles) {
        notify('File deletion is disabled in read-only mode');
        return;
      }

      const target = files.find(f => f.id === fileId && !f.isDirectory);
      if (!target) return;

      if (extensionStatus === 'connected') {
        deleteCloudItem({
          provider: target.cloudProvider,
          driveRoot: Boolean(target.driveRoot ?? handshakeInfo?.driveRootActive),
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
    [isReadOnly, canDeleteFiles, files, extensionStatus, handshakeInfo?.driveRootActive, deleteCloudItem, handleCloseTab, notify]
  );

  // Delete folder & descendants
  const handleDeleteFolder = useCallback(
    (folderPath: string, folderId?: string, folderProvider?: CloudProvider) => {
      if (isReadOnly || !canDeleteFolders) {
        notify('Folder deletion is disabled in read-only mode');
        return;
      }

      const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      if (extensionStatus === 'connected') {
        deleteCloudItem({
          provider: folderProvider || cloudProvider,
          driveRoot: Boolean(handshakeInfo?.driveRootActive),
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
    [
      isReadOnly,
      canDeleteFolders,
      extensionStatus,
      handshakeInfo?.driveRootActive,
      deleteCloudItem,
      cloudProvider,
      files,
      activeTabId,
      notify,
    ]
  );

  // Rename file locally
  const handleRenameFile = useCallback(
    (fileId: string, newPath: string) => {
      if (isReadOnly) {
        notify('Rename is disabled in read-only mode');
        return;
      }
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
    [isReadOnly, notify]
  );

  // Upload files from local disk
  const handleUploadFiles = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly || !canCreateFiles) {
        notify('File uploads are disabled in read-only mode');
        return;
      }
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;

      const targetProvider =
        selectedDrive && selectedDrive !== 'all' ? selectedDrive : cloudProvider;

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
              driveRoot: Boolean(handshakeInfo?.driveRootActive),
              isBinary: true,
              contentType: 'binary',
              encoding: 'base64',
              binaryUrl: dataUrl,
              mimeType: resolvedMime,
              size: f.size,
              cloudProvider: targetProvider,
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
              driveRoot: Boolean(handshakeInfo?.driveRootActive),
              contentType: 'text',
              encoding: 'utf-8',
              mimeType: resolvedMime,
              size: f.size,
              cloudProvider: targetProvider,
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
    [isReadOnly, canCreateFiles, selectedDrive, cloudProvider, handshakeInfo?.driveRootActive, notify]
  );

  // Export workspace as JSON
  const handleExportWorkspace = useCallback(() => {
    const exportData = {
      workspace: workspaceName,
      domain: 'ide.freshfood.rocks',
      protocol: 'H2_CLOUD_BRIDGE',
      protocolVersion: '1.3',
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
        updateSettings({ sidebarOpen: !isSidebarOpen });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSaveCurrent, updateSettings, isSidebarOpen]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-zinc-200 select-auto overflow-hidden">
      {/* Minimal Always-Visible Main Menu Bar (expanded in Step 4) */}
      <MenuBar
        colorMode={settings.colorMode}
        onSetColorMode={mode => {
          setColorMode(mode);
          notify(`Switched to ${mode === 'light' ? 'Light' : 'Dark'} mode`);
        }}
        onToggleColorMode={() => {
          const next = settings.colorMode === 'dark' ? 'Light' : 'Dark';
          toggleColorMode();
          notify(`Switched to ${next} mode`);
        }}
        onOpenExportPreferences={() => setIsExportPrefsOpen(true)}
        onOpenImportPreferences={() => setIsImportPrefsOpen(true)}
        onResetPreferences={() => {
          resetSettings();
          notify('Preferences reset to defaults');
        }}
      />

      {/* Top Header */}
      <Header
        activeFile={activeFile}
        files={files}
        sessionId={sessionId}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        isSaving={isSaving}
        isReadOnly={isReadOnly}
        canSave={canSave}
        activeTheme={activeTheme}
        wordWrap={wordWrap}
        minimap={minimap}
        lineCount={lineCount}
        charCount={charCount}
        isRunningCode={isRunningCode}
        onThemeChange={setEditorTheme}
        onToggleWordWrap={() => updateSettings({ wordWrap: !wordWrap })}
        onToggleMinimap={() => updateSettings({ minimap: !minimap })}
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

      {/* Graceful Connection Refusal Notice */}
      {connectionError && extensionStatus !== 'connected' && (
        <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/70 border-b border-red-200 dark:border-red-500/40 text-red-900 dark:text-red-100 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>
              <strong>H2 Bridge Notice{connectionReasonCode ? ` (${connectionReasonCode})` : ''}:</strong>{' '}
              {connectionError}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => startBridge()}
              className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition"
            >
              Retry Connect
            </button>
            <button
              onClick={dismissConnectionError}
              className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/60 rounded text-red-700 dark:text-red-300"
              title="Dismiss notice"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace: Sidebar + Editor + Drawers */}
      <div className="flex-1 flex overflow-hidden">
        {isSidebarOpen && (
          <Sidebar
            files={files}
            activeFileId={activeTabId}
            cloudProvider={cloudProvider}
            workspaceName={workspaceName}
            isConnected={extensionStatus === 'connected'}
            isReadOnly={isReadOnly}
            canCreateFiles={canCreateFiles}
            canCreateFolders={canCreateFolders}
            canDeleteFiles={canDeleteFiles}
            canDeleteFolders={canDeleteFolders}
            drives={handshakeInfo?.drives}
            selectedDrive={selectedDrive}
            launchedScope={handshakeInfo?.launchedScope}
            driveRootActive={handshakeInfo?.driveRootActive}
            onSelectDrive={handleSelectDrive}
            onReturnToLaunchedScope={handleReturnToLaunchedScope}
            onRefreshTree={handleRefreshTree}
            onExpandFolder={handleExpandFolder}
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-[#18181b]">
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
                fontSize={settings.fontSize}
                tabSize={settings.tabSize}
                isReadOnly={isReadOnly}
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
              connectionError={connectionError}
              connectionReasonCode={connectionReasonCode}
              onClose={() => setIsDebuggerOpen(false)}
              onClearLogs={clearLogs}
              onConnectBridge={() => startBridge()}
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
        tabSize={settings.tabSize}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        isSaving={isSaving}
        isReadOnly={isReadOnly}
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
        connectionError={connectionError}
        connectionReasonCode={connectionReasonCode}
        messagesLog={messagesLog}
        onConnectBridge={() => startBridge()}
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

      {/* Export Preferences to JSON Modal (Step 1b) */}
      <PreferencesExportModal
        isOpen={isExportPrefsOpen}
        settings={settings}
        isBridgeConnected={extensionStatus === 'connected'}
        isReadOnly={isReadOnly}
        canSave={canSave}
        availableDrives={connectedDrives}
        listDriveEntries={listDriveEntries}
        saveRawCloudFile={saveRawCloudFile}
        onPersistExportOptions={updateSettings}
        onExportSuccess={notify}
        onClose={() => setIsExportPrefsOpen(false)}
      />

      {/* Import Preferences from JSON Modal (Step 1b) */}
      <PreferencesImportModal
        isOpen={isImportPrefsOpen}
        settings={settings}
        isBridgeConnected={extensionStatus === 'connected'}
        availableDrives={connectedDrives}
        listDriveEntries={listDriveEntries}
        readRawCloudFile={readRawCloudFile}
        onImportPreferences={importSettingsFromJson}
        onImportSuccess={notify}
        onClose={() => setIsImportPrefsOpen(false)}
      />
    </div>
  );
}
