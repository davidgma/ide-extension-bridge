/**
 * React hook managing the Clockie H2 Bridge Protocol v1.4 (H2_CLOUD_BRIDGE) lifecycle:
 * 1. Zero-URL Session Binding: never reads or writes #h2Session or ?h2Session in window.location;
 *    stores active sessionId strictly in per-tab window.sessionStorage ("h2_bridge_session_id").
 * 2. Unified Startup (H2_CONNECT_REQ / H2_CONNECT_RES): sends previousSessionId from sessionStorage
 *    and handles both sessionMode: "launched" (with launchedScope) and sessionMode: "direct".
 * 3. Custom "Monarch IDE" Shortcut Launch: when launched on pcloud file "Monarch IDE", immediately opens
 *    a new untitled file and fetches pcloud driveRoot asynchronously in the background.
 * 4. Multi-drive & driveRoot switching (switchDriveRoot / requestWorkspaceTree / listFolder).
 * 5. Lazy / concurrent file reads (readCloudFile / readMultipleCloudFiles via Promise.all).
 * 6. Access mode (readwrite / readonly) and capability guards for saves, folders, moves, and deletes.
 * 7. Clean teardown on pagehide and explicit disconnect (H2_DISCONNECT_REQ).
 *
 * Official Documentation:
 * - React Hooks: https://react.dev/reference/react
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CloudFile,
  CloudProvider,
  ExtensionStatus,
  ExtensionHandshakeInfo,
  BridgeMessage,
  DispatchTargetInfo,
  H2DriveStatus,
  DirectStartupDriveMode,
} from '../types/ide';
import {
  H2_PROTOCOL,
  H2_SESSION_STORAGE_KEY,
  H2BridgeClient,
  H2BridgeError,
  H2WorkspaceTree,
  H2SaveFileRes,
  H2DeleteFileRes,
  H2CreateFolderRes,
  H2DeleteFolderRes,
  H2MoveFileRes,
  H2MoveFolderRes,
} from '../utils/h2BridgeClient';
import {
  inferMimeType,
  isKnownBinaryExtension,
  shouldRequestBase64,
} from '../utils/fileSystem';

export interface H2MoveErrorInfo {
  itemType: 'file' | 'folder';
  provider: CloudProvider;
  driveRoot: boolean;
  itemId?: string;
  oldRelativePath: string;
  targetRelativePath: string;
  overwrite: boolean;
  error: string;
  reasonCode: string | null;
}

interface UseExtensionBridgeProps {
  onWorkspaceTreeLoaded?: (
    files: CloudFile[],
    provider: CloudProvider,
    rootName: string,
    primaryRelativePath: string,
    launchedItemType: 'folder' | 'file' | 'workspace'
  ) => void;
  onMonarchShortcutLaunched?: (info: { provider: CloudProvider }) => void;
  onFolderChildrenLoaded?: (
    basePath: string,
    provider: CloudProvider,
    childrenItems: CloudFile[]
  ) => void;
  onFolderChildrenLoadError?: (basePath: string, error: string) => void;
  onFileContentLoaded?: (relativePath: string, updatedFields: Partial<CloudFile>) => void;
  onFileContentLoadError?: (relativePath: string, error: string) => void;
  onFileSaveConfirmed?: (localId: string, res: H2SaveFileRes, savedContent: string) => void;
  onFileSaveError?: (localId: string, error: string) => void;
  onItemDeleted?: (
    itemType: 'file' | 'folder',
    relativePath: string,
    res: H2DeleteFileRes | H2DeleteFolderRes
  ) => void;
  onItemDeleteError?: (relativePath: string, error: string) => void;
  onFolderCreated?: (
    res: H2CreateFolderRes,
    fallback: { provider: CloudProvider; driveRoot: boolean; relativePath: string }
  ) => void;
  onFolderCreateError?: (relativePath: string, error: string) => void;
  onItemMoved?: (
    itemType: 'file' | 'folder',
    provider: CloudProvider,
    oldRelativePath: string,
    newRelativePath: string,
    res: H2MoveFileRes | H2MoveFolderRes
  ) => void;
  onItemMoveError?: (info: H2MoveErrorInfo) => void;
  directStartupDriveMode?: DirectStartupDriveMode;
  directStartupDrive?: string;
  onDrivesDiscovered?: (driveKeys: string[]) => void;
  onStartupSkippedNotice?: (message: string) => void;
}

/** Converts H2_WORKSPACE_TREE / H2_LIST_FOLDER_RES items into Monarch IDE CloudFile records */
function mapTreePayloadToCloudFiles(
  treeMsg: H2WorkspaceTree,
  driveRootFlag = false
): CloudFile[] {
  const defaultProvider = treeMsg.provider || 'cloud';
  const effectiveDriveRoot = treeMsg.driveRoot ?? driveRootFlag;
  const folderItems: CloudFile[] = [];
  const fileItems: CloudFile[] = [];
  const seenKeys = new Set<string>();

  const pushFolder = (folder: any, fallbackProvider: string) => {
    const provider = folder.provider || fallbackProvider;
    const key = `dir:${provider}:${folder.relativePath}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    folderItems.push({
      id: `dir-${provider}-${folder.relativePath}`,
      folderId: folder.folderId,
      parentId: folder.parentFolderId,
      parentRelativePath: folder.parentRelativePath,
      name: folder.name,
      path: folder.relativePath,
      content: '',
      contentLoaded: true,
      childrenLoaded: folder.childrenLoaded ?? true,
      isLoadingChildren: false,
      driveRoot: effectiveDriveRoot,
      isDirectory: true,
      cloudProvider: provider,
      modifiedMs: folder.modifiedMs,
      lastModified: folder.modifiedMs ? new Date(folder.modifiedMs).toLocaleTimeString() : undefined,
    });
  };

  const pushFile = (file: any, fallbackProvider: string) => {
    const provider = file.provider || fallbackProvider;
    const key = `file:${provider}:${file.relativePath}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);

    const isBin =
      file.contentType === 'binary' ||
      file.encoding === 'base64' ||
      isKnownBinaryExtension(file.name);
    fileItems.push({
      id: file.fileId ? `${provider}:${String(file.fileId)}` : `h2-${provider}-${file.relativePath}`,
      cloudFileId: file.fileId,
      parentId: file.parentFolderId,
      parentRelativePath: file.parentRelativePath,
      name: file.name,
      path: file.relativePath,
      content: '',
      contentLoaded: false, // Metadata only; fetched lazily via H2_READ_FILE_REQ
      isLoadingContent: false,
      driveRoot: effectiveDriveRoot,
      isDirectory: false,
      cloudProvider: provider,
      mimeType: file.mimeType || inferMimeType(file.name),
      contentType: file.contentType,
      encoding: file.encoding,
      size: file.sizeBytes,
      modifiedMs: file.modifiedMs,
      lastModified: file.modifiedMs ? new Date(file.modifiedMs).toLocaleTimeString() : undefined,
      isBinary: isBin,
      isDirty: false,
    });
  };

  (treeMsg.folders || []).forEach(f => pushFolder(f, defaultProvider));
  (treeMsg.files || []).forEach(f => pushFile(f, defaultProvider));

  if (treeMsg.drives && typeof treeMsg.drives === 'object') {
    for (const [driveKey, drivePayload] of Object.entries(treeMsg.drives)) {
      if (drivePayload && typeof drivePayload === 'object') {
        if (Array.isArray(drivePayload.folders)) {
          drivePayload.folders.forEach((f: any) => pushFolder(f, driveKey));
        }
        if (Array.isArray(drivePayload.files)) {
          drivePayload.files.forEach((f: any) => pushFile(f, driveKey));
        }
      }
    }
  }

  return [...folderItems, ...fileItems];
}

export function useExtensionBridge({
  onWorkspaceTreeLoaded,
  onMonarchShortcutLaunched,
  onFolderChildrenLoaded,
  onFolderChildrenLoadError,
  onFileContentLoaded,
  onFileContentLoadError,
  onFileSaveConfirmed,
  onFileSaveError,
  onItemDeleted,
  onItemDeleteError,
  onFolderCreated,
  onFolderCreateError,
  onItemMoved,
  onItemMoveError,
  directStartupDriveMode = 'all',
  directStartupDrive = '',
  onDrivesDiscovered,
  onStartupSkippedNotice,
}: UseExtensionBridgeProps = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>('disconnected');
  const [handshakeInfo, setHandshakeInfo] = useState<ExtensionHandshakeInfo | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionReasonCode, setConnectionReasonCode] = useState<string | null>(null);
  const [messagesLog, setMessagesLog] = useState<BridgeMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const clientRef = useRef<H2BridgeClient | null>(null);
  const hasBootedRef = useRef(false);
  const manuallyDisconnectedRef = useRef(false);
  const refusedReasonRef = useRef<string | null>(null);
  const statusRef = useRef<ExtensionStatus>('disconnected');
  const savingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    statusRef.current = extensionStatus;
  }, [extensionStatus]);

  // Stable refs for parent callbacks
  const onWorkspaceTreeLoadedRef = useRef(onWorkspaceTreeLoaded);
  const onMonarchShortcutLaunchedRef = useRef(onMonarchShortcutLaunched);
  const onFolderChildrenLoadedRef = useRef(onFolderChildrenLoaded);
  const onFolderChildrenLoadErrorRef = useRef(onFolderChildrenLoadError);
  const onFileContentLoadedRef = useRef(onFileContentLoaded);
  const onFileContentLoadErrorRef = useRef(onFileContentLoadError);
  const onFileSaveConfirmedRef = useRef(onFileSaveConfirmed);
  const onFileSaveErrorRef = useRef(onFileSaveError);
  const onItemDeletedRef = useRef(onItemDeleted);
  const onItemDeleteErrorRef = useRef(onItemDeleteError);
  const onFolderCreatedRef = useRef(onFolderCreated);
  const onFolderCreateErrorRef = useRef(onFolderCreateError);
  const onItemMovedRef = useRef(onItemMoved);
  const onItemMoveErrorRef = useRef(onItemMoveError);
  const directStartupDriveModeRef = useRef<DirectStartupDriveMode>(directStartupDriveMode);
  const directStartupDriveRef = useRef<string>(directStartupDrive);
  const onDrivesDiscoveredRef = useRef(onDrivesDiscovered);
  const onStartupSkippedNoticeRef = useRef(onStartupSkippedNotice);

  useEffect(() => {
    onWorkspaceTreeLoadedRef.current = onWorkspaceTreeLoaded;
  }, [onWorkspaceTreeLoaded]);

  useEffect(() => {
    onMonarchShortcutLaunchedRef.current = onMonarchShortcutLaunched;
  }, [onMonarchShortcutLaunched]);

  useEffect(() => {
    onFolderChildrenLoadedRef.current = onFolderChildrenLoaded;
  }, [onFolderChildrenLoaded]);

  useEffect(() => {
    onFolderChildrenLoadErrorRef.current = onFolderChildrenLoadError;
  }, [onFolderChildrenLoadError]);

  useEffect(() => {
    onFileContentLoadedRef.current = onFileContentLoaded;
  }, [onFileContentLoaded]);

  useEffect(() => {
    onFileContentLoadErrorRef.current = onFileContentLoadError;
  }, [onFileContentLoadError]);

  useEffect(() => {
    onFileSaveConfirmedRef.current = onFileSaveConfirmed;
  }, [onFileSaveConfirmed]);

  useEffect(() => {
    onFileSaveErrorRef.current = onFileSaveError;
  }, [onFileSaveError]);

  useEffect(() => {
    onItemDeletedRef.current = onItemDeleted;
  }, [onItemDeleted]);

  useEffect(() => {
    onItemDeleteErrorRef.current = onItemDeleteError;
  }, [onItemDeleteError]);

  useEffect(() => {
    onFolderCreatedRef.current = onFolderCreated;
  }, [onFolderCreated]);

  useEffect(() => {
    onFolderCreateErrorRef.current = onFolderCreateError;
  }, [onFolderCreateError]);

  useEffect(() => {
    onItemMovedRef.current = onItemMoved;
  }, [onItemMoved]);

  useEffect(() => {
    onItemMoveErrorRef.current = onItemMoveError;
  }, [onItemMoveError]);

  useEffect(() => {
    directStartupDriveModeRef.current = directStartupDriveMode;
  }, [directStartupDriveMode]);

  useEffect(() => {
    directStartupDriveRef.current = directStartupDrive;
  }, [directStartupDrive]);

  useEffect(() => {
    onDrivesDiscoveredRef.current = onDrivesDiscovered;
  }, [onDrivesDiscovered]);

  useEffect(() => {
    onStartupSkippedNoticeRef.current = onStartupSkippedNotice;
  }, [onStartupSkippedNotice]);

  const getDispatchInfo = useCallback((activeSid: string | null): DispatchTargetInfo => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://ide.freshfood.rocks';
    const url = typeof window !== 'undefined' ? window.location.href : 'https://ide.freshfood.rocks/';
    const host = typeof window !== 'undefined' ? window.location.host : 'ide.freshfood.rocks';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    const port =
      typeof window !== 'undefined'
        ? window.location.port || (protocol === 'https:' ? '443' : '80')
        : '443';

    return {
      url,
      origin,
      host,
      protocol,
      port,
      postMessageTarget: `window.postMessage(envelope, '${origin}')`,
      sessionId: activeSid,
    };
  }, []);

  const logMessage = useCallback(
    (
      direction: 'incoming' | 'outgoing' | 'event',
      type: string,
      payload: any,
      status: 'sent' | 'received' | 'error' | 'timeout' = 'sent',
      roundtripMs?: number,
      activeSid: string | null = null
    ) => {
      const now = new Date();
      const formattedTime = `${now.toLocaleTimeString([], { hour12: false })}.${String(
        now.getMilliseconds()
      ).padStart(3, '0')}`;

      const entry: BridgeMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        direction,
        type,
        requestId: payload?.requestId,
        sessionId: payload?.sessionId || activeSid,
        channel: direction === 'event' ? 'system' : 'postMessage',
        payload,
        status,
        roundtripMs,
        timestamp: Date.now(),
        formattedTime,
        dispatchInfo: getDispatchInfo(payload?.sessionId || activeSid),
      };

      setMessagesLog(prev => [entry, ...prev.slice(0, 199)]);
      return entry;
    },
    [getDispatchInfo]
  );

  const logMessageRef = useRef(logMessage);
  useEffect(() => {
    logMessageRef.current = logMessage;
  }, [logMessage]);

  const applyTreeResult = useCallback(
    (
      treeMsg: H2WorkspaceTree,
      options?: {
        isIncremental?: boolean;
        driveRoot?: boolean;
        fallbackProvider?: CloudProvider;
        fallbackRootName?: string;
        primaryRelativePathOverride?: string;
        launchedItemTypeOverride?: 'folder' | 'file' | 'workspace';
      }
    ) => {
      const isIncremental = Boolean(options?.isIncremental);
      const driveRootFlag = treeMsg.driveRoot ?? Boolean(options?.driveRoot);

      if (!treeMsg.success) {
        logMessageRef.current(
          'event',
          'H2_WORKSPACE_TREE_ERROR',
          { error: treeMsg.error || 'Workspace tree load failed', requestId: treeMsg.requestId },
          'error',
          undefined,
          treeMsg.sessionId
        );
        return;
      }

      const provider = treeMsg.provider || options?.fallbackProvider || 'cloud';
      const rootName = treeMsg.rootName || options?.fallbackRootName || 'Cloud Workspace';
      const launchedItemType =
        options?.launchedItemTypeOverride || treeMsg.launchedItemType || 'folder';
      const primaryRelativePath =
        options?.primaryRelativePathOverride ?? treeMsg.primaryRelativePath ?? '';

      const mappedItems = mapTreePayloadToCloudFiles(treeMsg, driveRootFlag);

      // If launched on a single file and tree response didn't include it explicitly, synthesize metadata so it opens & lazy-reads
      if (
        !isIncremental &&
        launchedItemType === 'file' &&
        primaryRelativePath &&
        !mappedItems.some(it => !it.isDirectory && it.path === primaryRelativePath)
      ) {
        const cleanRel = primaryRelativePath.replace(/^\/+|\/+$/g, '');
        const parts = cleanRel.split('/');
        const filename = parts[parts.length - 1] || cleanRel;
        mappedItems.push({
          id: `h2-${provider}-${cleanRel}`,
          name: filename,
          path: cleanRel,
          parentRelativePath: parts.slice(0, -1).join('/'),
          content: '',
          contentLoaded: false,
          isLoadingContent: false,
          driveRoot: driveRootFlag,
          isDirectory: false,
          cloudProvider: provider,
          mimeType: inferMimeType(filename),
          isDirty: false,
        });
      }

      let driveStatuses: Record<string, H2DriveStatus> | undefined;
      if (treeMsg.drives && typeof treeMsg.drives === 'object') {
        const candidate: Record<string, H2DriveStatus> = {};
        for (const [k, v] of Object.entries(treeMsg.drives)) {
          if (v && typeof v === 'object' && typeof v.connected === 'boolean') {
            candidate[k] = { connected: v.connected, visible: Boolean(v.visible) };
          }
        }
        if (Object.keys(candidate).length > 0) {
          driveStatuses = candidate;
          onDrivesDiscoveredRef.current?.(Object.keys(candidate));
        }
      }

      setHandshakeInfo(prev =>
        prev
          ? {
              ...prev,
              provider: isIncremental ? prev.provider : provider,
              rootName: isIncremental ? prev.rootName : rootName,
              rootFolderId: isIncremental ? prev.rootFolderId : treeMsg.rootFolderId || prev.rootFolderId,
              driveRootActive: isIncremental ? prev.driveRootActive : driveRootFlag,
              drives: driveStatuses || prev.drives,
              stats: isIncremental ? prev.stats : treeMsg.stats || prev.stats,
            }
          : prev
      );

      if (isIncremental) {
        onFolderChildrenLoadedRef.current?.(treeMsg.basePath || '', provider, mappedItems);
      } else {
        onWorkspaceTreeLoadedRef.current?.(
          mappedItems,
          provider,
          rootName,
          primaryRelativePath,
          launchedItemType
        );
      }
    },
    []
  );

  /** Type 9a/9b: Explicit disconnect + sessionStorage cleanup */
  const stopBridge = useCallback(async () => {
    manuallyDisconnectedRef.current = true;
    const activeSid = clientRef.current?.sessionId || sessionId;
    if (clientRef.current) {
      await clientRef.current.disconnect();
      clientRef.current = null;
    } else {
      try {
        window.sessionStorage.removeItem(H2_SESSION_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    }
    setExtensionStatus('disconnected');
    setHandshakeInfo(null);
    setSessionId(null);
    logMessageRef.current(
      'event',
      'H2_SYSTEM_EVENT',
      { message: 'Extension bridge session closed (H2_DISCONNECT_REQ)' },
      'sent',
      undefined,
      activeSid
    );
  }, [sessionId]);

  /** Type 2a: Request workspace tree (supports driveRoot switching and depth limits) */
  const requestWorkspaceTree = useCallback(
    async ({
      provider,
      driveRoot = false,
      basePath,
      baseFolderId,
      maxDepth = 2,
      primaryRelativePathOverride,
      launchedItemTypeOverride,
      fallbackRootName,
    }: {
      provider?: CloudProvider;
      driveRoot?: boolean;
      basePath?: string;
      baseFolderId?: string;
      maxDepth?: number;
      primaryRelativePathOverride?: string;
      launchedItemTypeOverride?: 'folder' | 'file' | 'workspace';
      fallbackRootName?: string;
    } = {}) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) return;

      try {
        const res = await client.requestTree({
          provider,
          driveRoot,
          basePath,
          baseFolderId,
          maxDepth,
        });
        applyTreeResult(res, {
          isIncremental: Boolean(basePath),
          driveRoot,
          fallbackProvider: provider,
          fallbackRootName,
          primaryRelativePathOverride,
          launchedItemTypeOverride,
        });
      } catch (err: any) {
        logMessageRef.current(
          'event',
          'H2_WORKSPACE_TREE_ERROR',
          { provider, driveRoot, basePath, error: err?.message || 'Tree request failed' },
          'error',
          undefined,
          client.sessionId
        );
      }
    },
    [applyTreeResult]
  );

  /** Switch to full root of any connected drive (driveRoot: true) */
  const switchDriveRoot = useCallback(
    async (provider: CloudProvider, maxDepth = 2) => {
      await requestWorkspaceTree({
        provider,
        driveRoot: true,
        maxDepth,
        fallbackRootName: provider === 'all' ? 'All Connected Drives' : `${provider} Root`,
      });
    },
    [requestWorkspaceTree]
  );

  /** Unified v1.3 connection via H2_CONNECT_REQ (replaces launched handshake + direct connect) */
  const startBridge = useCallback(
    async (options?: { silentTimeout?: boolean }) => {
      const silentTimeout = Boolean(options?.silentTimeout);
      manuallyDisconnectedRef.current = false;
      refusedReasonRef.current = null;

      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }

      setConnectionError(null);
      setConnectionReasonCode(null);
      setExtensionStatus('connecting');
      setSessionId(null);

      const client = new H2BridgeClient({
        onOutgoing: (type, envelope) => {
          logMessageRef.current(
            'outgoing',
            type,
            envelope,
            'sent',
            undefined,
            envelope.sessionId || clientRef.current?.sessionId || null
          );
        },
        onIncoming: (type, envelope, roundtripMs) => {
          const status = envelope?.success === false ? 'error' : 'received';
          logMessageRef.current(
            'incoming',
            type,
            envelope,
            status,
            roundtripMs,
            envelope?.sessionId || clientRef.current?.sessionId || null
          );
        },
        onTimeout: (type, requestId, errorMessage) => {
          logMessageRef.current(
            'event',
            `${type}_TIMEOUT`,
            { requestId, error: errorMessage, sessionId: clientRef.current?.sessionId || null },
            'timeout',
            undefined,
            clientRef.current?.sessionId || null
          );
        },
      });

      clientRef.current = client;

      try {
        const startTs = performance.now();
        const res = await client.connect('FreshFood Rocks - Monarch IDE');
        const latencyMs = Math.round(performance.now() - startTs);

        if (res.success && res.sessionId) {
          if (res.drives && typeof res.drives === 'object') {
            const discoveredKeys = Object.keys(res.drives);
            if (discoveredKeys.length > 0) {
              onDrivesDiscoveredRef.current?.(discoveredKeys);
            }
          }

          const scope = res.launchedScope || null;
          const isDirectMode = res.sessionMode === 'direct' && !scope;
          const startupMode = directStartupDriveModeRef.current;
          const chosenDrive = directStartupDriveRef.current.trim();

          const effectiveProvider = scope?.provider || res.provider || 'all';
          const effectiveRootName = scope?.rootName || res.rootName || 'Cloud Workspace';
          const effectiveItemType = scope?.launchedItemType || res.launchedItemType || 'folder';
          const effectivePrimaryPath = scope?.primaryRelativePath ?? res.primaryRelativePath ?? '';
          const normalizedPrimaryPath = effectivePrimaryPath.replace(/^\/+|\/+$/g, '');

          // Custom shortcut launch: pcloud file "Monarch IDE" starts a fresh untitled editor
          // immediately while asynchronously loading the pcloud root tree in the background.
          const isMonarchShortcut =
            effectiveProvider === 'pcloud' &&
            effectiveItemType === 'file' &&
            normalizedPrimaryPath === 'Monarch IDE';

          const canLoadSingleDrive =
            Boolean(chosenDrive) &&
            chosenDrive !== 'all' &&
            (res.drives ? Boolean(res.drives[chosenDrive]?.connected) : true);

          const initialProvider = isMonarchShortcut
            ? 'pcloud'
            : isDirectMode && startupMode === 'single' && canLoadSingleDrive
              ? chosenDrive
              : effectiveProvider;
          const initialRootName = isMonarchShortcut
            ? 'pcloud Root'
            : isDirectMode && startupMode === 'none'
              ? 'Select a Cloud Drive'
              : isDirectMode && startupMode === 'single'
                ? canLoadSingleDrive
                  ? `${chosenDrive} Root`
                  : 'Select a Cloud Drive'
                : effectiveRootName;
          const initialDriveRootActive =
            isMonarchShortcut || (isDirectMode && startupMode === 'single' && canLoadSingleDrive);

          setExtensionStatus('connected');
          setSessionId(res.sessionId);
          setHandshakeInfo({
            name: 'Clockie H2 Extension',
            version: res.negotiatedVersion || '1.4',
            sessionId: res.sessionId,
            sessionMode: res.sessionMode,
            accessMode: res.accessMode || 'readwrite',
            provider: initialProvider,
            rootName: initialRootName,
            rootFolderId: isMonarchShortcut ? undefined : scope?.rootFolderId,
            launchedItemType: isMonarchShortcut ? 'workspace' : effectiveItemType,
            primaryRelativePath: isMonarchShortcut ? '' : effectivePrimaryPath,
            launchedScope: isMonarchShortcut ? null : scope,
            driveRootActive: initialDriveRootActive,
            drives: res.drives,
            capabilities: res.capabilities,
            connectedAt: new Date().toLocaleTimeString(),
            latencyMs,
          });

          if (isMonarchShortcut) {
            logMessageRef.current(
              'event',
              'H2_SYSTEM_EVENT',
              {
                message:
                  'Monarch IDE shortcut detected on pcloud: opening new untitled file & loading pcloud root asynchronously.',
                provider: effectiveProvider,
                launchedItemType: effectiveItemType,
                primaryRelativePath: normalizedPrimaryPath,
              },
              'sent',
              undefined,
              res.sessionId
            );
            onMonarchShortcutLaunchedRef.current?.({ provider: 'pcloud' });
            void requestWorkspaceTree({
              provider: 'pcloud',
              driveRoot: true,
              maxDepth: 2,
              primaryRelativePathOverride: '',
              launchedItemTypeOverride: 'workspace',
              fallbackRootName: 'pcloud Root',
            });
          } else if (!isDirectMode || startupMode === 'all') {
            // Launched mode always honors Clockie H2 scope; direct 'all' mode loads all connected drives
            await requestWorkspaceTree({
              provider: effectiveProvider,
              driveRoot: false,
              maxDepth: 2,
              primaryRelativePathOverride: effectivePrimaryPath,
              launchedItemTypeOverride: effectiveItemType,
              fallbackRootName: effectiveRootName,
            });
          } else if (startupMode === 'single' && canLoadSingleDrive) {
            await requestWorkspaceTree({
              provider: chosenDrive,
              driveRoot: true,
              maxDepth: 2,
              primaryRelativePathOverride: effectivePrimaryPath,
              launchedItemTypeOverride: effectiveItemType,
              fallbackRootName: `${chosenDrive} Root`,
            });
          } else {
            const skipNotice =
              startupMode === 'none'
                ? 'Bridge connected — select a drive in Explorer to load files.'
                : chosenDrive
                  ? `Preferred startup drive "${chosenDrive}" is not connected — select a drive in Explorer.`
                  : 'No startup drive selected — choose a drive in Explorer to load files.';

            logMessageRef.current(
              'event',
              'H2_SYSTEM_EVENT',
              { message: skipNotice, directStartupDriveMode: startupMode, chosenDrive },
              'sent',
              undefined,
              res.sessionId
            );
            onStartupSkippedNoticeRef.current?.(skipNotice);
          }
        } else {
          setExtensionStatus('disconnected');
          setSessionId(null);
          setConnectionError(res.error || 'Connection refused');
          setConnectionReasonCode(res.reasonCode || null);
          refusedReasonRef.current = res.reasonCode || 'REFUSED';
        }
      } catch (err: any) {
        const reasonCode = err instanceof H2BridgeError ? err.reasonCode : null;
        setExtensionStatus('disconnected');
        setSessionId(null);

        if (reasonCode === 'TIMEOUT' && silentTimeout) {
          return;
        }

        refusedReasonRef.current = reasonCode;
        setConnectionError(err?.message || 'Bridge connection failed');
        setConnectionReasonCode(reasonCode);

        logMessageRef.current(
          'event',
          'H2_CONNECT_REFUSED',
          { reasonCode, error: err?.message || 'Connection failed' },
          'error',
          undefined,
          null
        );
      }
    },
    [requestWorkspaceTree]
  );

  // Boot connect + listen for H2_BRIDGE_READY (document_start / DOMContentLoaded) + pagehide teardown
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true;
      startBridge({ silentTimeout: true });
    }

    const handleReadyEvent = (event: MessageEvent) => {
      if (event.source !== window) return;
      const d = event.data;
      if (
        d &&
        typeof d === 'object' &&
        d.protocol === H2_PROTOCOL &&
        d.__h2FromExtension === true &&
        d.type === 'H2_BRIDGE_READY'
      ) {
        // If we aren't actively connected/connecting and extension wasn't explicitly refused or manually stopped, auto-connect
        if (
          statusRef.current === 'disconnected' &&
          !manuallyDisconnectedRef.current &&
          !refusedReasonRef.current
        ) {
          startBridge({ silentTimeout: true });
        }
      }
    };

    const handlePageHide = () => {
      // Tear down listeners/timers cleanly on refresh/close without wiping sessionStorage
      // so F5 reloads can still forward previousSessionId in H2_CONNECT_REQ.
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };

    window.addEventListener('message', handleReadyEvent);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('message', handleReadyEvent);
      window.removeEventListener('pagehide', handlePageHide);
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, [startBridge]);

  /** Type 2b/2c: Lazily expand a folder whose childrenLoaded === false */
  const expandFolder = useCallback(
    async (folder: CloudFile, maxDepth = 1) => {
      const client = clientRef.current;
      if (!client) return;

      const useDriveRoot = Boolean(folder.driveRoot ?? handshakeInfo?.driveRootActive);
      try {
        const res = await client.listFolder({
          provider: folder.cloudProvider,
          driveRoot: useDriveRoot,
          basePath: folder.path,
          baseFolderId: folder.folderId,
          maxDepth,
        });
        applyTreeResult(
          {
            ...res,
            basePath: res.basePath ?? folder.path,
            provider: res.provider || folder.cloudProvider,
            driveRoot: useDriveRoot,
          },
          {
            isIncremental: true,
            driveRoot: useDriveRoot,
            fallbackProvider: folder.cloudProvider,
          }
        );
      } catch (err: any) {
        onFolderChildrenLoadErrorRef.current?.(
          folder.path,
          err?.message || 'Failed to expand folder'
        );
      }
    },
    [applyTreeResult, handshakeInfo?.driveRootActive]
  );

  /** Type 3/4: Lazy individual file content read */
  const readCloudFile = useCallback(
    async (file: CloudFile, encodingOverride?: 'utf-8' | 'base64') => {
      const client = clientRef.current;
      if (!client) return;

      const inferredEncoding: 'utf-8' | 'base64' =
        encodingOverride || (shouldRequestBase64(file) ? 'base64' : file.encoding || 'utf-8');
      const useDriveRoot = Boolean(file.driveRoot ?? handshakeInfo?.driveRootActive);

      try {
        const res = await client.readFile(
          file.path,
          file.cloudFileId,
          inferredEncoding,
          file.cloudProvider,
          useDriveRoot
        );
        const resolvedMime = res.mimeType || file.mimeType || inferMimeType(file.name);
        const isBinary =
          res.contentType === 'binary' ||
          res.encoding === 'base64' ||
          isKnownBinaryExtension(file.name);

        let binaryUrl: string | undefined;
        if (res.content && (res.encoding === 'base64' || res.contentType === 'binary')) {
          binaryUrl = res.content.startsWith('data:')
            ? res.content
            : `data:${resolvedMime || 'application/octet-stream'};base64,${res.content}`;
        }

        onFileContentLoadedRef.current?.(file.path, {
          cloudFileId: res.fileId || file.cloudFileId,
          parentId: res.parentFolderId || file.parentId,
          cloudProvider: res.provider || file.cloudProvider,
          name: res.filename || file.name,
          mimeType: resolvedMime,
          contentType: res.contentType,
          encoding: res.encoding,
          content: res.content ?? '',
          size: res.sizeBytes,
          modifiedMs: res.modifiedMs,
          lastModified: res.modifiedMs
            ? new Date(res.modifiedMs).toLocaleTimeString()
            : new Date().toLocaleTimeString(),
          isBinary,
          binaryUrl,
          contentLoaded: true,
          isLoadingContent: false,
          loadError: undefined,
          isDirty: false,
        });
      } catch (err: any) {
        onFileContentLoadErrorRef.current?.(file.path, err?.message || 'Failed to read file');
      }
    },
    [handshakeInfo?.driveRootActive]
  );

  /** Type 3/4 Concurrent Batch: Fetch multiple files simultaneously via Promise.all */
  const readMultipleCloudFiles = useCallback(
    async (filesToRead: CloudFile[]) => {
      const client = clientRef.current;
      if (!client || filesToRead.length === 0) return;

      const responses = await client.readFiles(
        filesToRead.map(f => ({
          relativePath: f.path,
          fileId: f.cloudFileId,
          encoding: shouldRequestBase64(f) ? 'base64' : f.encoding || 'utf-8',
          provider: f.cloudProvider,
          driveRoot: Boolean(f.driveRoot ?? handshakeInfo?.driveRootActive),
        }))
      );

      responses.forEach((res, idx) => {
        const orig = filesToRead[idx];
        const resolvedMime = res.mimeType || orig.mimeType || inferMimeType(orig.name);
        const isBinary =
          res.contentType === 'binary' ||
          res.encoding === 'base64' ||
          isKnownBinaryExtension(orig.name);
        let binaryUrl: string | undefined;
        if (res.content && (res.encoding === 'base64' || res.contentType === 'binary')) {
          binaryUrl = res.content.startsWith('data:')
            ? res.content
            : `data:${resolvedMime || 'application/octet-stream'};base64,${res.content}`;
        }

        onFileContentLoadedRef.current?.(res.relativePath || orig.path, {
          cloudFileId: res.fileId || orig.cloudFileId,
          parentId: res.parentFolderId || orig.parentId,
          cloudProvider: res.provider || orig.cloudProvider,
          name: res.filename || orig.name,
          mimeType: resolvedMime,
          contentType: res.contentType,
          encoding: res.encoding,
          content: res.content ?? '',
          size: res.sizeBytes,
          modifiedMs: res.modifiedMs,
          lastModified: res.modifiedMs
            ? new Date(res.modifiedMs).toLocaleTimeString()
            : new Date().toLocaleTimeString(),
          isBinary,
          binaryUrl,
          contentLoaded: true,
          isLoadingContent: false,
          loadError: undefined,
          isDirty: false,
        });
      });
    },
    [handshakeInfo?.driveRootActive]
  );

  /** Type 5/6: Save existing file or create new file/subdirectories (guarded by accessMode, capability & in-flight deduplication) */
  const saveCloudFile = useCallback(
    async (file: CloudFile) => {
      const client = clientRef.current;
      if (!client) {
        logMessageRef.current(
          'event',
          'H2_SYSTEM_EVENT',
          { message: `Skipped H2_SAVE_FILE_REQ for "${file.path}": no active H2 bridge session.` },
          'error'
        );
        onFileSaveErrorRef.current?.(file.id, 'Extension bridge is not connected');
        return;
      }

      if (handshakeInfo?.accessMode === 'readonly' || handshakeInfo?.capabilities?.save === false) {
        const reason = 'Workspace is in read-only mode (save disabled by extension policy)';
        logMessageRef.current('event', 'H2_SYSTEM_EVENT', { message: reason, path: file.path }, 'error');
        onFileSaveErrorRef.current?.(file.id, reason);
        return;
      }

      if (savingIdsRef.current.has(file.id)) {
        return;
      }

      savingIdsRef.current.add(file.id);
      setIsSaving(true);
      try {
        const isBinary = Boolean(file.isBinary);
        let contentToSend = file.content || '';
        if (isBinary && !contentToSend && file.binaryUrl?.startsWith('data:')) {
          const commaIdx = file.binaryUrl.indexOf(',');
          if (commaIdx >= 0) {
            contentToSend = file.binaryUrl.slice(commaIdx + 1);
          }
        }

        const res = await client.saveFile({
          provider: file.cloudProvider,
          driveRoot: Boolean(file.driveRoot ?? handshakeInfo?.driveRootActive),
          relativePath: file.path,
          fileId: file.cloudFileId,
          mimeType: file.mimeType || inferMimeType(file.name),
          contentType: isBinary ? 'binary' : 'text',
          encoding: isBinary ? 'base64' : 'utf-8',
          content: contentToSend,
        });

        onFileSaveConfirmedRef.current?.(file.id, res, contentToSend);
      } catch (err: any) {
        onFileSaveErrorRef.current?.(file.id, err?.message || 'Save failed');
      } finally {
        savingIdsRef.current.delete(file.id);
        setIsSaving(savingIdsRef.current.size > 0);
      }
    },
    [handshakeInfo]
  );

  const saveAllCloudFiles = useCallback(
    async (dirtyFiles: CloudFile[]) => {
      if (!clientRef.current || dirtyFiles.length === 0) return;
      setIsSaving(true);
      try {
        for (const f of dirtyFiles) {
          await saveCloudFile(f);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [saveCloudFile]
  );

  /** Type 7/8 & 11/12: Delete file (H2_DELETE_FILE_REQ) or folder (H2_DELETE_FOLDER_REQ) */
  const deleteCloudItem = useCallback(
    async ({
      provider,
      driveRoot,
      itemType,
      relativePath,
      fileId,
      folderId,
      permanent = false,
    }: {
      provider?: CloudProvider;
      driveRoot?: boolean;
      itemType: 'file' | 'folder';
      relativePath: string;
      fileId?: string;
      folderId?: string;
      permanent?: boolean;
    }) => {
      const client = clientRef.current;
      if (!client) {
        onItemDeleteErrorRef.current?.(relativePath, 'Extension bridge is not connected');
        return false;
      }

      if (handshakeInfo?.accessMode === 'readonly') {
        onItemDeleteErrorRef.current?.(
          relativePath,
          'Workspace is in read-only mode (delete disabled by extension policy)'
        );
        return false;
      }

      if (
        (itemType === 'folder' && handshakeInfo?.capabilities?.deleteFolders === false) ||
        (itemType === 'file' && handshakeInfo?.capabilities?.deleteFiles === false)
      ) {
        onItemDeleteErrorRef.current?.(
          relativePath,
          `${itemType === 'folder' ? 'Folder' : 'File'} deletion is disabled by extension policy`
        );
        return false;
      }

      try {
        const res = await client.deleteItem({
          provider,
          driveRoot: Boolean(driveRoot ?? handshakeInfo?.driveRootActive),
          itemType,
          relativePath,
          fileId,
          folderId,
          permanent,
        });

        onItemDeletedRef.current?.(itemType, res.relativePath || relativePath, res);
        return true;
      } catch (err: any) {
        onItemDeleteErrorRef.current?.(relativePath, err?.message || 'Delete failed');
        return false;
      }
    },
    [handshakeInfo]
  );

  /** Type 9/10: Create folder(s) via H2_CREATE_FOLDER_REQ */
  const createCloudFolder = useCallback(
    async ({
      provider,
      driveRoot,
      relativePath,
      parentRelativePath,
      parentFolderId,
      folderName,
    }: {
      provider: CloudProvider;
      driveRoot?: boolean;
      relativePath: string;
      parentRelativePath?: string;
      parentFolderId?: string;
      folderName?: string;
    }) => {
      const effectiveDriveRoot = Boolean(driveRoot ?? handshakeInfo?.driveRootActive);
      const client = clientRef.current;
      if (!client) {
        onFolderCreateErrorRef.current?.(relativePath, 'Extension bridge is not connected');
        return false;
      }

      if (
        handshakeInfo?.accessMode === 'readonly' ||
        handshakeInfo?.capabilities?.createFolders === false
      ) {
        onFolderCreateErrorRef.current?.(
          relativePath,
          'Folder creation is disabled by extension policy'
        );
        return false;
      }

      try {
        const res = await client.createFolder({
          provider,
          driveRoot: effectiveDriveRoot,
          relativePath,
          parentRelativePath,
          parentFolderId,
          folderName,
        });
        onFolderCreatedRef.current?.(res, {
          provider: res.provider || provider,
          driveRoot: effectiveDriveRoot,
          relativePath: res.relativePath || relativePath,
        });
        return true;
      } catch (err: any) {
        onFolderCreateErrorRef.current?.(
          relativePath,
          err?.message || 'Failed to create cloud folder'
        );
        return false;
      }
    },
    [handshakeInfo]
  );

  /** Type 13/14 & 15/16: Same-drive native move or rename via H2_MOVE_FILE_REQ / H2_MOVE_FOLDER_REQ */
  const moveCloudItem = useCallback(
    async ({
      itemType,
      provider,
      targetProvider,
      driveRoot,
      relativePath,
      fileId,
      folderId,
      targetRelativePath,
      overwrite = false,
    }: {
      itemType: 'file' | 'folder';
      provider: CloudProvider;
      targetProvider?: CloudProvider;
      driveRoot?: boolean;
      relativePath: string;
      fileId?: string;
      folderId?: string;
      targetRelativePath: string;
      overwrite?: boolean;
    }) => {
      const effectiveDriveRoot = Boolean(driveRoot ?? handshakeInfo?.driveRootActive);
      const itemId = itemType === 'folder' ? folderId : fileId;
      const client = clientRef.current;

      const emitMoveError = (error: string, reasonCode: string | null = null) => {
        onItemMoveErrorRef.current?.({
          itemType,
          provider,
          driveRoot: effectiveDriveRoot,
          itemId,
          oldRelativePath: relativePath,
          targetRelativePath,
          overwrite,
          error,
          reasonCode,
        });
      };

      if (!client) {
        emitMoveError('Extension bridge is not connected', 'NOT_CONNECTED');
        return false;
      }

      if (handshakeInfo?.accessMode === 'readonly') {
        emitMoveError('Workspace is in read-only mode (move disabled by extension policy)', 'READ_ONLY');
        return false;
      }

      if (
        (itemType === 'folder' && handshakeInfo?.capabilities?.moveFolders === false) ||
        (itemType === 'file' && handshakeInfo?.capabilities?.moveFiles === false)
      ) {
        emitMoveError(
          `Moving ${itemType === 'folder' ? 'folders' : 'files'} is disabled by extension policy`,
          'CAPABILITY_DISABLED'
        );
        return false;
      }

      if (targetProvider && provider && targetProvider !== provider) {
        emitMoveError(
          `Cannot move across different drives (${provider} -> ${targetProvider}).`,
          'CROSS_DRIVE_NOT_ALLOWED'
        );
        return false;
      }

      const cleanTarget = targetRelativePath.replace(/^\/+|\/+$/g, '');
      const targetLastSlash = cleanTarget.lastIndexOf('/');
      const targetParentPath = targetLastSlash >= 0 ? cleanTarget.slice(0, targetLastSlash) : '';
      const newName = targetLastSlash >= 0 ? cleanTarget.slice(targetLastSlash + 1) : cleanTarget;

      try {
        const res =
          itemType === 'folder'
            ? await client.moveFolder({
                provider,
                targetProvider: targetProvider || provider,
                driveRoot: effectiveDriveRoot,
                relativePath,
                folderId,
                targetRelativePath: cleanTarget,
                targetParentPath,
                newName,
                overwrite,
              })
            : await client.moveFile({
                provider,
                targetProvider: targetProvider || provider,
                driveRoot: effectiveDriveRoot,
                relativePath,
                fileId,
                targetRelativePath: cleanTarget,
                targetParentPath,
                newName,
                overwrite,
              });

        const resolvedNewPath = (
          res.relativePath ||
          res.targetRelativePath ||
          cleanTarget
        ).replace(/^\/+|\/+$/g, '');

        onItemMovedRef.current?.(
          itemType,
          res.provider || provider,
          relativePath,
          resolvedNewPath,
          res
        );
        return true;
      } catch (err: any) {
        emitMoveError(
          err?.message || 'Move failed',
          err instanceof H2BridgeError ? err.reasonCode : null
        );
        return false;
      }
    },
    [handshakeInfo]
  );

  /**
   * Isolated Type 2b/2c folder listing for Preferences Export/Import modals.
   * Uses driveRoot: true directly against H2BridgeClient without mutating workspace tree state.
   */
  const listDriveEntries = useCallback(
    async ({
      provider,
      basePath = '',
      baseFolderId,
      maxDepth = 1,
    }: {
      provider: CloudProvider;
      basePath?: string;
      baseFolderId?: string;
      maxDepth?: number;
    }) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) {
        throw new H2BridgeError('Extension bridge is not connected', 'NOT_CONNECTED');
      }

      const cleanBasePath = basePath.replace(/^\/+|\/+$/g, '');
      const res = await client.listFolder({
        provider,
        driveRoot: true,
        basePath: cleanBasePath || undefined,
        baseFolderId,
        maxDepth,
      });

      const folders = [...(res.folders || [])];
      const filesList = [...(res.files || [])];

      // Support responses that group entries under res.drives[provider]
      if (res.drives && typeof res.drives === 'object') {
        const driveBucket = res.drives[provider];
        if (driveBucket && typeof driveBucket === 'object') {
          if (Array.isArray(driveBucket.folders)) folders.push(...driveBucket.folders);
          if (Array.isArray(driveBucket.files)) filesList.push(...driveBucket.files);
        }
      }

      return {
        provider: res.provider || provider,
        basePath: res.basePath ?? cleanBasePath,
        rootName: res.rootName,
        folders,
        files: filesList,
        drives: res.drives,
      };
    },
    []
  );

  /**
   * Isolated Type 3/4 file read for importing preferences JSON from any connected drive.
   */
  const readRawCloudFile = useCallback(
    async ({
      provider,
      relativePath,
      fileId,
    }: {
      provider: CloudProvider;
      relativePath: string;
      fileId?: string;
    }) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) {
        throw new H2BridgeError('Extension bridge is not connected', 'NOT_CONNECTED');
      }
      return client.readFile(relativePath, fileId, 'utf-8', provider, true);
    },
    []
  );

  /**
   * Isolated Type 5/6 file save for exporting preferences JSON to any connected drive.
   */
  const saveRawCloudFile = useCallback(
    async ({
      provider,
      relativePath,
      fileId,
      content,
    }: {
      provider: CloudProvider;
      relativePath: string;
      fileId?: string;
      content: string;
    }) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) {
        throw new H2BridgeError('Extension bridge is not connected', 'NOT_CONNECTED');
      }
      if (handshakeInfo?.accessMode === 'readonly' || handshakeInfo?.capabilities?.save === false) {
        throw new H2BridgeError(
          'Workspace is in read-only mode (saving disabled by extension policy)',
          'READ_ONLY'
        );
      }

      return client.saveFile({
        provider,
        driveRoot: true,
        relativePath,
        fileId,
        mimeType: 'application/json',
        contentType: 'text',
        encoding: 'utf-8',
        content,
      });
    },
    [handshakeInfo]
  );

  /**
   * Promise-returning Type 5/6 save for File -> Save As... across any connected drive/folder.
   */
  const saveAsCloudFile = useCallback(
    async ({
      provider,
      driveRoot = true,
      relativePath,
      existingFileId,
      mimeType,
      contentType = 'text',
      encoding = 'utf-8',
      content,
    }: {
      provider: CloudProvider;
      driveRoot?: boolean;
      relativePath: string;
      existingFileId?: string;
      mimeType?: string;
      contentType?: 'text' | 'binary';
      encoding?: 'utf-8' | 'base64';
      content: string;
    }) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) {
        throw new H2BridgeError('Extension bridge is not connected', 'NOT_CONNECTED');
      }
      if (handshakeInfo?.accessMode === 'readonly' || handshakeInfo?.capabilities?.save === false) {
        throw new H2BridgeError(
          'Workspace is in read-only mode (saving disabled by extension policy)',
          'READ_ONLY'
        );
      }

      setIsSaving(true);
      try {
        return await client.saveFile({
          provider,
          driveRoot,
          relativePath,
          fileId: existingFileId,
          mimeType: mimeType || inferMimeType(relativePath),
          contentType,
          encoding,
          content,
        });
      } finally {
        setIsSaving(savingIdsRef.current.size > 0);
      }
    },
    [handshakeInfo]
  );

  /**
   * Promise-returning Type 9/10 folder creation for modal pickers (e.g. Save As... -> New Folder).
   */
  const createRawCloudFolder = useCallback(
    async ({
      provider,
      driveRoot = true,
      relativePath,
      parentRelativePath,
      parentFolderId,
      folderName,
    }: {
      provider: CloudProvider;
      driveRoot?: boolean;
      relativePath: string;
      parentRelativePath?: string;
      parentFolderId?: string;
      folderName?: string;
    }) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) {
        throw new H2BridgeError('Extension bridge is not connected', 'NOT_CONNECTED');
      }
      if (
        handshakeInfo?.accessMode === 'readonly' ||
        handshakeInfo?.capabilities?.createFolders === false
      ) {
        throw new H2BridgeError(
          'Folder creation is disabled by extension policy',
          'CAPABILITY_DISABLED'
        );
      }

      return client.createFolder({
        provider,
        driveRoot,
        relativePath,
        parentRelativePath,
        parentFolderId,
        folderName,
      });
    },
    [handshakeInfo]
  );

  return {
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
    readMultipleCloudFiles,
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
    dismissConnectionError: () => {
      setConnectionError(null);
      setConnectionReasonCode(null);
    },
    clearLogs: () => setMessagesLog([]),
  };
}
