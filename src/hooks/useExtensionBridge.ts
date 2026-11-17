/**
 * React hook managing the Clockie H2 Bridge Protocol v1.1 (H2_CLOUD_BRIDGE) lifecycle:
 * 1. Reads #h2Session=<sessionId> (or ?h2Session=) on mount.
 * 2. Performs Type 1a/1b handshake (H2_HANDSHAKE_REQ -> H2_HANDSHAKE_RES).
 * 3. Receives Type 2 H2_WORKSPACE_TREE (metadata only) and replies with Type 3 H2_WORKSPACE_TREE_ACK.
 * 4. Lazily reads individual file contents on demand via Type 4/5 (H2_READ_FILE_REQ -> H2_READ_FILE_RES).
 * 5. Saves/creates files (including nested subdirectories) via Type 6/7 (H2_SAVE_FILE_REQ -> H2_SAVE_FILE_RES).
 * 6. Deletes files and folders via Type 8/9 (H2_DELETE_FILE_REQ -> H2_DELETE_FILE_RES).
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
} from '../types/ide';
import {
  H2BridgeClient,
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
  onFileContentLoaded?: (relativePath: string, updatedFields: Partial<CloudFile>) => void;
  onFileContentLoadError?: (relativePath: string, error: string) => void;
  onFileSaveConfirmed?: (localId: string, res: H2SaveFileRes) => void;
  onFileSaveError?: (localId: string, error: string) => void;
  onItemDeleted?: (itemType: 'file' | 'folder', relativePath: string, res: H2DeleteFileRes) => void;
  onItemDeleteError?: (relativePath: string, error: string) => void;
}

export function useExtensionBridge({
  onWorkspaceTreeLoaded,
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
  const [messagesLog, setMessagesLog] = useState<BridgeMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const clientRef = useRef<H2BridgeClient | null>(null);
  const hasBootedRef = useRef(false);

  // Stable refs for parent callbacks
  const onWorkspaceTreeLoadedRef = useRef(onWorkspaceTreeLoaded);
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

      setMessagesLog(prev => [entry, ...prev.slice(0, 149)]);
      return entry;
    },
    [getDispatchInfo]
  );

  const logMessageRef = useRef(logMessage);
  useEffect(() => {
    logMessageRef.current = logMessage;
  }, [logMessage]);

  const handleIncomingTree = useCallback((treeMsg: H2WorkspaceTree) => {
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

    const folderItems: CloudFile[] = (treeMsg.folders || []).map(folder => ({
      id: `dir-${folder.relativePath}`,
      folderId: folder.folderId,
      parentId: folder.parentFolderId,
      parentRelativePath: folder.parentRelativePath,
      name: folder.name,
      path: folder.relativePath,
      content: '',
      contentLoaded: true,
      isDirectory: true,
      cloudProvider: provider,
      modifiedMs: folder.modifiedMs,
      lastModified: folder.modifiedMs ? new Date(folder.modifiedMs).toLocaleTimeString() : undefined,
    }));

    const fileItems: CloudFile[] = (treeMsg.files || []).map(file => {
      const isBin = file.contentType === 'binary' || file.encoding === 'base64';
      return {
        id: file.fileId ? String(file.fileId) : `h2-${file.relativePath}`,
        cloudFileId: file.fileId,
        parentId: file.parentFolderId,
        parentRelativePath: file.parentRelativePath,
        name: file.name,
        path: file.relativePath,
        content: '',
        contentLoaded: false, // Metadata only; content will be fetched lazily via H2_READ_FILE_REQ
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
      };
    });

    setHandshakeInfo(prev =>
      prev
        ? {
            ...prev,
            provider,
            rootName,
            rootFolderId: treeMsg.rootFolderId,
            launchedItemType,
            primaryRelativePath,
            stats: treeMsg.stats,
          }
        : {
            name: 'Clockie H2 Extension',
            version: treeMsg.protocolVersion || '1.1',
            sessionId: treeMsg.sessionId,
            provider,
            rootName,
            rootFolderId: treeMsg.rootFolderId,
            launchedItemType,
            primaryRelativePath,
            stats: treeMsg.stats,
            connectedAt: new Date().toLocaleTimeString(),
          }
    );

    if (onWorkspaceTreeLoadedRef.current) {
      onWorkspaceTreeLoadedRef.current(
        [...folderItems, ...fileItems],
        provider,
        rootName,
        primaryRelativePath,
        launchedItemType
      );
    }
  }, []);

  const stopBridge = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.destroy();
      clientRef.current = null;
    }
    setExtensionStatus('disconnected');
    setHandshakeInfo(null);
    logMessageRef.current(
      'event',
      'H2_SYSTEM_EVENT',
      { message: 'Extension bridge disconnected by user' },
      'sent',
      undefined,
      sessionId
    );
  }, [sessionId]);

  const startBridge = useCallback(
    async (explicitSessionId?: string) => {
      const targetSid = (explicitSessionId ?? getH2SessionId() ?? sessionId)?.trim() || null;

      if (!targetSid) {
        setExtensionStatus('disconnected');
        logMessageRef.current(
          'event',
          'H2_SYSTEM_EVENT',
          {
            message:
              'No h2Session parameter found in URL hash/search. Open this app from the Clockie H2 Chrome extension (#h2Session=<sessionId>) or provide a session ID in the Extension Bridge Debugger.',
          },
          'error',
          undefined,
          null
        );
        return;
      }

      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }

      setSessionId(targetSid);
      setExtensionStatus('connecting');

      const client = new H2BridgeClient(targetSid, {
        onOutgoing: (type, envelope) => {
          logMessageRef.current('outgoing', type, envelope, 'sent', undefined, targetSid);
        },
        onIncoming: (type, envelope, roundtripMs) => {
          const status = envelope?.success === false ? 'error' : 'received';
          logMessageRef.current('incoming', type, envelope, status, roundtripMs, targetSid);
        },
        onTimeout: (type, requestId, errorMessage) => {
          logMessageRef.current(
            'event',
            `${type}_TIMEOUT`,
            { requestId, error: errorMessage, sessionId: targetSid },
            'timeout',
            undefined,
            targetSid
          );
        },
      });

      client.onTree = handleIncomingTree;
      clientRef.current = client;

      try {
        const startTs = performance.now();
        const res = await client.handshake('FreshFood Rocks - Monarch IDE');
        const latencyMs = Math.round(performance.now() - startTs);

        if (res.success) {
          setExtensionStatus('connected');
          setHandshakeInfo({
            name: 'Clockie H2 Extension',
            version: res.negotiatedVersion || '1.1',
            sessionId: targetSid,
            provider: res.provider,
            rootName: res.rootName,
            launchedItemType: res.launchedItemType,
            primaryRelativePath: res.primaryRelativePath,
            capabilities: res.capabilities,
            connectedAt: new Date().toLocaleTimeString(),
            latencyMs,
          });
        } else {
          setExtensionStatus('disconnected');
        }
      } catch (err: any) {
        setExtensionStatus('disconnected');
        logMessageRef.current(
          'event',
          'H2_HANDSHAKE_FAILED',
          { sessionId: targetSid, error: err?.message || 'Handshake failed' },
          'error',
          undefined,
          targetSid
        );
      }
    },
    [sessionId, handleIncomingTree]
  );

  // Perform automatic handshake on boot if #h2Session=<sessionId> is present
  useEffect(() => {
    if (!hasBootedRef.current) {
      hasBootedRef.current = true;
      const bootSid = getH2SessionId();
      if (bootSid) {
        startBridge(bootSid);
      }
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, [startBridge]);

  // Type 4 / Type 5: Lazy file content read on open/demand
  const readCloudFile = useCallback(
    async (file: CloudFile, encodingOverride?: 'utf-8' | 'base64') => {
      const client = clientRef.current;
      if (!client) return;

      const inferredEncoding: 'utf-8' | 'base64' | undefined =
        encodingOverride || file.encoding || (file.isBinary ? 'base64' : 'utf-8');

      try {
        const res = await client.readFile(file.path, file.cloudFileId, inferredEncoding);
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

  // Type 6 / Type 7: Save existing file or create new file (including nested subdirectories)
  const saveCloudFile = useCallback(async (file: CloudFile) => {
    const client = clientRef.current;
    if (!client) {
      logMessageRef.current(
        'event',
        'H2_SYSTEM_EVENT',
        {
          message: `Skipped H2_SAVE_FILE_REQ for "${file.path}": no active H2 bridge session.`,
        },
        'error'
      );
      if (onFileSaveErrorRef.current) {
        onFileSaveErrorRef.current(file.id, 'Extension bridge is not connected');
      }
      return;
    }

    setIsSaving(true);
    try {
      const isBinary = Boolean(file.isBinary);
      let contentToSend = file.content || '';
      // If binaryUrl was captured as a data URI during local upload and content is empty, extract base64
      if (isBinary && !contentToSend && file.binaryUrl?.startsWith('data:')) {
        const commaIdx = file.binaryUrl.indexOf(',');
        if (commaIdx >= 0) {
          contentToSend = file.binaryUrl.slice(commaIdx + 1);
        }
      }

      const res = await client.saveFile({
        relativePath: file.path,
        fileId: file.cloudFileId,
        mimeType: file.mimeType || inferMimeType(file.name),
        contentType: isBinary ? 'binary' : 'text',
        encoding: isBinary ? 'base64' : 'utf-8',
        content: contentToSend,
      });

      if (onFileSaveConfirmedRef.current) {
        onFileSaveConfirmedRef.current(file.id, res);
      }
    } catch (err: any) {
      if (onFileSaveErrorRef.current) {
        onFileSaveErrorRef.current(file.id, err?.message || 'Save failed');
      }
    } finally {
      setIsSaving(false);
    }
  }, []);

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

  // Type 8 / Type 9: Delete file or folder
  const deleteCloudItem = useCallback(
    async ({
      itemType,
      relativePath,
      fileId,
      folderId,
      permanent = false,
    }: {
      itemType: 'file' | 'folder';
      relativePath: string;
      fileId?: string;
      folderId?: string;
      permanent?: boolean;
    }) => {
      const client = clientRef.current;
      if (!client) {
        if (onItemDeleteErrorRef.current) {
          onItemDeleteErrorRef.current(relativePath, 'Extension bridge is not connected');
        }
        return false;
      }

      try {
        const res = await client.deleteItem({
          itemType,
          relativePath,
          fileId,
          folderId,
          permanent,
        });

        if (onItemDeletedRef.current) {
          onItemDeletedRef.current(itemType, res.relativePath || relativePath, res);
        }
        return true;
      } catch (err: any) {
        if (onItemDeleteErrorRef.current) {
          onItemDeleteErrorRef.current(relativePath, err?.message || 'Delete failed');
        }
        return false;
      }
    },
    []
  );

  return {
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
    clearLogs: () => setMessagesLog([]),
  };
}
