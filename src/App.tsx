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
import {
  CloudFile,
  CloudProvider,
  OpenTab,
  OpenTabKind,
  BRIDGE_STATUS_TAB_ID,
  BRIDGE_DEBUGGER_TAB_ID,
  PREFERENCES_TAB_ID,
} from './types/ide';
import { INITIAL_CLOUD_FILES, inferMimeType } from './utils/fileSystem';
import { H2SaveFileRes, H2DeleteFileRes } from './utils/h2BridgeClient';
import { useExtensionBridge } from './hooks/useExtensionBridge';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';
import { useIdeSettings } from './hooks/useIdeSettings';
import { MenuBar } from './components/MenuBar';
import { Sidebar, SidebarFolderActionSignal } from './components/Sidebar';
import { TabsBar } from './components/TabsBar';
import { EditorArea } from './components/EditorArea';
import { ExtensionBridgeStatusPage } from './components/ExtensionBridgeStatusPage';
import { ExtensionDebuggerPage } from './components/ExtensionDebuggerPage';
import { PreferencesPage } from './components/PreferencesPage';
import { StatusBar } from './components/StatusBar';
import { CommandPaletteModal, IdeCommand } from './components/CommandPaletteModal';
import { SearchWorkspaceModal } from './components/SearchWorkspaceModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { AboutModal } from './components/AboutModal';
import { PreferencesExportModal } from './components/PreferencesExportModal';
import { PreferencesImportModal } from './components/PreferencesImportModal';
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  // State: Workspace files & cloud provider metadata (start empty to avoid flashing demo tabs before Clockie H2 responds)
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('Standalone');
  const [selectedDrive, setSelectedDrive] = useState<CloudProvider | undefined>(undefined);
  const [workspaceName, setWorkspaceName] = useState('Cloud Workspace');

  // State: Open tabs
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // State: Persisted IDE preferences & Light/Dark theme (stored in localStorage)
  const {
    settings,
    setColorMode,
    setEditorTheme,
    updateSettings,
    resetSettings,
    importSettingsFromJson,
  } = useIdeSettings();
  const activeTheme = settings.editorTheme;
  const wordWrap = settings.wordWrap;
  const minimap = settings.minimap;
  const isSidebarOpen = settings.sidebarOpen;

  // State: Resizable sidebar drag status & folder expand/collapse trigger
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [folderActionSignal, setFolderActionSignal] = useState<SidebarFolderActionSignal | null>(null);

  // State: Cursor telemetry
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectionLength, setSelectionLength] = useState(0);

  // State: Modals & Unified Command Palette / Quick Open
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteInitialMode, setPaletteInitialMode] = useState<'files' | 'commands'>('files');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isExportPrefsOpen, setIsExportPrefsOpen] = useState(false);
  const [isImportPrefsOpen, setIsImportPrefsOpen] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  const readCloudFileRef = useRef<((file: CloudFile) => Promise<void>) | null>(null);
  const knownBridgeDrivesRef = useRef<string[]>(settings.knownBridgeDrives);

  useEffect(() => {
    knownBridgeDrivesRef.current = settings.knownBridgeDrives;
  }, [settings.knownBridgeDrives]);

  // Status toast helper
  const notify = useCallback((msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => {
      setStatusNotification(current => (current === msg ? null : current));
    }, 3500);
  }, []);

  // Merge newly discovered drive keys from Clockie H2 into localStorage cache without redundant writes
  const handleDrivesDiscovered = useCallback(
    (driveKeys: string[]) => {
      const cleaned = driveKeys.map(k => k.trim()).filter(k => Boolean(k) && k !== 'all');
      if (cleaned.length === 0) return;
      const existing = knownBridgeDrivesRef.current;
      const merged = Array.from(new Set([...existing, ...cleaned]));
      if (merged.length !== existing.length) {
        knownBridgeDrivesRef.current = merged;
        updateSettings({ knownBridgeDrives: merged });
      }
    },
    [updateSettings]
  );

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
    directStartupDriveMode: settings.directStartupDriveMode,
    directStartupDrive: settings.directStartupDrive,
    onDrivesDiscovered: handleDrivesDiscovered,
    onStartupSkippedNotice: notify,
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

  const dirtyFilesCount = useMemo(
    () => files.filter(f => !f.isDirectory && f.isDirty).length,
    [files]
  );

  // Sync persisted sidebar width into CSS custom property without inline JSX styles
  useEffect(() => {
    document.documentElement.style.setProperty('--monarch-sidebar-width', `${settings.sidebarWidth}px`);
  }, [settings.sidebarWidth]);

  const handleSidebarResizeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = settings.sidebarWidth;
      let latestWidth = startWidth;
      setIsResizingSidebar(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const clamped = Math.min(560, Math.max(180, Math.round(startWidth + delta)));
        latestWidth = clamped;
        document.documentElement.style.setProperty('--monarch-sidebar-width', `${clamped}px`);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        setIsResizingSidebar(false);
        updateSettings({ sidebarWidth: latestWidth });
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [settings.sidebarWidth, updateSettings]
  );

  const handleCursorChange = useCallback((pos: { line: number; col: number }, selLen: number) => {
    setCursorPos(prev => (prev.line === pos.line && prev.col === pos.col ? prev : pos));
    setSelectionLength(prev => (prev === selLen ? prev : selLen));
  }, []);

  // Manual sample workspace loader when disconnected
  const handleLoadSampleWorkspace = useCallback(() => {
    setFiles(INITIAL_CLOUD_FILES);
    setCloudProvider('Standalone');
    setSelectedDrive(undefined);
    setWorkspaceName('FreshFood Vault');
    setOpenTabs([
      { fileId: 'file-readme', path: 'README.md', title: 'README.md', previewMode: 'split' },
      { fileId: 'file-engine-ts', path: 'src/api/freshfood-engine.ts', title: 'freshfood-engine.ts', previewMode: 'code' },
    ]);
    setActiveTabId('file-readme');
    notify('Loaded sample workspace');
  }, [notify]);

  // Open or focus a singleton virtual editor tab (Bridge Status / Debugger / Preferences)
  const openVirtualTab = useCallback(
    (tabId: string, title: string, kind: OpenTabKind) => {
      setOpenTabs(prev => {
        if (prev.some(t => t.fileId === tabId)) return prev;
        return [
          ...prev,
          {
            fileId: tabId,
            path: title,
            title,
            previewMode: 'code',
            kind,
          },
        ];
      });
      setActiveTabId(tabId);
    },
    []
  );

  const handleOpenBridgeStatus = useCallback(() => {
    openVirtualTab(BRIDGE_STATUS_TAB_ID, 'Extension Bridge Status', 'bridge-status');
  }, [openVirtualTab]);

  const handleOpenBridgeDebugger = useCallback(() => {
    openVirtualTab(BRIDGE_DEBUGGER_TAB_ID, 'Extension Bridge Debugger', 'bridge-debugger');
  }, [openVirtualTab]);

  const handleOpenPreferences = useCallback(() => {
    openVirtualTab(PREFERENCES_TAB_ID, 'Preferences', 'preferences');
  }, [openVirtualTab]);

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

  // Select any tab (virtual Bridge/Preferences tabs or workspace file tabs)
  const handleSelectTab = useCallback(
    (tabId: string) => {
      if (
        tabId === BRIDGE_STATUS_TAB_ID ||
        tabId === BRIDGE_DEBUGGER_TAB_ID ||
        tabId === PREFERENCES_TAB_ID
      ) {
        setActiveTabId(tabId);
        return;
      }
      handleSelectFile(tabId);
    },
    [handleSelectFile]
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

  const openQuickOpen = useCallback(() => {
    setPaletteInitialMode('files');
    setIsPaletteOpen(true);
  }, []);

  const openCommandPalette = useCallback(() => {
    setPaletteInitialMode('commands');
    setIsPaletteOpen(true);
  }, []);

  const triggerSidebarFolderAction = useCallback(
    (action: 'collapse' | 'expand-lazy' | 'expand-full') => {
      updateSettings({ sidebarOpen: true });
      setFolderActionSignal({ action, nonce: Date.now() + Math.random() });
    },
    [updateSettings]
  );

  // Global keybindings (capture phase ensures F1 and Ctrl+Shift+P work even when Monaco Editor has focus)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        openCommandPalette();
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        e.stopPropagation();
        openCommandPalette();
        return;
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        openQuickOpen();
        return;
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        updateSettings({ sidebarOpen: !isSidebarOpen });
        return;
      }

      if (isCmdOrCtrl && e.key === ',') {
        e.preventDefault();
        handleOpenPreferences();
        return;
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'w' && activeTabId) {
        e.preventDefault();
        handleCloseTab(activeTabId);
        return;
      }

      if (
        e.key === 'Escape' &&
        !isPaletteOpen &&
        !isSearchOpen &&
        !isShortcutsOpen &&
        !isAboutOpen &&
        !isExportPrefsOpen &&
        !isImportPrefsOpen &&
        (activeTabId === BRIDGE_STATUS_TAB_ID ||
          activeTabId === BRIDGE_DEBUGGER_TAB_ID ||
          activeTabId === PREFERENCES_TAB_ID)
      ) {
        e.preventDefault();
        handleCloseTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [
    handleSaveCurrent,
    openCommandPalette,
    openQuickOpen,
    updateSettings,
    isSidebarOpen,
    handleOpenPreferences,
    activeTabId,
    handleCloseTab,
    isPaletteOpen,
    isSearchOpen,
    isShortcutsOpen,
    isAboutOpen,
    isExportPrefsOpen,
    isImportPrefsOpen,
  ]);

  // Unified IDE Command list for Command Palette (Ctrl+Shift+P / F1 / >)
  const ideCommands = useMemo<IdeCommand[]>(
    () => [
      {
        id: 'file.quickOpen',
        category: 'File',
        label: 'Quick Open...',
        shortcut: 'Ctrl+P',
        action: openQuickOpen,
      },
      {
        id: 'file.save',
        category: 'File',
        label: 'Save Active File',
        shortcut: 'Ctrl+S',
        disabled: !activeFile || isSaving || isReadOnly || !canSave,
        action: handleSaveCurrent,
      },
      {
        id: 'file.saveAll',
        category: 'File',
        label: `Save All Modified Files${dirtyFilesCount > 0 ? ` (${dirtyFilesCount})` : ''}`,
        disabled: dirtyFilesCount === 0 || isSaving || isReadOnly || !canSave,
        action: handleSaveAll,
      },
      {
        id: 'file.closeTab',
        category: 'File',
        label: 'Close Active Editor Tab',
        shortcut: 'Ctrl+W',
        disabled: !activeTabId,
        action: () => activeTabId && handleCloseTab(activeTabId),
      },
      {
        id: 'file.closeAllTabs',
        category: 'File',
        label: 'Close All Editor Tabs',
        disabled: openTabs.length === 0,
        action: handleCloseAllTabs,
      },
      {
        id: 'edit.preferences',
        category: 'Edit',
        label: 'Open Preferences',
        shortcut: 'Ctrl+,',
        action: handleOpenPreferences,
      },
      {
        id: 'view.toggleSidebar',
        category: 'View',
        label: 'Toggle Primary Side Bar',
        shortcut: 'Ctrl+B',
        active: isSidebarOpen,
        action: () => updateSettings({ sidebarOpen: !isSidebarOpen }),
      },
      {
        id: 'view.searchWorkspace',
        category: 'View',
        label: 'Search Workspace...',
        shortcut: 'Ctrl+Shift+F',
        action: () => setIsSearchOpen(true),
      },
      {
        id: 'view.toggleWordWrap',
        category: 'View',
        label: 'Toggle Word Wrap',
        active: wordWrap,
        action: () => updateSettings({ wordWrap: !wordWrap }),
      },
      {
        id: 'view.toggleMinimap',
        category: 'View',
        label: 'Toggle Code Minimap',
        active: minimap,
        action: () => updateSettings({ minimap: !minimap }),
      },
      {
        id: 'view.expandFoldersLazy',
        category: 'View',
        label: 'Expand All Folders - Lazy (Loaded Only)',
        action: () => triggerSidebarFolderAction('expand-lazy'),
      },
      {
        id: 'view.expandFoldersFull',
        category: 'View',
        label: 'Expand All Folders - Full (Load Nested)',
        action: () => triggerSidebarFolderAction('expand-full'),
      },
      {
        id: 'view.collapseFolders',
        category: 'View',
        label: 'Collapse All Folders',
        action: () => triggerSidebarFolderAction('collapse'),
      },
      {
        id: 'bridge.status',
        category: 'Bridge',
        label: 'Open Extension Bridge Status',
        action: handleOpenBridgeStatus,
      },
      {
        id: 'bridge.debugger',
        category: 'Bridge',
        label: 'Show Extension Bridge Debugger',
        action: handleOpenBridgeDebugger,
      },
      {
        id: 'bridge.connect',
        category: 'Bridge',
        label: 'Connect to Clockie H2 Bridge',
        disabled: extensionStatus === 'connected',
        action: () => startBridge(),
      },
      {
        id: 'bridge.disconnect',
        category: 'Bridge',
        label: 'Disconnect Bridge Session',
        disabled: extensionStatus === 'disconnected',
        action: stopBridge,
      },
      {
        id: 'bridge.refreshTree',
        category: 'Bridge',
        label: 'Refresh Workspace Tree',
        disabled: extensionStatus !== 'connected',
        action: handleRefreshTree,
      },
      {
        id: 'preferences.lightMode',
        category: 'Preferences',
        label: 'Switch Color Theme to Light Mode',
        active: settings.colorMode === 'light',
        action: () => {
          setColorMode('light');
          notify('Switched to Light mode');
        },
      },
      {
        id: 'preferences.darkMode',
        category: 'Preferences',
        label: 'Switch Color Theme to Dark Mode',
        active: settings.colorMode === 'dark',
        action: () => {
          setColorMode('dark');
          notify('Switched to Dark mode');
        },
      },
      {
        id: 'preferences.exportJson',
        category: 'Preferences',
        label: 'Export Preferences to JSON...',
        action: () => setIsExportPrefsOpen(true),
      },
      {
        id: 'preferences.importJson',
        category: 'Preferences',
        label: 'Import Preferences from JSON...',
        action: () => setIsImportPrefsOpen(true),
      },
      {
        id: 'preferences.reset',
        category: 'Preferences',
        label: 'Reset Preferences to Defaults',
        action: () => {
          resetSettings();
          notify('Preferences reset to defaults');
        },
      },
      {
        id: 'help.shortcuts',
        category: 'Help',
        label: 'Shortcuts and Docs',
        action: () => setIsShortcutsOpen(true),
      },
      {
        id: 'help.about',
        category: 'Help',
        label: 'About Monarch IDE',
        action: () => setIsAboutOpen(true),
      },
    ],
    [
      openQuickOpen,
      activeFile,
      isSaving,
      isReadOnly,
      canSave,
      handleSaveCurrent,
      dirtyFilesCount,
      handleSaveAll,
      activeTabId,
      handleCloseTab,
      openTabs.length,
      handleCloseAllTabs,
      handleOpenPreferences,
      isSidebarOpen,
      updateSettings,
      wordWrap,
      minimap,
      triggerSidebarFolderAction,
      handleOpenBridgeStatus,
      handleOpenBridgeDebugger,
      extensionStatus,
      startBridge,
      stopBridge,
      handleRefreshTree,
      settings.colorMode,
      setColorMode,
      notify,
      resetSettings,
    ]
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#18181b] text-slate-900 dark:text-zinc-200 select-auto overflow-hidden">
      {/* Always-Visible Main Menu Bar + Centered Command Palette Bar */}
      <MenuBar
        workspaceName={workspaceName}
        hasActiveFile={Boolean(activeFile)}
        dirtyFilesCount={dirtyFilesCount}
        isSaving={isSaving}
        isReadOnly={isReadOnly}
        canSave={canSave}
        sidebarOpen={isSidebarOpen}
        wordWrap={wordWrap}
        minimap={minimap}
        onOpenCommandPalette={openCommandPalette}
        onOpenQuickOpen={openQuickOpen}
        onSaveCurrent={handleSaveCurrent}
        onSaveAll={handleSaveAll}
        onOpenPreferences={handleOpenPreferences}
        onToggleSidebar={() => updateSettings({ sidebarOpen: !isSidebarOpen })}
        onOpenSearch={() => setIsSearchOpen(true)}
        onToggleWordWrap={() => updateSettings({ wordWrap: !wordWrap })}
        onToggleMinimap={() => updateSettings({ minimap: !minimap })}
        onOpenBridgeStatus={handleOpenBridgeStatus}
        onOpenBridgeDebugger={handleOpenBridgeDebugger}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
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

      {/* Main Workspace: Resizable Sidebar + Splitter + Editor */}
      <div className="flex-1 flex overflow-hidden">
        {isSidebarOpen && (
          <>
            <div className="w-[var(--monarch-sidebar-width,260px)] h-full shrink-0 overflow-hidden">
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
                defaultFoldersExpanded={settings.sidebarDefaultFoldersExpanded}
                folderActionSignal={folderActionSignal}
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
              />
            </div>

            {/* Resizable Vertical Splitter Divider */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize primary sidebar"
              onMouseDown={handleSidebarResizeMouseDown}
              onDoubleClick={() => {
                updateSettings({ sidebarWidth: 260 });
                notify('Sidebar width reset to 260 px');
              }}
              title="Drag to resize sidebar (double-click to reset)"
              className={`w-1 h-full shrink-0 cursor-col-resize transition-colors border-r border-slate-200 dark:border-zinc-800 ${
                isResizingSidebar
                  ? 'bg-blue-600 border-blue-600'
                  : 'bg-slate-100 dark:bg-[#1b1b1e] hover:bg-blue-500/80 dark:hover:bg-blue-500/80'
              }`}
            />
          </>
        )}

        {/* Center Editor Container */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-[#18181b]">
          <TabsBar
            openTabs={openTabs}
            activeTabId={activeTabId}
            files={files}
            onSelectTab={handleSelectTab}
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
                isBridgeConnected={extensionStatus === 'connected'}
                isConnectingBridge={extensionStatus === 'connecting'}
                bridgeStatusView={
                  <ExtensionBridgeStatusPage
                    sessionId={sessionId}
                    extensionStatus={extensionStatus}
                    handshakeInfo={handshakeInfo}
                    connectionError={connectionError}
                    connectionReasonCode={connectionReasonCode}
                    messagesLog={messagesLog}
                    onConnectBridge={() => startBridge()}
                    onStopBridge={stopBridge}
                    onClearLogs={clearLogs}
                    onClose={() => handleCloseTab(BRIDGE_STATUS_TAB_ID)}
                  />
                }
                bridgeDebuggerView={
                  <ExtensionDebuggerPage
                    sessionId={sessionId}
                    messagesLog={messagesLog}
                    extensionStatus={extensionStatus}
                    handshakeInfo={handshakeInfo}
                    connectionError={connectionError}
                    connectionReasonCode={connectionReasonCode}
                    onClose={() => handleCloseTab(BRIDGE_DEBUGGER_TAB_ID)}
                    onClearLogs={clearLogs}
                    onConnectBridge={() => startBridge()}
                  />
                }
                preferencesView={
                  <PreferencesPage
                    settings={settings}
                    isBridgeConnected={extensionStatus === 'connected'}
                    drives={handshakeInfo?.drives}
                    onSetColorMode={mode => {
                      setColorMode(mode);
                      notify(`Switched to ${mode === 'light' ? 'Light' : 'Dark'} mode`);
                    }}
                    onSetEditorTheme={theme => {
                      setEditorTheme(theme);
                      notify(`Editor theme: ${theme}`);
                    }}
                    onUpdateSettings={updateSettings}
                    onOpenExportPreferences={() => setIsExportPrefsOpen(true)}
                    onOpenImportPreferences={() => setIsImportPrefsOpen(true)}
                    onResetPreferences={() => {
                      resetSettings();
                      notify('Preferences reset to defaults');
                    }}
                    onClose={() => handleCloseTab(PREFERENCES_TAB_ID)}
                  />
                }
                onLoadSampleWorkspace={handleLoadSampleWorkspace}
                onContentChange={handleContentChange}
                onSaveFile={saveCloudFile}
                onRetryLoadFile={handleRetryLoadFile}
                onCursorChange={handleCursorChange}
                onOpenQuickOpen={openQuickOpen}
                onOpenCommandPalette={openCommandPalette}
                onOpenSearch={() => setIsSearchOpen(true)}
                onOpenFile={handleSelectFile}
                files={files}
              />
            </div>
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
        isReadOnly={isReadOnly}
        statusNotification={statusNotification}
        onOpenBridgeStatus={handleOpenBridgeStatus}
      />

      {/* Unified Quick Open (Ctrl+P) & Command Palette (Ctrl+Shift+P / F1 / >) Modal */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        initialMode={paletteInitialMode}
        files={files}
        commands={ideCommands}
        onClose={() => setIsPaletteOpen(false)}
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

      {/* About Monarch IDE Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        extensionStatus={extensionStatus}
        handshakeInfo={handshakeInfo}
        onClose={() => setIsAboutOpen(false)}
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
