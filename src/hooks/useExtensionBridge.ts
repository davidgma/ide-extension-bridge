/**
 * React hook managing the Clockie H2 Bridge Protocol v1.2 (H2_CLOUD_BRIDGE) lifecycle:
 * 1. Dual Connection Modes on mount:
 *    - Launched Mode (#h2Session=<sessionId>): Type 1a/1b handshake + automatic H2_WORKSPACE_TREE.
 *    - Direct Mode (no h2Session): Type 0a/0b H2_CONNECT_REQ/RES, handles origin authorization
 *      refusals gracefully, captures accessMode ("readwrite" | "readonly") & multi-drive map.
 * 2. Depth-limited & lazy folder trees: Type 2a H2_WORKSPACE_TREE_REQ & Type 2b/2c H2_LIST_FOLDER_REQ/RES.
 * 3. Lazy / concurrent file reads: Type 4/5 H2_READ_FILE_REQ/RES (single or Promise.all batch).
 * 4. Readwrite cloud saves & nested creations: Type 6/7 H2_SAVE_FILE_REQ/RES.
 * 5. Readwrite cloud file/folder deletions: Type 8/9 H2_DELETE_FILE_REQ/RES.
 * 6. Clean disconnect: Type 10a/10b H2_DISCONNECT_REQ/RES.
 *
 * Official Documentation:
 * - React Hooks: https://react.dev/reference/react
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
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
} from '../types/ide';
import {
  H2BridgeClient,
  H2BridgeError,
  H2WorkspaceTree,
  H2SaveFileRes,
  H2DeleteFileRes,
  getH2SessionId,
} from '../utils/h2BridgeClient';
import { inferMimeType } from '../utils/fileSystem';

interface UseExtensionBridgeProps {
  onWorkspaceTreeLoaded?: (
    files: CloudFile[],
    provider: CloudProvider,
    rootName: string,
    primaryRelativePath: string,
    launchedItemType: 'folder' | 'file'
  ) => void;
  onFolderChildrenLoaded?: (
    basePath: string,
    provider: CloudProvider,
    childrenItems: CloudFile[]
  ) => void;
  onFolderChildrenLoadError?: (basePath: string, error: string) => void;
  onFileContentLoaded?: (relativePath: string, updatedFields: Partial<CloudFile>) => void;
  onFileContentLoadError?: (relativePath: string, error: string) => void;
  onFileSaveConfirmed?: (localId: string, res: H2SaveFileRes) => void;
  onFileSaveError?: (localId: string, error: string) => void;
  onItemDeleted?: (itemType: 'file' | 'folder', relativePath: string, res: H2DeleteFileRes) => void;
  onItemDeleteError?: (relativePath: string, error: string) => void;
}

/** Converts H2_WORKSPACE_TREE / H2_LIST_FOLDER_RES items into Monarch IDE CloudFile records */
function mapTreePayloadToCloudFiles(treeMsg: H2WorkspaceTree): CloudFile[] {
  const defaultProvider = treeMsg.provider || 'cloud';
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

    const isBin = file.contentType === 'binary' || file.encoding === 'base64';
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
      isDirectory: false,
      cloudProvider: provider,
      mimeType: file.mimeType,
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

  // If provider === "all" and treeMsg.drives carries per-drive folders/files buckets, extract them too
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
  onFolderChildrenLoaded,
  onFolderChildrenLoadError,
  onFileContentLoaded,
  onFileContentLoadError,
  onFileSaveConfirmed,
  onFileSaveError,
  onItemDeleted,
  onItemDeleteError,
}: UseExtensionBridgeProps = {}) {
  const [sessionId, setSessionId] = useState<string | null>(() => getH2SessionId());
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>('disconnected');
  const [handshakeInfo, setHandshakeInfo] = useState<ExtensionHandshakeInfo | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionReasonCode, setConnectionReasonCode] = useState<string | null>(null);
  const [messagesLog, setMessagesLog] = useState<BridgeMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const clientRef = useRef<H2BridgeClient | null>(null);
  const hasBootedRef = useRef(false);

  // Stable refs for parent callbacks
  const onWorkspaceTreeLoadedRef = useRef(onWorkspaceTreeLoaded);
  const onFolderChildrenLoadedRef = useRef(onFolderChildrenLoaded);
  const onFolderChildrenLoadErrorRef = useRef(onFolderChildrenLoadError);
  const onFileContentLoadedRef = useRef(onFileContentLoaded);
  const onFileContentLoadErrorRef = useRef(onFileContentLoadError);
  const onFileSaveConfirmedRef = useRef(onFileSaveConfirmed);
  const onFileSaveErrorRef = useRef(onFileSaveError);
  const onItemDeletedRef = useRef(onItemDeleted);
  const onItemDeleteErrorRef = useRef(onItemDeleteError);

  useEffect(() => {
    onWorkspaceTreeLoadedRef.current = onWorkspaceTreeLoaded;
  }, [onWorkspaceTreeLoaded]);

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
      status: 'sent' | 'received' | 'acknowledged' | 'error' | 'timeout' = 'sent',
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

  const handleIncomingTree = useCallback((treeMsg: H2WorkspaceTree, isIncremental = false) => {
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

    const provider = treeMsg.provider || 'cloud';
    const rootName = treeMsg.rootName || 'Cloud Workspace';
    const launchedItemType = treeMsg.launchedItemType || 'folder';
    const primaryRelativePath = treeMsg.primaryRelativePath || '';
    const mappedItems = mapTreePayloadToCloudFiles(treeMsg);

    // Extract drive availability metadata if present (e.g. { pcloud: { connected, visible } })
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
      }
    }

    setHandshakeInfo(prev =>
      prev
        ? {
            ...prev,
            provider: isIncremental ? prev.provider : provider,
            rootName: isIncremental ? prev.rootName : rootName,
            rootFolderId: isIncremental ? prev.rootFolderId : treeMsg.rootFolderId || prev.rootFolderId,
            launchedItemType: treeMsg.launchedItemType || prev.launchedItemType,
            primaryRelativePath: treeMsg.primaryRelativePath ?? prev.primaryRelativePath,
            drives: driveStatuses || prev.drives,
            stats: isIncremental ? prev.stats : treeMsg.stats || prev.stats,
          }
        : {
            name: 'Clockie H2 Extension',
            version: treeMsg.protocolVersion || '1.2',
            sessionId: treeMsg.sessionId,
            provider,
            rootName,
            rootFolderId: treeMsg.rootFolderId,
            launchedItemType,
            primaryRelativePath,
            drives: driveStatuses,
            stats: treeMsg.stats,
            connectedAt: new Date().toLocaleTimeString(),
          }
    );

    if (isIncremental) {
      if (onFolderChildrenLoadedRef.current) {
        onFolderChildrenLoadedRef.current(treeMsg.basePath || '', provider, mappedItems);
      }
    } else if (onWorkspaceTreeLoadedRef.current) {
      onWorkspaceTreeLoadedRef.current(
        mappedItems,
        provider,
        rootName,
        primaryRelativePath,
        launchedItemType
      );
    }
  }, []);

  /** Type 10a/10b: Gracefully disconnect active session */
  const stopBridge = useCallback(async () => {
    const activeSid = clientRef.current?.sessionId || sessionId;
    if (clientRef.current) {
      await clientRef.current.disconnect();
      clientRef.current = null;
    }
    setExtensionStatus('disconnected');
    setHandshakeInfo(null);
    setSessionId(getH2SessionId());
    logMessageRef.current(
      'event',
      'H2_SYSTEM_EVENT',
      { message: 'Extension bridge session closed' },
      'sent',
      undefined,
      activeSid
    );
  }, [sessionId]);

  /** Type 2a/2: Request full or filtered workspace tree on demand */
  const requestWorkspaceTree = useCallback(
    async ({
      provider,
      basePath,
      baseFolderId,
      maxDepth = 2,
    }: {
      provider?: CloudProvider;
      basePath?: string;
      baseFolderId?: string;
      maxDepth?: number;
    } = {}) => {
      const client = clientRef.current;
      if (!client || !client.sessionId) return;

      try {
        const res = await client.requestTree({
          provider,
          basePath,
          baseFolderId,
          maxDepth,
        });
        // onTree already processes H2_WORKSPACE_TREE replies; only handle non-H2_WORKSPACE_TREE here
        if (res && res.type !== 'H2_WORKSPACE_TREE') {
          handleIncomingTree(res, Boolean(basePath));
        }
      } catch (err: any) {
        logMessageRef.current(
          'event',
          'H2_WORKSPACE_TREE_ERROR',
          { provider, basePath, error: err?.message || 'Tree request failed' },
          'error',
          undefined,
          client.sessionId
        );
      }
    },
    [handleIncomingTree]
  );

  /**
   * Connects using either Launched Mode (if #h2Session or explicitSessionId is supplied)
   * or Direct Mode (H2_CONNECT_REQ when forceDirect is true or no h2Session exists in URL).
   */
  const startBridge = useCallback(
    async (explicitSessionId?: string, options?: { forceDirect?: boolean; silentTimeout?: boolean }) => {
      const forceDirect = Boolean(options?.forceDirect);
      const silentTimeout = Boolean(options?.silentTimeout);
      const targetSid = forceDirect
        ? null
        : (explicitSessionId ?? getH2SessionId())?.trim() || null;

      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }

      setConnectionError(null);
      setConnectionReasonCode(null);
      setExtensionStatus('connecting');
      setSessionId(targetSid);

      const client = new H2BridgeClient(targetSid, {
        onOutgoing: (type, envelope) => {
          logMessageRef.current(
            'outgoing',
            type,
            envelope,
            'sent',
            undefined,
            envelope.sessionId || clientRef.current?.sessionId || targetSid
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
            envelope?.sessionId || clientRef.current?.sessionId || targetSid
          );
        },
        onTimeout: (type, requestId, errorMessage) => {
          logMessageRef.current(
            'event',
            `${type}_TIMEOUT`,
            { requestId, error: errorMessage, sessionId: clientRef.current?.sessionId || targetSid },
            'timeout',
            undefined,
            clientRef.current?.sessionId || targetSid
          );
        },
      });

      client.onTree = treeMsg => handleIncomingTree(treeMsg, false);
      clientRef.current = client;

      try {
        const startTs = performance.now();

        if (targetSid) {
          // Launched Mode (v1.1 / v1.2)
          const res = await client.handshake('FreshFood Rocks - Monarch IDE');
          const latencyMs = Math.round(performance.now() - startTs);

          if (res.success) {
            setExtensionStatus('connected');
            setSessionId(res.sessionId || targetSid);
            setHandshakeInfo({
              name: 'Clockie H2 Extension',
              version: res.negotiatedVersion || '1.2',
              sessionId: res.sessionId || targetSid,
              sessionMode: res.sessionMode || 'launched',
              accessMode: res.accessMode || 'readwrite',
              provider: res.provider,
              rootName: res.rootName,
              launchedItemType: res.launchedItemType,
              primaryRelativePath: res.primaryRelativePath,
              drives: res.drives,
              capabilities: res.capabilities,
              connectedAt: new Date().toLocaleTimeString(),
              latencyMs,
            });
          } else {
            setExtensionStatus('disconnected');
            setConnectionError(res.error || 'Handshake failed');
            setConnectionReasonCode(res.reasonCode || null);
          }
        } else {
          // Direct Mode (v1.2): request new session for this authorized origin
          const res = await client.connectDirect('FreshFood Rocks - Monarch IDE');
          const latencyMs = Math.round(performance.now() - startTs);

          if (res.success && res.sessionId) {
            setExtensionStatus('connected');
            setSessionId(res.sessionId);
            setHandshakeInfo({
              name: 'Clockie H2 Extension',
              version: res.negotiatedVersion || '1.2',
              sessionId: res.sessionId,
              sessionMode: res.sessionMode || 'direct',
              accessMode: res.accessMode || 'readwrite',
              provider: res.provider || 'all',
              rootName: res.rootName || 'All Connected Drives',
              drives: res.drives,
              capabilities: res.capabilities,
              connectedAt: new Date().toLocaleTimeString(),
              latencyMs,
            });

            // Immediately request top-level depth-limited tree (maxDepth: 2)
            await requestWorkspaceTree({
              provider: res.provider || 'all',
              maxDepth: 2,
            });
          } else {
            setExtensionStatus('disconnected');
            setSessionId(null);
            setConnectionError(res.error || 'Direct connection refused');
            setConnectionReasonCode(res.reasonCode || null);
          }
        }
      } catch (err: any) {
        const reasonCode = err instanceof H2BridgeError ? err.reasonCode : null;
        setExtensionStatus('disconnected');
        if (!targetSid) {
          setSessionId(null);
        }

        // Ignore background boot timeout gracefully when opened standalone without the extension
        if (reasonCode === 'TIMEOUT' && silentTimeout) {
          return;
        }

        setConnectionError(err?.message || 'Bridge connection failed');
        setConnectionReasonCode(reasonCode);

        logMessageRef.current(
          'event',
          targetSid ? 'H2_HANDSHAKE_FAILED' : 'H2_CONNECT_REFUSED',
          {
            sessionId: targetSid,
            reasonCode,
            error: err?.message || 'Connection failed',
          },
          'error',
          undefined,
          targetSid
        );
      }
    },
    [handleIncomingTree, requestWorkspaceTree]
  );

  // Auto-connect on mount using v1.2 dual mode (Launched if #h2Session exists, else Direct)
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true;
      const bootSid = getH2SessionId();
      if (bootSid) {
        startBridge(bootSid);
      } else {
        startBridge(undefined, { forceDirect: true, silentTimeout: true });
      }
    }

    return () => {
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

      try {
        const res = await client.listFolder({
          provider: folder.cloudProvider,
          basePath: folder.path,
          baseFolderId: folder.folderId,
          maxDepth,
        });
        // Merge incrementally into the existing tree
        handleIncomingTree(
          {
            ...res,
            basePath: res.basePath ?? folder.path,
            provider: res.provider || folder.cloudProvider,
          },
          true
        );
      } catch (err: any) {
        if (onFolderChildrenLoadErrorRef.current) {
          onFolderChildrenLoadErrorRef.current(
            folder.path,
            err?.message || 'Failed to expand folder'
          );
        }
      }
    },
    [handleIncomingTree]
  );

  /** Type 4/5: Lazy individual file content read */
  const readCloudFile = useCallback(
    async (file: CloudFile, encodingOverride?: 'utf-8' | 'base64') => {
      const client = clientRef.current;
      if (!client) return;

      const inferredEncoding: 'utf-8' | 'base64' | undefined =
        encodingOverride || file.encoding || (file.isBinary ? 'base64' : 'utf-8');

      try {
        const res = await client.readFile(
          file.path,
          file.cloudFileId,
          inferredEncoding,
          file.cloudProvider
        );
        const isBinary = res.contentType === 'binary' || res.encoding === 'base64';
        const resolvedMime = res.mimeType || file.mimeType || inferMimeType(file.name);

        let binaryUrl: string | undefined;
        if (isBinary && res.content) {
          binaryUrl = res.content.startsWith('data:')
            ? res.content
            : `data:${resolvedMime || 'application/octet-stream'};base64,${res.content}`;
        }

        if (onFileContentLoadedRef.current) {
          onFileContentLoadedRef.current(file.path, {
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
        }
      } catch (err: any) {
        if (onFileContentLoadErrorRef.current) {
          onFileContentLoadErrorRef.current(file.path, err?.message || 'Failed to read file');
        }
      }
    },
    []
  );

  /** Type 4/5 Concurrent Batch: Fetch multiple files simultaneously via Promise.all */
  const readMultipleCloudFiles = useCallback(
    async (filesToRead: CloudFile[]) => {
      const client = clientRef.current;
      if (!client || filesToRead.length === 0) return;

      const responses = await client.readFiles(
        filesToRead.map(f => ({
          relativePath: f.path,
          fileId: f.cloudFileId,
          encoding: f.encoding || (f.isBinary ? 'base64' : 'utf-8'),
          provider: f.cloudProvider,
        }))
      );

      responses.forEach((res, idx) => {
        const orig = filesToRead[idx];
        const isBinary = res.contentType === 'binary' || res.encoding === 'base64';
        const resolvedMime = res.mimeType || orig.mimeType || inferMimeType(orig.name);
        let binaryUrl: string | undefined;
        if (isBinary && res.content) {
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
    []
  );

  /** Type 6/7: Save existing file or create new file/subdirectories (guarded by accessMode & capability) */
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
          relativePath: file.path,
          fileId: file.cloudFileId,
          mimeType: file.mimeType || inferMimeType(file.name),
          contentType: isBinary ? 'binary' : 'text',
          encoding: isBinary ? 'base64' : 'utf-8',
          content: contentToSend,
        });

        onFileSaveConfirmedRef.current?.(file.id, res);
      } catch (err: any) {
        onFileSaveErrorRef.current?.(file.id, err?.message || 'Save failed');
      } finally {
        setIsSaving(false);
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

  /** Type 8/9: Delete file or folder (guarded by accessMode) */
  const deleteCloudItem = useCallback(
    async ({
      provider,
      itemType,
      relativePath,
      fileId,
      folderId,
      permanent = false,
    }: {
      provider?: CloudProvider;
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

      try {
        const res = await client.deleteItem({
          provider,
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
    expandFolder,
    readCloudFile,
    readMultipleCloudFiles,
    saveCloudFile,
    saveAllCloudFiles,
    deleteCloudItem,
    dismissConnectionError: () => {
      setConnectionError(null);
      setConnectionReasonCode(null);
    },
    clearLogs: () => setMessagesLog([]),
  };
}
