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
import {
  H2SaveFileRes,
  H2DeleteFileRes,
  H2CreateFolderRes,
  H2DeleteFolderRes,
  H2MoveFileRes,
  H2MoveFolderRes,
} from './utils/h2BridgeClient';
import { useExtensionBridge, H2MoveErrorInfo } from './hooks/useExtensionBridge';
import { useDynamicFavicon } from './hooks/useDynamicFavicon';
import { useIdeSettings } from './hooks/useIdeSettings';
import { MenuBar } from './components/MenuBar';
import {
  Sidebar,
  SidebarFolderActionSignal,
  SidebarMoveConflict,
} from './components/Sidebar';
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
import { SaveAsModal, SaveAsConfirmParams } from './components/SaveAsModal';
import { UnsavedChangesModal, PendingTabCloseRequest } from './components/UnsavedChangesModal';
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
  const [saveAsTargetFileId, setSaveAsTargetFileId] = useState<string | null>(null);
  const [pendingCloseRequest, setPendingCloseRequest] = useState<PendingTabCloseRequest | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [moveConflict, setMoveConflict] = useState<SidebarMoveConflict | null>(null);

  const readCloudFileRef = useRef<((file: CloudFile) => Promise<void>) | null>(null);
  const filesRef = useRef<CloudFile[]>(files);
  const knownBridgeDrivesRef = useRef<string[]>(settings.knownBridgeDrives);
  const untitledCounterRef = useRef<number>(1);
  const latestContentByIdRef = useRef<Record<string, string>>({});
  const pendingSaveThenCloseIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

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

  // Generate a non-colliding rename suggestion when a move/rename target already exists
  const buildUniqueSuggestion = useCallback(
    (targetPath: string, itemType: 'file' | 'folder', provider: CloudProvider) => {
      const cleanTarget = targetPath.replace(/^\/+|\/+$/g, '');
      const lastSlash = cleanTarget.lastIndexOf('/');
      const parentDir = lastSlash >= 0 ? cleanTarget.slice(0, lastSlash) : '';
      const baseName = lastSlash >= 0 ? cleanTarget.slice(lastSlash + 1) : cleanTarget;

      let stem = baseName;
      let ext = '';
      if (itemType === 'file') {
        const dotIdx = baseName.lastIndexOf('.');
        if (dotIdx > 0) {
          stem = baseName.slice(0, dotIdx);
          ext = baseName.slice(dotIdx);
        }
      }

      const existingPaths = new Set(
        filesRef.current
          .filter(f => !provider || f.cloudProvider === provider)
          .map(f => f.path)
      );

      let suffix = '-copy';
      let attempt = 1;
      while (attempt < 50) {
        const candidateName = `${stem}${suffix}${ext}`;
        const candidatePath = parentDir ? `${parentDir}/${candidateName}` : candidateName;
        if (!existingPaths.has(candidatePath)) {
          return candidatePath;
        }
        attempt += 1;
        suffix = `-copy-${attempt}`;
      }
      return parentDir ? `${parentDir}/${stem}-${Date.now()}${ext}` : `${stem}-${Date.now()}${ext}`;
    },
    []
  );

  // Synchronize local workspace tree & open tabs after a move/rename (including folder subtrees)
  const applyLocalMove = useCallback(
    ({
      itemType,
      provider,
      oldPath,
      newPath,
      updatedId,
      updatedParentId,
    }: {
      itemType: 'file' | 'folder';
      provider: CloudProvider;
      oldPath: string;
      newPath: string;
      updatedId?: string;
      updatedParentId?: string;
    }) => {
      const cleanOld = oldPath.replace(/^\/+|\/+$/g, '');
      const cleanNew = newPath.replace(/^\/+|\/+$/g, '');
      if (!cleanOld || !cleanNew) return;

      const newLastSlash = cleanNew.lastIndexOf('/');
      const newName = newLastSlash >= 0 ? cleanNew.slice(newLastSlash + 1) : cleanNew;
      const newParentPath = newLastSlash >= 0 ? cleanNew.slice(0, newLastSlash) : '';

      const displacedIds = new Set<string>();

      setFiles(prev => {
        const next: CloudFile[] = [];
        for (const item of prev) {
          const sameProvider = !provider || !item.cloudProvider || item.cloudProvider === provider;
          if (!sameProvider) {
            next.push(item);
            continue;
          }

          if (itemType === 'file') {
            if (!item.isDirectory && item.path === cleanOld) {
              next.push({
                ...item,
                path: cleanNew,
                name: newName,
                parentRelativePath: newParentPath,
                cloudFileId: updatedId ?? item.cloudFileId,
                parentId: updatedParentId ?? item.parentId,
                lastModified: new Date().toLocaleTimeString(),
              });
            } else if (!item.isDirectory && item.path === cleanNew) {
              // Overwritten target file removed
              displacedIds.add(item.id);
            } else {
              next.push(item);
            }
          } else {
            if (item.isDirectory && item.path === cleanOld) {
              next.push({
                ...item,
                id: `dir-${item.cloudProvider}-${cleanNew}`,
                path: cleanNew,
                name: newName,
                parentRelativePath: newParentPath,
                folderId: updatedId ?? item.folderId,
                parentId: updatedParentId ?? item.parentId,
                lastModified: new Date().toLocaleTimeString(),
              });
            } else if (item.path.startsWith(`${cleanOld}/`)) {
              const suffix = item.path.slice(cleanOld.length + 1);
              const updatedPath = `${cleanNew}/${suffix}`;
              const updatedParent = updatedPath.includes('/')
                ? updatedPath.slice(0, updatedPath.lastIndexOf('/'))
                : '';
              next.push({
                ...item,
                path: updatedPath,
                parentRelativePath: updatedParent,
              });
            } else if (item.path === cleanNew || item.path.startsWith(`${cleanNew}/`)) {
              displacedIds.add(item.id);
            } else {
              next.push(item);
            }
          }
        }
        return next;
      });

      setOpenTabs(prevTabs => {
        const filtered = prevTabs.filter(t => !displacedIds.has(t.fileId));
        return filtered.map(t => {
          if (itemType === 'file') {
            if (t.path === cleanOld) {
              return { ...t, path: cleanNew, title: newName };
            }
          } else if (t.path.startsWith(`${cleanOld}/`)) {
            const suffix = t.path.slice(cleanOld.length + 1);
            return { ...t, path: `${cleanNew}/${suffix}` };
          }
          return t;
        });
      });

      setActiveTabId(curr => (curr && displacedIds.has(curr) ? null : curr));
    },
    []
  );

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

  // Clockie H2 Bridge Protocol v1.4 (H2_CLOUD_BRIDGE) hook
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
    createCloudFolder,
    moveCloudItem,
    listDriveEntries,
    readRawCloudFile,
    saveRawCloudFile,
    saveAsCloudFile,
    createRawCloudFolder,
    dismissConnectionError,
    clearLogs,
  } = useExtensionBridge({
    directStartupDriveMode: settings.directStartupDriveMode,
    directStartupDrive: settings.directStartupDrive,
    onDrivesDiscovered: handleDrivesDiscovered,
    onStartupSkippedNotice: notify,
    onWorkspaceTreeLoaded: (incomingItems, provider, rootName, primaryRelativePath) => {
      setMoveConflict(null);
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
        prev.map(f => {
          if (!f.isDirectory && f.path === relativePath) {
            if (typeof updatedFields.content === 'string') {
              latestContentByIdRef.current[f.id] = updatedFields.content;
            }
            return {
              ...f,
              ...updatedFields,
              externalVersion: (f.externalVersion ?? 0) + 1,
            };
          }
          return f;
        })
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

    onFileSaveConfirmed: (localId, res: H2SaveFileRes, savedContent: string) => {
      let hasNewerLocalEdits = false;
      setFiles(prev =>
        prev.map(f => {
          if (f.id === localId) {
            const latestContent = latestContentByIdRef.current[f.id] ?? f.content;
            const stillModified = latestContent !== savedContent;
            hasNewerLocalEdits = stillModified;
            return {
              ...f,
              isUntitled: false,
              cloudProvider: res.provider || f.cloudProvider,
              cloudFileId: res.fileId ?? f.cloudFileId,
              parentId: res.parentFolderId ?? f.parentId,
              path: res.relativePath || f.path,
              name: res.filename || f.name,
              mimeType: res.filename ? inferMimeType(res.filename) : f.mimeType,
              size: res.sizeBytes ?? f.size,
              modifiedMs: res.modifiedMs ?? f.modifiedMs,
              lastModified: res.modifiedMs
                ? new Date(res.modifiedMs).toLocaleTimeString()
                : new Date().toLocaleTimeString(),
              isDirty: stillModified,
            };
          }
          return f;
        })
      );

      const shouldAutoClose =
        pendingSaveThenCloseIdsRef.current.has(localId) && !hasNewerLocalEdits;

      if (shouldAutoClose) {
        pendingSaveThenCloseIdsRef.current.delete(localId);
        setOpenTabs(prev => {
          const nextTabs = prev.filter(t => t.fileId !== localId);
          setActiveTabId(curr =>
            curr === localId ? nextTabs[nextTabs.length - 1]?.fileId ?? null : curr
          );
          return nextTabs;
        });
      } else {
        setOpenTabs(prev =>
          prev.map(t =>
            t.fileId === localId
              ? {
                  ...t,
                  path: res.relativePath || t.path,
                  title: res.filename || t.title,
                  isDirty: hasNewerLocalEdits,
                }
              : t
          )
        );
      }

      notify(`Saved ${res.filename || res.relativePath} to ${res.provider || cloudProvider}`);
    },

    onFileSaveError: (localId, error) => {
      pendingSaveThenCloseIdsRef.current.delete(localId);
      notify(`Save error: ${error}`);
    },

    onItemDeleted: (itemType, relativePath, res: H2DeleteFileRes | H2DeleteFolderRes) => {
      const removedIds = new Set<string>();
      const fileId = 'fileId' in res ? res.fileId : undefined;
      setFiles(prev => {
        const next: CloudFile[] = [];
        for (const item of prev) {
          const isMatch =
            itemType === 'folder'
              ? item.path === relativePath ||
                item.path.startsWith(`${relativePath}/`) ||
                (Boolean(res.folderId) && item.folderId === res.folderId)
              : item.path === relativePath || (Boolean(fileId) && item.cloudFileId === fileId);
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

    onFolderCreated: (res: H2CreateFolderRes, fallback) => {
      const resolvedPath = (res.relativePath || fallback.relativePath).replace(/^\/+|\/+$/g, '');
      const resolvedProvider = res.provider || fallback.provider;
      const parts = resolvedPath.split('/').filter(Boolean);
      const leafName = res.folderName || parts[parts.length - 1] || resolvedPath;

      setFiles(prev => {
        const next = [...prev];
        let accum = '';
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          accum = accum ? `${accum}/${part}` : part;
          const isLeaf = i === parts.length - 1;
          const parentPath = accum.includes('/') ? accum.slice(0, accum.lastIndexOf('/')) : '';
          const existingIdx = next.findIndex(
            item => item.isDirectory && item.path === accum && item.cloudProvider === resolvedProvider
          );

          if (existingIdx >= 0) {
            if (isLeaf) {
              next[existingIdx] = {
                ...next[existingIdx],
                folderId: res.folderId ?? next[existingIdx].folderId,
                name: leafName,
                parentRelativePath: res.parentRelativePath ?? parentPath,
                childrenLoaded: true,
                driveRoot: fallback.driveRoot,
                lastModified: new Date().toLocaleTimeString(),
              };
            }
          } else {
            next.push({
              id: `dir-${resolvedProvider}-${accum}`,
              folderId: isLeaf ? res.folderId : undefined,
              name: isLeaf ? leafName : part,
              path: accum,
              parentRelativePath: isLeaf ? (res.parentRelativePath ?? parentPath) : parentPath,
              content: '',
              contentLoaded: true,
              childrenLoaded: true,
              driveRoot: fallback.driveRoot,
              isDirectory: true,
              cloudProvider: resolvedProvider,
              lastModified: new Date().toLocaleTimeString(),
            });
          }
        }
        return next;
      });

      notify(`Created folder ${resolvedPath}`);
    },

    onFolderCreateError: (relativePath, error) => {
      notify(`Create folder failed (${relativePath}): ${error}`);
    },

    onItemMoved: (itemType, provider, oldRelativePath, newRelativePath, res) => {
      const updatedId =
        itemType === 'folder'
          ? (res as H2MoveFolderRes).folderId
          : (res as H2MoveFileRes).fileId;
      const updatedParentId = res.parentFolderId;
      applyLocalMove({
        itemType,
        provider,
        oldPath: oldRelativePath,
        newPath: newRelativePath,
        updatedId,
        updatedParentId,
      });
      setMoveConflict(null);
      notify(`Moved ${oldRelativePath} -> ${newRelativePath}`);
    },

    onItemMoveError: (info: H2MoveErrorInfo) => {
      const looksLikeCollision =
        !info.overwrite &&
        (info.reasonCode === 'ALREADY_EXISTS' ||
          info.reasonCode === 'CONFLICT' ||
          /exist|already|conflict|overwrite|duplicate|eexist/i.test(info.error));

      if (looksLikeCollision) {
        setMoveConflict({
          itemType: info.itemType,
          provider: info.provider,
          driveRoot: info.driveRoot,
          itemId: info.itemId,
          oldRelativePath: info.oldRelativePath,
          targetRelativePath: info.targetRelativePath,
          suggestedRelativePath: buildUniqueSuggestion(
            info.targetRelativePath,
            info.itemType,
            info.provider
          ),
          errorMessage: info.error,
        });
      }
      notify(`Move failed (${info.oldRelativePath}): ${info.error}`);
    },
  });

  useEffect(() => {
    readCloudFileRef.current = readCloudFile;
  }, [readCloudFile]);

  // Keep the browser tab favicon black when disconnected/connecting and deep red when connected
  useDynamicFavicon(extensionStatus === 'connected');

  // Derived v1.4 permission / capability flags
  const isReadOnly = extensionStatus === 'connected' && handshakeInfo?.accessMode === 'readonly';
  const canSave = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.save !== false);
  const canCreateFiles = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.createFiles !== false);
  const canCreateFolders = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.createFolders !== false);
  const canDeleteFiles = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.deleteFiles !== false);
  const canDeleteFolders = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.deleteFolders !== false);
  const canMoveFiles = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.moveFiles !== false);
  const canMoveFolders = !isReadOnly && (extensionStatus !== 'connected' || handshakeInfo?.capabilities?.moveFolders !== false);

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

  const saveAsTargetFile = useMemo(
    () => files.find(f => f.id === saveAsTargetFileId && !f.isDirectory) || null,
    [files, saveAsTargetFileId]
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

  // Immediately close the given tab IDs, cleaning up untitled scratchpads & discarded cloud edits
  const executeCloseTabs = useCallback(
    (tabIdsToClose: string[], discardDirty = false) => {
      if (tabIdsToClose.length === 0) return;
      const closeSet = new Set(tabIdsToClose);

      setOpenTabs(prev => {
        const nextTabs = prev.filter(t => !closeSet.has(t.fileId));
        setActiveTabId(curr => {
          if (!curr || !closeSet.has(curr)) return curr;
          if (nextTabs.length === 0) return null;
          const closedIdx = prev.findIndex(t => t.fileId === curr);
          const nextActive = nextTabs[Math.min(nextTabs.length - 1, Math.max(0, closedIdx - 1))];
          return nextActive?.fileId ?? null;
        });
        return nextTabs;
      });

      setFiles(prev =>
        prev.flatMap(f => {
          if (!closeSet.has(f.id)) return [f];
          if (f.isUntitled) {
            delete latestContentByIdRef.current[f.id];
            return [];
          }
          if (discardDirty && f.isDirty) {
            delete latestContentByIdRef.current[f.id];
            if (extensionStatus === 'connected') {
              return [
                {
                  ...f,
                  content: '',
                  contentLoaded: false,
                  isDirty: false,
                  externalVersion: (f.externalVersion ?? 0) + 1,
                },
              ];
            }
            return [{ ...f, isDirty: false }];
          }
          return [f];
        })
      );
    },
    [extensionStatus]
  );

  // Tab close (checks for unsaved edits before closing file tabs)
  const handleCloseTab = useCallback(
    (fileId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const targetFile = filesRef.current.find(f => f.id === fileId && !f.isDirectory);
      if (targetFile?.isDirty) {
        setPendingCloseRequest({
          mode: 'single',
          targetFileIds: [fileId],
          dirtyFiles: [targetFile],
        });
        return;
      }
      executeCloseTabs([fileId], false);
    },
    [executeCloseTabs]
  );

  const handleCloseAllTabs = useCallback(() => {
    const targetIds = openTabs.map(t => t.fileId);
    if (targetIds.length === 0) return;
    const targetSet = new Set(targetIds);
    const dirtyFiles = filesRef.current.filter(
      f => targetSet.has(f.id) && !f.isDirectory && f.isDirty
    );
    if (dirtyFiles.length > 0) {
      setPendingCloseRequest({
        mode: 'all',
        targetFileIds: targetIds,
        dirtyFiles,
      });
      return;
    }
    executeCloseTabs(targetIds, false);
  }, [openTabs, executeCloseTabs]);

  const handleCloseOtherTabs = useCallback(
    (keepFileId: string) => {
      const targetIds = openTabs.filter(t => t.fileId !== keepFileId).map(t => t.fileId);
      if (targetIds.length === 0) return;
      const targetSet = new Set(targetIds);
      const dirtyFiles = filesRef.current.filter(
        f => targetSet.has(f.id) && !f.isDirectory && f.isDirty
      );
      if (dirtyFiles.length > 0) {
        setPendingCloseRequest({
          mode: 'others',
          keepFileId,
          targetFileIds: targetIds,
          dirtyFiles,
        });
        return;
      }
      executeCloseTabs(targetIds, false);
    },
    [openTabs, executeCloseTabs]
  );

  const handleSetPreviewMode = useCallback((fileId: string, mode: 'code' | 'split' | 'preview') => {
    setOpenTabs(prev => prev.map(t => (t.fileId === fileId ? { ...t, previewMode: mode } : t)));
  }, []);

  // Create a standalone untitled scratchpad file (File -> New)
  const handleNewFile = useCallback(() => {
    const num = untitledCounterRef.current++;
    const title = `Untitled-${num}`;
    const newId = `untitled-${Date.now()}-${num}`;
    const newFile: CloudFile = {
      id: newId,
      name: title,
      path: title,
      parentRelativePath: '',
      content: '',
      externalVersion: 1,
      contentLoaded: true,
      driveRoot: false,
      isDirectory: false,
      isUntitled: true,
      cloudProvider: 'Local Scratchpad',
      mimeType: 'text/plain',
      contentType: 'text',
      encoding: 'utf-8',
      lastModified: new Date().toLocaleTimeString(),
      isDirty: false,
    };

    latestContentByIdRef.current[newId] = '';
    setFiles(prev => [...prev, newFile]);
    setOpenTabs(prev => [
      ...prev,
      { fileId: newId, path: title, title, previewMode: 'code' },
    ]);
    setActiveTabId(newId);
    notify(`New untitled file: ${title}`);
  }, [notify]);

  // Content edits
  const handleContentChange = useCallback(
    (fileId: string, newContent: string) => {
      if (isReadOnly) return;
      latestContentByIdRef.current[fileId] = newContent;
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, content: newContent, isDirty: true } : f))
      );
    },
    [isReadOnly]
  );

  // Open Save As... modal for the active file or a specified file
  const handleOpenSaveAs = useCallback(
    (targetOverride?: CloudFile) => {
      const target = targetOverride || activeFile;
      if (!target) return;
      if (target.isLoadingContent || target.contentLoaded === false) {
        notify('Wait for file content to finish loading before saving.');
        return;
      }
      setSaveAsTargetFileId(target.id);
    },
    [activeFile, notify]
  );

  // Save current file (untitled files automatically route to Save As...)
  const handleSaveCurrent = useCallback(
    (targetOverride?: CloudFile) => {
      const candidate = targetOverride || activeFile;
      if (!candidate) return;
      const latestRecord = filesRef.current.find(f => f.id === candidate.id) || candidate;

      if (latestRecord.isLoadingContent || latestRecord.contentLoaded === false) {
        notify('Wait for file content to finish loading before saving.');
        return;
      }

      if (latestRecord.isUntitled) {
        setSaveAsTargetFileId(latestRecord.id);
        return;
      }

      if (isReadOnly || !canSave) {
        notify('Workspace is in read-only mode (saving disabled)');
        return;
      }

      const freshContent = latestContentByIdRef.current[latestRecord.id] ?? latestRecord.content;
      saveCloudFile({ ...latestRecord, content: freshContent });
    },
    [activeFile, isReadOnly, canSave, saveCloudFile, notify]
  );

  // Save all dirty files (saving cloud-backed files immediately, and prompting Save As for untitled files)
  const handleSaveAll = useCallback(() => {
    if (isReadOnly || !canSave) {
      notify('Workspace is in read-only mode (saving disabled)');
      return;
    }
    const dirtyCloudFiles = filesRef.current
      .filter(f => !f.isDirectory && f.isDirty && !f.isUntitled)
      .map(f => ({ ...f, content: latestContentByIdRef.current[f.id] ?? f.content }));
    const firstDirtyUntitled = filesRef.current.find(
      f => !f.isDirectory && f.isDirty && f.isUntitled
    );

    if (dirtyCloudFiles.length > 0) {
      saveAllCloudFiles(dirtyCloudFiles);
      notify(`Saving ${dirtyCloudFiles.length} file${dirtyCloudFiles.length === 1 ? '' : 's'}...`);
    }

    if (firstDirtyUntitled) {
      setSaveAsTargetFileId(firstDirtyUntitled.id);
    } else if (dirtyCloudFiles.length === 0) {
      notify('All files are up-to-date');
    }
  }, [isReadOnly, canSave, saveAllCloudFiles, notify]);

  // Confirm actions from UnsavedChangesModal
  const handleUnsavedDiscardAndClose = useCallback(() => {
    if (!pendingCloseRequest) return;
    const ids = pendingCloseRequest.targetFileIds;
    setPendingCloseRequest(null);
    executeCloseTabs(ids, true);
  }, [pendingCloseRequest, executeCloseTabs]);

  const handleUnsavedSaveAndClose = useCallback(() => {
    if (!pendingCloseRequest) return;
    const req = pendingCloseRequest;
    setPendingCloseRequest(null);

    const dirtyIds = new Set(req.dirtyFiles.map(f => f.id));
    const cleanIds = req.targetFileIds.filter(id => !dirtyIds.has(id));
    if (cleanIds.length > 0) {
      executeCloseTabs(cleanIds, false);
    }

    const dirtyCloud = req.dirtyFiles
      .filter(f => !f.isUntitled)
      .map(f => ({ ...f, content: latestContentByIdRef.current[f.id] ?? f.content }));
    const dirtyUntitled = req.dirtyFiles.filter(f => f.isUntitled);

    dirtyCloud.forEach(f => pendingSaveThenCloseIdsRef.current.add(f.id));
    dirtyUntitled.forEach(f => pendingSaveThenCloseIdsRef.current.add(f.id));

    if (dirtyCloud.length > 0) {
      if (extensionStatus !== 'connected' || isReadOnly || !canSave) {
        dirtyCloud.forEach(f => pendingSaveThenCloseIdsRef.current.delete(f.id));
        notify('Cannot save cloud files while disconnected or read-only.');
      } else {
        saveAllCloudFiles(dirtyCloud);
      }
    }

    if (dirtyUntitled.length > 0) {
      setActiveTabId(dirtyUntitled[0].id);
      setSaveAsTargetFileId(dirtyUntitled[0].id);
    }
  }, [
    pendingCloseRequest,
    executeCloseTabs,
    extensionStatus,
    isReadOnly,
    canSave,
    saveAllCloudFiles,
    notify,
  ]);

  // Helper: ensure missing directory nodes along a saved path exist in the Explorer tree
  const ensureFolderNodesInTree = useCallback(
    (
      list: CloudFile[],
      parentFolderPath: string,
      targetProvider: CloudProvider,
      driveRootFlag: boolean
    ): CloudFile[] => {
      const cleanParent = parentFolderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanParent) return list;
      const parts = cleanParent.split('/').filter(Boolean);
      const next = [...list];
      let accum = '';
      for (const part of parts) {
        accum = accum ? `${accum}/${part}` : part;
        const exists = next.some(
          item =>
            item.isDirectory &&
            item.path === accum &&
            (!item.cloudProvider || item.cloudProvider === targetProvider)
        );
        if (!exists) {
          const parentOfFolder = accum.includes('/') ? accum.slice(0, accum.lastIndexOf('/')) : '';
          next.push({
            id: `dir-${targetProvider}-${accum}`,
            name: part,
            path: accum,
            parentRelativePath: parentOfFolder,
            content: '',
            contentLoaded: true,
            childrenLoaded: true,
            driveRoot: driveRootFlag,
            isDirectory: true,
            cloudProvider: targetProvider,
            lastModified: new Date().toLocaleTimeString(),
          });
        }
      }
      return next;
    },
    []
  );

  // Execute cloud save from SaveAsModal (promotes untitled files OR creates a second tab on Save As...)
  const handleConfirmSaveToCloud = useCallback(
    async ({
      sourceFile,
      provider,
      driveRoot,
      relativePath,
      existingFileId,
    }: SaveAsConfirmParams): Promise<boolean> => {
      const freshContent = latestContentByIdRef.current[sourceFile.id] ?? sourceFile.content;
      const isBinary = Boolean(sourceFile.isBinary);
      let contentToSend = freshContent || '';
      if (isBinary && !contentToSend && sourceFile.binaryUrl?.startsWith('data:')) {
        const commaIdx = sourceFile.binaryUrl.indexOf(',');
        if (commaIdx >= 0) {
          contentToSend = sourceFile.binaryUrl.slice(commaIdx + 1);
        }
      }

      const res = await saveAsCloudFile({
        provider,
        driveRoot,
        relativePath,
        existingFileId,
        mimeType: inferMimeType(relativePath),
        contentType: isBinary ? 'binary' : 'text',
        encoding: isBinary ? 'base64' : 'utf-8',
        content: contentToSend,
      });

      const resolvedProvider = res.provider || provider;
      const resolvedPath = (res.relativePath || relativePath).replace(/^\/+|\/+$/g, '');
      const resolvedName =
        res.filename || resolvedPath.split('/').pop() || sourceFile.name;
      const resolvedParent = resolvedPath.includes('/')
        ? resolvedPath.slice(0, resolvedPath.lastIndexOf('/'))
        : '';
      const resolvedMime = inferMimeType(resolvedName);
      const timeLabel = res.modifiedMs
        ? new Date(res.modifiedMs).toLocaleTimeString()
        : new Date().toLocaleTimeString();

      const wasUntitled = Boolean(sourceFile.isUntitled);
      const isSameExistingFile =
        !wasUntitled &&
        resolvedProvider === sourceFile.cloudProvider &&
        resolvedPath === sourceFile.path;

      if (wasUntitled || isSameExistingFile) {
        setFiles(prev => {
          const updated = prev.map(f =>
            f.id === sourceFile.id
              ? {
                  ...f,
                  isUntitled: false,
                  cloudProvider: resolvedProvider,
                  driveRoot,
                  cloudFileId: res.fileId ?? f.cloudFileId,
                  parentId: res.parentFolderId ?? f.parentId,
                  parentRelativePath: resolvedParent,
                  name: resolvedName,
                  path: resolvedPath,
                  mimeType: resolvedMime,
                  content: freshContent,
                  size: res.sizeBytes ?? f.size,
                  modifiedMs: res.modifiedMs ?? Date.now(),
                  lastModified: timeLabel,
                  isDirty: false,
                }
              : f
          );
          return ensureFolderNodesInTree(updated, resolvedParent, resolvedProvider, driveRoot);
        });

        if (pendingSaveThenCloseIdsRef.current.has(sourceFile.id)) {
          pendingSaveThenCloseIdsRef.current.delete(sourceFile.id);
          executeCloseTabs([sourceFile.id], false);
        } else {
          setOpenTabs(prev =>
            prev.map(t =>
              t.fileId === sourceFile.id
                ? { ...t, path: resolvedPath, title: resolvedName, isDirty: false }
                : t
            )
          );
        }

        notify(`Saved ${resolvedPath} to ${resolvedProvider}`);
        return true;
      }

      // Existing file Save As to a different filename/folder/drive -> add a second tab!
      const newFileId = res.fileId
        ? `${resolvedProvider}:${String(res.fileId)}`
        : `h2-${resolvedProvider}-${resolvedPath}-${Date.now()}`;

      let finalIdToActivate = newFileId;
      setFiles(prev => {
        const existingMatch = prev.find(
          f =>
            !f.isDirectory &&
            !f.isUntitled &&
            f.cloudProvider === resolvedProvider &&
            f.path === resolvedPath
        );
        if (existingMatch) {
          finalIdToActivate = existingMatch.id;
        }

        const nextList = existingMatch
          ? prev.map(f =>
              f.id === existingMatch.id
                ? {
                    ...f,
                    cloudFileId: res.fileId ?? f.cloudFileId,
                    parentId: res.parentFolderId ?? f.parentId,
                    parentRelativePath: resolvedParent,
                    name: resolvedName,
                    path: resolvedPath,
                    mimeType: resolvedMime,
                    content: freshContent,
                    contentLoaded: true,
                    externalVersion: (f.externalVersion ?? 0) + 1,
                    size: res.sizeBytes ?? f.size,
                    modifiedMs: res.modifiedMs ?? Date.now(),
                    lastModified: timeLabel,
                    isDirty: false,
                  }
                : f
            )
          : [
              ...prev,
              {
                id: newFileId,
                cloudFileId: res.fileId,
                parentId: res.parentFolderId,
                parentRelativePath: resolvedParent,
                name: resolvedName,
                path: resolvedPath,
                content: freshContent,
                externalVersion: 1,
                contentLoaded: true,
                driveRoot,
                isDirectory: false,
                isUntitled: false,
                cloudProvider: resolvedProvider,
                mimeType: resolvedMime,
                contentType: isBinary ? ('binary' as const) : ('text' as const),
                encoding: isBinary ? ('base64' as const) : ('utf-8' as const),
                size: res.sizeBytes,
                modifiedMs: res.modifiedMs ?? Date.now(),
                lastModified: timeLabel,
                isDirty: false,
              },
            ];

        latestContentByIdRef.current[existingMatch ? existingMatch.id : newFileId] = freshContent;
        return ensureFolderNodesInTree(nextList, resolvedParent, resolvedProvider, driveRoot);
      });

      setOpenTabs(prev => {
        const alreadyOpen = prev.some(t => t.fileId === finalIdToActivate);
        if (alreadyOpen) {
          return prev.map(t =>
            t.fileId === finalIdToActivate
              ? { ...t, path: resolvedPath, title: resolvedName, isDirty: false }
              : t
          );
        }
        return [
          ...prev,
          {
            fileId: finalIdToActivate,
            path: resolvedPath,
            title: resolvedName,
            previewMode: 'split',
          },
        ];
      });
      setActiveTabId(finalIdToActivate);
      notify(`Saved copy as ${resolvedPath} (${resolvedProvider})`);
      return true;
    },
    [saveAsCloudFile, ensureFolderNodesInTree, executeCloseTabs, notify]
  );

  // Local download fallback inside SaveAsModal when offline or read-only
  const handleDownloadLocalFallback = useCallback(
    (sourceFile: CloudFile, downloadFilename: string) => {
      const freshContent = latestContentByIdRef.current[sourceFile.id] ?? sourceFile.content;
      const mime = inferMimeType(downloadFilename);
      const blob = new Blob([freshContent], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadFilename;
      link.click();
      URL.revokeObjectURL(url);
      notify(`Downloaded ${downloadFilename} to computer`);
    },
    [notify]
  );

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

  // Create directory entry via H2_CREATE_FOLDER_REQ when connected (or locally when disconnected)
  const handleCreateFolder = useCallback(
    (rawFolderPath: string, parentFolderId?: string, parentProvider?: CloudProvider) => {
      if (isReadOnly || !canCreateFolders) {
        notify('Folder creation is disabled in read-only mode');
        return;
      }

      const cleanPath = rawFolderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/');
      const folderName = parts[parts.length - 1];
      const parentRelativePath = parts.slice(0, -1).join('/');
      const parentMatch = parentRelativePath
        ? files.find(f => f.isDirectory && f.path === parentRelativePath)
        : undefined;
      const resolvedParentFolderId = parentFolderId ?? parentMatch?.folderId;
      const targetProvider =
        parentProvider && parentProvider !== 'all'
          ? parentProvider
          : parentMatch?.cloudProvider && parentMatch.cloudProvider !== 'all'
            ? parentMatch.cloudProvider
            : selectedDrive && selectedDrive !== 'all'
              ? selectedDrive
              : cloudProvider !== 'all'
                ? cloudProvider
                : connectedDrives[0] || 'pcloud';

      if (extensionStatus === 'connected') {
        createCloudFolder({
          provider: targetProvider,
          driveRoot: Boolean(handshakeInfo?.driveRootActive),
          relativePath: cleanPath,
          parentRelativePath,
          parentFolderId: resolvedParentFolderId,
          folderName,
        });
        return;
      }

      setFiles(prev => {
        if (prev.some(item => item.isDirectory && item.path === cleanPath)) {
          return prev;
        }
        const newFolder: CloudFile = {
          id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: folderName,
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
    [
      isReadOnly,
      canCreateFolders,
      files,
      selectedDrive,
      cloudProvider,
      connectedDrives,
      extensionStatus,
      handshakeInfo?.driveRootActive,
      createCloudFolder,
      notify,
    ]
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

  // Delete folder & descendants (uses H2_DELETE_FOLDER_REQ when connected)
  const handleDeleteFolder = useCallback(
    (folderPath: string, folderId?: string, folderProvider?: CloudProvider) => {
      if (isReadOnly || !canDeleteFolders) {
        notify('Folder deletion is disabled in read-only mode');
        return;
      }

      const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      if (extensionStatus === 'connected') {
        const matchedFolder = files.find(
          f => f.isDirectory && f.path === cleanPath && (!folderProvider || f.cloudProvider === folderProvider)
        );
        deleteCloudItem({
          provider: folderProvider || matchedFolder?.cloudProvider || cloudProvider,
          driveRoot: Boolean(matchedFolder?.driveRoot ?? handshakeInfo?.driveRootActive),
          itemType: 'folder',
          relativePath: cleanPath,
          folderId: folderId ?? matchedFolder?.folderId,
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

  // Rename file via H2_MOVE_FILE_REQ (or local collision check/rename when disconnected)
  const handleRenameFile = useCallback(
    (fileId: string, newPath: string) => {
      if (isReadOnly || !canMoveFiles) {
        notify('File rename/move is disabled in read-only mode');
        return;
      }
      const target = files.find(f => f.id === fileId && !f.isDirectory);
      if (!target) return;
      const cleanPath = newPath.replace(/^\/+|\/+$/g, '');
      if (!cleanPath || cleanPath === target.path) return;

      if (extensionStatus === 'connected') {
        moveCloudItem({
          itemType: 'file',
          provider: target.cloudProvider,
          targetProvider: target.cloudProvider,
          driveRoot: Boolean(target.driveRoot ?? handshakeInfo?.driveRootActive),
          relativePath: target.path,
          fileId: target.cloudFileId,
          targetRelativePath: cleanPath,
          overwrite: false,
        });
      } else {
        const collides = files.some(
          f => f.id !== fileId && f.cloudProvider === target.cloudProvider && f.path === cleanPath
        );
        if (collides) {
          setMoveConflict({
            itemType: 'file',
            provider: target.cloudProvider,
            driveRoot: Boolean(target.driveRoot),
            itemId: target.cloudFileId,
            oldRelativePath: target.path,
            targetRelativePath: cleanPath,
            suggestedRelativePath: buildUniqueSuggestion(cleanPath, 'file', target.cloudProvider),
            errorMessage: `"${cleanPath}" already exists in this workspace.`,
          });
          return;
        }
        applyLocalMove({
          itemType: 'file',
          provider: target.cloudProvider,
          oldPath: target.path,
          newPath: cleanPath,
        });
        notify(`Renamed to ${cleanPath.split('/').pop() || cleanPath}`);
      }
    },
    [
      isReadOnly,
      canMoveFiles,
      files,
      extensionStatus,
      handshakeInfo?.driveRootActive,
      moveCloudItem,
      buildUniqueSuggestion,
      applyLocalMove,
      notify,
    ]
  );

  // Rename or move folder via H2_MOVE_FOLDER_REQ
  const handleRenameFolder = useCallback(
    (folderPath: string, newFolderPath: string, folderId?: string, folderProvider?: CloudProvider) => {
      if (isReadOnly || !canMoveFolders) {
        notify('Folder rename/move is disabled in read-only mode');
        return;
      }
      const cleanOld = folderPath.replace(/^\/+|\/+$/g, '');
      const cleanNew = newFolderPath.replace(/^\/+|\/+$/g, '');
      if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;
      if (cleanNew === cleanOld || cleanNew.startsWith(`${cleanOld}/`)) {
        notify('Cannot move a folder inside itself');
        return;
      }

      const matchedFolder = files.find(
        f => f.isDirectory && f.path === cleanOld && (!folderProvider || f.cloudProvider === folderProvider)
      );
      const resolvedProvider =
        folderProvider ||
        matchedFolder?.cloudProvider ||
        (selectedDrive && selectedDrive !== 'all' ? selectedDrive : cloudProvider);

      if (extensionStatus === 'connected') {
        moveCloudItem({
          itemType: 'folder',
          provider: resolvedProvider,
          targetProvider: resolvedProvider,
          driveRoot: Boolean(matchedFolder?.driveRoot ?? handshakeInfo?.driveRootActive),
          relativePath: cleanOld,
          folderId: folderId ?? matchedFolder?.folderId,
          targetRelativePath: cleanNew,
          overwrite: false,
        });
      } else {
        const collides = files.some(
          f => f.cloudProvider === resolvedProvider && f.path === cleanNew
        );
        if (collides) {
          setMoveConflict({
            itemType: 'folder',
            provider: resolvedProvider,
            driveRoot: Boolean(matchedFolder?.driveRoot),
            itemId: folderId ?? matchedFolder?.folderId,
            oldRelativePath: cleanOld,
            targetRelativePath: cleanNew,
            suggestedRelativePath: buildUniqueSuggestion(cleanNew, 'folder', resolvedProvider),
            errorMessage: `"${cleanNew}" already exists in this workspace.`,
          });
          return;
        }
        applyLocalMove({
          itemType: 'folder',
          provider: resolvedProvider,
          oldPath: cleanOld,
          newPath: cleanNew,
        });
        notify(`Moved ${cleanOld} -> ${cleanNew}`);
      }
    },
    [
      isReadOnly,
      canMoveFolders,
      files,
      selectedDrive,
      cloudProvider,
      extensionStatus,
      handshakeInfo?.driveRootActive,
      moveCloudItem,
      buildUniqueSuggestion,
      applyLocalMove,
      notify,
    ]
  );

  // Handle drag-and-drop moves in Sidebar (disallows cross-drive drops; uses same-drive native moves)
  const handleMoveItem = useCallback(
    ({
      itemType,
      sourcePath,
      targetFolderPath,
      itemId,
      sourceProvider,
      targetProvider,
    }: {
      itemType: 'file' | 'folder';
      sourcePath: string;
      targetFolderPath: string;
      itemId?: string;
      sourceProvider: CloudProvider;
      targetProvider: CloudProvider;
    }) => {
      if (isReadOnly || (itemType === 'folder' ? !canMoveFolders : !canMoveFiles)) {
        notify('Move operations are disabled in read-only mode');
        return;
      }
      if (sourceProvider && targetProvider && sourceProvider !== targetProvider) {
        notify(`Cross-drive move blocked: cannot move from ${sourceProvider} to ${targetProvider}.`);
        return;
      }

      const cleanSource = sourcePath.replace(/^\/+|\/+$/g, '');
      const cleanDestFolder = targetFolderPath.replace(/^\/+|\/+$/g, '');
      const baseName = cleanSource.split('/').pop() || cleanSource;
      const targetRelativePath = cleanDestFolder ? `${cleanDestFolder}/${baseName}` : baseName;
      if (!cleanSource || targetRelativePath === cleanSource) return;

      if (
        itemType === 'folder' &&
        (targetRelativePath === cleanSource || targetRelativePath.startsWith(`${cleanSource}/`))
      ) {
        notify('Cannot move a folder inside itself');
        return;
      }

      const sourceItem = files.find(
        f =>
          Boolean(f.isDirectory) === (itemType === 'folder') &&
          f.path === cleanSource &&
          (!sourceProvider || f.cloudProvider === sourceProvider)
      );
      const effectiveProvider = sourceProvider || sourceItem?.cloudProvider || cloudProvider;

      if (extensionStatus === 'connected') {
        moveCloudItem({
          itemType,
          provider: effectiveProvider,
          targetProvider: effectiveProvider,
          driveRoot: Boolean(sourceItem?.driveRoot ?? handshakeInfo?.driveRootActive),
          relativePath: cleanSource,
          fileId: itemType === 'file' ? itemId ?? sourceItem?.cloudFileId : undefined,
          folderId: itemType === 'folder' ? itemId ?? sourceItem?.folderId : undefined,
          targetRelativePath,
          overwrite: false,
        });
      } else {
        const collides = files.some(
          f => f.cloudProvider === effectiveProvider && f.path === targetRelativePath
        );
        if (collides) {
          setMoveConflict({
            itemType,
            provider: effectiveProvider,
            driveRoot: Boolean(sourceItem?.driveRoot),
            itemId: itemId ?? (itemType === 'folder' ? sourceItem?.folderId : sourceItem?.cloudFileId),
            oldRelativePath: cleanSource,
            targetRelativePath,
            suggestedRelativePath: buildUniqueSuggestion(
              targetRelativePath,
              itemType,
              effectiveProvider
            ),
            errorMessage: `"${targetRelativePath}" already exists in this workspace.`,
          });
          return;
        }
        applyLocalMove({
          itemType,
          provider: effectiveProvider,
          oldPath: cleanSource,
          newPath: targetRelativePath,
        });
        notify(`Moved ${cleanSource} -> ${targetRelativePath}`);
      }
    },
    [
      isReadOnly,
      canMoveFolders,
      canMoveFiles,
      files,
      cloudProvider,
      extensionStatus,
      handshakeInfo?.driveRootActive,
      moveCloudItem,
      buildUniqueSuggestion,
      applyLocalMove,
      notify,
    ]
  );

  // Conflict resolution: retry with overwrite: true
  const handleResolveMoveConflictOverwrite = useCallback(() => {
    if (!moveConflict) return;
    const conflict = moveConflict;
    setMoveConflict(null);

    if (extensionStatus === 'connected') {
      moveCloudItem({
        itemType: conflict.itemType,
        provider: conflict.provider,
        targetProvider: conflict.provider,
        driveRoot: conflict.driveRoot,
        relativePath: conflict.oldRelativePath,
        fileId: conflict.itemType === 'file' ? conflict.itemId : undefined,
        folderId: conflict.itemType === 'folder' ? conflict.itemId : undefined,
        targetRelativePath: conflict.targetRelativePath,
        overwrite: true,
      });
    } else {
      applyLocalMove({
        itemType: conflict.itemType,
        provider: conflict.provider,
        oldPath: conflict.oldRelativePath,
        newPath: conflict.targetRelativePath,
      });
      notify(`Overwrote ${conflict.targetRelativePath}`);
    }
  }, [moveConflict, extensionStatus, moveCloudItem, applyLocalMove, notify]);

  // Conflict resolution: move using renamed suggestion
  const handleResolveMoveConflictRename = useCallback(
    (newRelativePath: string) => {
      if (!moveConflict) return;
      const conflict = moveConflict;
      const cleanNew = newRelativePath.replace(/^\/+|\/+$/g, '');
      if (!cleanNew || cleanNew === conflict.oldRelativePath) {
        setMoveConflict(null);
        return;
      }

      if (extensionStatus === 'connected') {
        setMoveConflict(null);
        moveCloudItem({
          itemType: conflict.itemType,
          provider: conflict.provider,
          targetProvider: conflict.provider,
          driveRoot: conflict.driveRoot,
          relativePath: conflict.oldRelativePath,
          fileId: conflict.itemType === 'file' ? conflict.itemId : undefined,
          folderId: conflict.itemType === 'folder' ? conflict.itemId : undefined,
          targetRelativePath: cleanNew,
          overwrite: false,
        });
      } else {
        const collides = files.some(
          f => f.cloudProvider === conflict.provider && f.path === cleanNew
        );
        if (collides) {
          setMoveConflict({
            ...conflict,
            targetRelativePath: cleanNew,
            suggestedRelativePath: buildUniqueSuggestion(cleanNew, conflict.itemType, conflict.provider),
            errorMessage: `"${cleanNew}" also already exists.`,
          });
          return;
        }
        setMoveConflict(null);
        applyLocalMove({
          itemType: conflict.itemType,
          provider: conflict.provider,
          oldPath: conflict.oldRelativePath,
          newPath: cleanNew,
        });
        notify(`Moved ${conflict.oldRelativePath} -> ${cleanNew}`);
      }
    },
    [moveConflict, extensionStatus, moveCloudItem, files, buildUniqueSuggestion, applyLocalMove, notify]
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

  // Global keybindings (capture phase prevents double-firing with Monaco Editor)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const hasBlockingModal = Boolean(
        isPaletteOpen ||
          isSearchOpen ||
          isShortcutsOpen ||
          isAboutOpen ||
          isExportPrefsOpen ||
          isImportPrefsOpen ||
          saveAsTargetFileId ||
          pendingCloseRequest
      );

      if (hasBlockingModal) {
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isKeyN = e.code === 'KeyN' || e.key.toLowerCase() === 'n';
      const isKeyS = e.code === 'KeyS' || e.key.toLowerCase() === 's';
      const isKeyP = e.code === 'KeyP' || e.key.toLowerCase() === 'p';

      // New File: Alt+N (reliable everywhere) or Ctrl+N (works in installed app windows)
      if (
        (e.altKey && !isCmdOrCtrl && !e.shiftKey && isKeyN) ||
        (isCmdOrCtrl && !e.shiftKey && !e.altKey && isKeyN)
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleNewFile();
        return;
      }

      // Save As...: Ctrl+Shift+S or Ctrl+Alt+N
      if (
        (isCmdOrCtrl && e.shiftKey && !e.altKey && isKeyS) ||
        (isCmdOrCtrl && e.altKey && !e.shiftKey && isKeyN)
      ) {
        e.preventDefault();
        e.stopPropagation();
        handleOpenSaveAs();
        return;
      }

      // Save: Ctrl+S (routes untitled files to Save As...)
      if (isCmdOrCtrl && !e.shiftKey && !e.altKey && isKeyS) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveCurrent();
        return;
      }

      if (isCmdOrCtrl && e.shiftKey && isKeyP) {
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

      if (isCmdOrCtrl && !e.shiftKey && !e.altKey && isKeyP) {
        e.preventDefault();
        e.stopPropagation();
        openQuickOpen();
        return;
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        e.stopPropagation();
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
        e.stopPropagation();
        handleCloseTab(activeTabId);
        return;
      }

      if (
        e.key === 'Escape' &&
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
    handleNewFile,
    handleOpenSaveAs,
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
    saveAsTargetFileId,
    pendingCloseRequest,
  ]);

  // Unified IDE Command list for Command Palette (Ctrl+Shift+P / F1 / >)
  const ideCommands = useMemo<IdeCommand[]>(
    () => [
      {
        id: 'file.new',
        category: 'File',
        label: 'New File',
        shortcut: 'Ctrl+N / Alt+N',
        action: handleNewFile,
      },
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
        disabled:
          !activeFile ||
          activeFile.isLoadingContent ||
          activeFile.contentLoaded === false ||
          isSaving ||
          (!activeFile.isUntitled && (isReadOnly || !canSave)),
        action: () => handleSaveCurrent(),
      },
      {
        id: 'file.saveAs',
        category: 'File',
        label: 'Save As...',
        shortcut: 'Ctrl+Shift+S',
        disabled:
          !activeFile ||
          activeFile.isLoadingContent ||
          activeFile.contentLoaded === false ||
          isSaving,
        action: () => handleOpenSaveAs(),
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
      handleNewFile,
      openQuickOpen,
      activeFile,
      isSaving,
      isReadOnly,
      canSave,
      handleSaveCurrent,
      handleOpenSaveAs,
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
        isActiveFileUntitled={Boolean(activeFile?.isUntitled)}
        isActiveFileLoaded={Boolean(activeFile && activeFile.contentLoaded !== false && !activeFile.isLoadingContent)}
        dirtyFilesCount={dirtyFilesCount}
        isSaving={isSaving}
        isReadOnly={isReadOnly}
        canSave={canSave}
        sidebarOpen={isSidebarOpen}
        wordWrap={wordWrap}
        minimap={minimap}
        onOpenCommandPalette={openCommandPalette}
        onNewFile={handleNewFile}
        onOpenQuickOpen={openQuickOpen}
        onSaveCurrent={() => handleSaveCurrent()}
        onSaveAs={() => handleOpenSaveAs()}
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
                canMoveFiles={canMoveFiles}
                canMoveFolders={canMoveFolders}
                defaultFoldersExpanded={settings.sidebarDefaultFoldersExpanded}
                folderActionSignal={folderActionSignal}
                moveConflict={moveConflict}
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
                onRenameFolder={handleRenameFolder}
                onMoveItem={handleMoveItem}
                onResolveMoveConflictOverwrite={handleResolveMoveConflictOverwrite}
                onResolveMoveConflictRename={handleResolveMoveConflictRename}
                onDismissMoveConflict={() => setMoveConflict(null)}
                onCrossDriveDropBlocked={(sourceProvider, targetProvider) => {
                  notify(
                    `Cross-drive move blocked: cannot move items from ${sourceProvider} to ${targetProvider}.`
                  );
                }}
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
                onSaveFile={handleSaveCurrent}
                onSaveAsFile={handleOpenSaveAs}
                onNewFile={handleNewFile}
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
      {/* Save / Save As Cloud Destination Modal */}
      <SaveAsModal
        isOpen={Boolean(saveAsTargetFile)}
        targetFile={saveAsTargetFile}
        files={files}
        isBridgeConnected={extensionStatus === 'connected'}
        isReadOnly={isReadOnly}
        canSave={canSave}
        canCreateFolders={canCreateFolders}
        availableDrives={connectedDrives}
        defaultDrive={
          selectedDrive && selectedDrive !== 'all'
            ? selectedDrive
            : cloudProvider !== 'all' && cloudProvider !== 'Standalone'
              ? cloudProvider
              : connectedDrives[0] || 'pcloud'
        }
        listDriveEntries={listDriveEntries}
        createRawCloudFolder={createRawCloudFolder}
        onConfirmSaveToCloud={handleConfirmSaveToCloud}
        onDownloadLocalFallback={handleDownloadLocalFallback}
        onClose={() => {
          if (saveAsTargetFile) {
            pendingSaveThenCloseIdsRef.current.delete(saveAsTargetFile.id);
          }
          setSaveAsTargetFileId(null);
        }}
      />

      {/* Unsaved Changes Confirmation Modal when Closing Dirty Tabs */}
      <UnsavedChangesModal
        request={pendingCloseRequest}
        onSaveAndClose={handleUnsavedSaveAndClose}
        onDiscardAndClose={handleUnsavedDiscardAndClose}
        onCancel={() => setPendingCloseRequest(null)}
      />
    </div>
  );
}
