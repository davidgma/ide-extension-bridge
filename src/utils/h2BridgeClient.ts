/**
 * Clockie H2 + File Manager — External Web App Bridge Client (Protocol v1.4 / H2_CLOUD_BRIDGE).
 * Uses zero-URL session binding (per-tab window.sessionStorage), unified H2_CONNECT_REQ/RES,
 * launchedScope + driveRoot switching, lazy folder trees, concurrent reads, dedicated folder ops,
 * same-drive native moves, and clean disconnect.
 *
 * Official Documentation:
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 */

import {
  CloudProvider,
  H2AccessMode,
  H2Capabilities,
  H2DriveStatus,
  H2LaunchedScope,
  H2SessionMode,
} from '../types/ide';

export const H2_PROTOCOL = 'H2_CLOUD_BRIDGE' as const;
export const H2_PROTOCOL_VERSION = '1.4' as const;
export const H2_SESSION_STORAGE_KEY = 'h2_bridge_session_id' as const;

export interface H2BaseEnvelope {
  protocol: typeof H2_PROTOCOL;
  protocolVersion: typeof H2_PROTOCOL_VERSION;
  sessionId?: string;
  requestId: string;
  type: string;
}

export interface H2BridgeReadyMsg {
  protocol: typeof H2_PROTOCOL;
  protocolVersion: string;
  type: 'H2_BRIDGE_READY';
  source?: string;
  __h2FromExtension: true;
}

export interface H2ConnectReq extends H2BaseEnvelope {
  type: 'H2_CONNECT_REQ';
  clientName: string;
  previousSessionId?: string;
  supportedVersions: string[];
}

export interface H2ConnectRes extends H2BaseEnvelope {
  type: 'H2_CONNECT_RES';
  sessionId: string | undefined;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  reasonCode: string | null;
  negotiatedVersion: string;
  sessionMode: H2SessionMode;
  provider: CloudProvider;
  rootName: string;
  launchedItemType?: 'folder' | 'file' | 'workspace';
  primaryRelativePath?: string;
  launchedScope?: H2LaunchedScope | null;
  accessMode: H2AccessMode;
  drives?: Record<string, H2DriveStatus>;
  capabilities: H2Capabilities;
  error: string | null;
}

export interface H2FolderMetadata {
  itemType: 'folder';
  provider?: CloudProvider;
  name: string;
  relativePath: string;
  parentRelativePath: string;
  folderId?: string;
  parentFolderId?: string;
  childrenLoaded?: boolean;
  modifiedMs?: number;
}

export interface H2FileMetadata {
  itemType: 'file';
  provider?: CloudProvider;
  name: string;
  relativePath: string;
  parentRelativePath: string;
  fileId?: string;
  parentFolderId?: string;
  mimeType?: string;
  contentType?: 'text' | 'binary';
  encoding?: 'utf-8' | 'base64';
  sizeBytes?: number;
  modifiedMs?: number;
}

export interface H2WorkspaceTree extends H2BaseEnvelope {
  type: 'H2_WORKSPACE_TREE' | 'H2_LIST_FOLDER_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  driveRoot?: boolean;
  basePath?: string;
  maxDepth?: number;
  rootName: string;
  rootFolderId?: string;
  launchedItemType?: 'folder' | 'file' | 'workspace';
  primaryRelativePath?: string;
  stats?: {
    totalFolders: number;
    totalFiles: number;
    totalBytes: number;
  };
  folders?: H2FolderMetadata[];
  files?: H2FileMetadata[];
  tree?: any;
  drives?: Record<string, any>;
  error: string | null;
}

export interface H2ReadFileRes extends H2BaseEnvelope {
  type: 'H2_READ_FILE_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  fileId?: string;
  parentFolderId?: string;
  filename: string;
  relativePath: string;
  mimeType?: string;
  contentType: 'text' | 'binary';
  encoding: 'utf-8' | 'base64';
  content: string;
  sizeBytes?: number;
  modifiedMs?: number;
  error: string | null;
}

export interface H2SaveFileRes extends H2BaseEnvelope {
  type: 'H2_SAVE_FILE_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  created?: boolean;
  provider: CloudProvider;
  fileId?: string;
  parentFolderId?: string;
  filename: string;
  relativePath: string;
  sizeBytes?: number;
  modifiedMs?: number;
  error: string | null;
}

export interface H2DeleteFileRes extends H2BaseEnvelope {
  type: 'H2_DELETE_FILE_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  itemType?: 'file' | 'folder';
  fileId?: string;
  folderId?: string;
  relativePath: string;
  trashed?: boolean;
  error: string | null;
}

export interface H2CreateFolderRes extends H2BaseEnvelope {
  type: 'H2_CREATE_FOLDER_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  created?: boolean;
  provider: CloudProvider;
  folderId?: string;
  folderName?: string;
  relativePath: string;
  parentRelativePath?: string;
  error: string | null;
}

export interface H2DeleteFolderRes extends H2BaseEnvelope {
  type: 'H2_DELETE_FOLDER_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  itemType?: 'folder';
  folderId?: string;
  relativePath: string;
  trashed?: boolean;
  error: string | null;
}

export interface H2MoveFileRes extends H2BaseEnvelope {
  type: 'H2_MOVE_FILE_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  fileId?: string;
  parentFolderId?: string;
  filename?: string;
  relativePath?: string;
  previousRelativePath?: string;
  targetRelativePath?: string;
  sizeBytes?: number;
  modifiedMs?: number;
  error: string | null;
}

export interface H2MoveFolderRes extends H2BaseEnvelope {
  type: 'H2_MOVE_FOLDER_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  folderId?: string;
  parentFolderId?: string;
  folderName?: string;
  relativePath?: string;
  previousRelativePath?: string;
  targetRelativePath?: string;
  modifiedMs?: number;
  error: string | null;
}

export interface H2DisconnectRes extends H2BaseEnvelope {
  type: 'H2_DISCONNECT_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  error: string | null;
}

export class H2BridgeError extends Error {
  public reasonCode: string | null;
  constructor(message: string, reasonCode: string | null = null) {
    super(message);
    this.name = 'H2BridgeError';
    this.reasonCode = reasonCode;
  }
}

export interface H2BridgeLoggerHooks {
  onReady?: (msg: H2BridgeReadyMsg) => void;
  onOutgoing?: (type: string, envelope: H2BaseEnvelope & Record<string, any>) => void;
  onIncoming?: (type: string, envelope: any, roundtripMs?: number) => void;
  onTimeout?: (type: string, requestId: string, errorMessage: string) => void;
}

/**
 * Spec-compliant H2 Bridge Client for Protocol v1.4 (H2_CLOUD_BRIDGE).
 * Strictly binds session state to per-tab window.sessionStorage (never URL or localStorage).
 */
export class H2BridgeClient {
  public readonly storageKey: string;
  public sessionId: string | null = null;
  public sessionInfo: H2ConnectRes | null = null;
  private pending = new Map<
    string,
    {
      type: string;
      startedAt: number;
      resolve: (data: any) => void;
      reject: (err: Error) => void;
    }
  >();
  private hooks: H2BridgeLoggerHooks;
  private _onMsg: (event: MessageEvent) => void;

  constructor(hooks: H2BridgeLoggerHooks = {}, storageKey = H2_SESSION_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.hooks = hooks;

    this._onMsg = (event: MessageEvent) => {
      if (event.source !== window) return;
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.protocol !== H2_PROTOCOL || d.__h2FromExtension !== true) return;

      if (d.type === 'H2_BRIDGE_READY') {
        this.hooks.onIncoming?.('H2_BRIDGE_READY', d);
        this.hooks.onReady?.(d as H2BridgeReadyMsg);
        return;
      }

      const entry = this.pending.get(d.requestId);
      const roundtripMs = entry ? Math.round(performance.now() - entry.startedAt) : undefined;

      if (entry) {
        if (this.sessionId && d.sessionId && d.sessionId !== this.sessionId) return;
        this.pending.delete(d.requestId);
        this.hooks.onIncoming?.(d.type, d, roundtripMs);

        if (d.success) {
          if (d.sessionId) {
            this.sessionId = d.sessionId;
            try {
              window.sessionStorage.setItem(this.storageKey, d.sessionId);
            } catch {
              // Ignore storage quota / sandboxed errors
            }
          }
          entry.resolve(d);
        } else {
          entry.reject(new H2BridgeError(d.error || `${d.type} failed`, d.reasonCode || null));
        }
      } else {
        if (this.sessionId && d.sessionId && d.sessionId !== this.sessionId) return;
        this.hooks.onIncoming?.(d.type || 'H2_UNKNOWN', d);
      }
    };

    window.addEventListener('message', this._onMsg);
  }

  public _post(type: string, payload: Record<string, any> = {}, explicitReqId?: string): string {
    const requestId =
      explicitReqId || `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const envelope: H2BaseEnvelope & Record<string, any> = {
      protocol: H2_PROTOCOL,
      protocolVersion: H2_PROTOCOL_VERSION,
      requestId,
      type,
      ...payload,
    };

    // Omit sessionId on H2_CONNECT_REQ per v1.3 spec; include on all subsequent requests
    if (this.sessionId && type !== 'H2_CONNECT_REQ') {
      envelope.sessionId = this.sessionId;
    }

    this.hooks.onOutgoing?.(type, envelope);

    const targetOrigin =
      typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : '*';

    window.postMessage(envelope, targetOrigin);
    return requestId;
  }

  public request<T = any>(
    type: string,
    payload: Record<string, any> = {},
    timeoutMs = 60000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const requestId = this._post(type, payload);

      const timer = window.setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          const errorMessage = `${type} timed out after ${timeoutMs}ms`;
          this.hooks.onTimeout?.(type, requestId, errorMessage);
          reject(new H2BridgeError(errorMessage, 'TIMEOUT'));
        }
      }, timeoutMs);

      this.pending.set(requestId, {
        type,
        startedAt,
        resolve: (d: T) => {
          window.clearTimeout(timer);
          resolve(d);
        },
        reject: (e: Error) => {
          window.clearTimeout(timer);
          reject(e);
        },
      });
    });
  }

  /** Type 1a/1b: Unified connection request (replaces launched handshake + direct connect) */
  public async connect(clientName = 'FreshFood Rocks - Monarch IDE'): Promise<H2ConnectRes> {
    let previousSessionId: string | null = null;
    try {
      previousSessionId = window.sessionStorage.getItem(this.storageKey);
      window.sessionStorage.removeItem(this.storageKey);
    } catch {
      previousSessionId = null;
    }

    const res = await this.request<H2ConnectRes>(
      'H2_CONNECT_REQ',
      {
        clientName,
        previousSessionId: previousSessionId || undefined,
        supportedVersions: [H2_PROTOCOL_VERSION],
      },
      15000
    );
    this.sessionInfo = res;
    return res;
  }

  /** Type 2a: Request workspace tree (depth-limited, optional driveRoot / provider switch) */
  public requestTree({
    provider,
    driveRoot = false,
    basePath,
    baseFolderId,
    maxDepth,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  } = {}): Promise<H2WorkspaceTree> {
    const payload: Record<string, any> = { driveRoot };
    if (provider !== undefined) payload.provider = provider;
    if (basePath !== undefined) payload.basePath = basePath;
    if (baseFolderId !== undefined && baseFolderId !== '') payload.baseFolderId = baseFolderId;
    if (maxDepth !== undefined) payload.maxDepth = maxDepth;
    return this.request<H2WorkspaceTree>('H2_WORKSPACE_TREE_REQ', payload);
  }

  /** Helper: Switch out of a launched scope to the root of a connected drive */
  public switchDriveRoot(provider: CloudProvider, maxDepth = 2): Promise<H2WorkspaceTree> {
    return this.requestTree({ provider, driveRoot: true, maxDepth });
  }

  /** Type 2b/2c: Single-folder / depth-limited shorthand listing */
  public listFolder({
    provider,
    driveRoot = false,
    basePath,
    baseFolderId,
    maxDepth = 1,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  } = {}): Promise<H2WorkspaceTree> {
    const payload: Record<string, any> = { driveRoot, maxDepth };
    if (provider !== undefined) payload.provider = provider;
    if (basePath !== undefined) payload.basePath = basePath;
    if (baseFolderId !== undefined && baseFolderId !== '') payload.baseFolderId = baseFolderId;
    return this.request<H2WorkspaceTree>('H2_LIST_FOLDER_REQ', payload);
  }

  /** Type 3/4: Lazily read individual file content */
  public readFile(
    relativePath: string,
    fileId?: string,
    encoding?: 'utf-8' | 'base64',
    provider?: CloudProvider,
    driveRoot = false
  ): Promise<H2ReadFileRes> {
    const payload: Record<string, any> = { relativePath, driveRoot };
    if (provider && provider !== 'all') payload.provider = provider;
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    if (encoding) payload.encoding = encoding;
    return this.request<H2ReadFileRes>('H2_READ_FILE_REQ', payload);
  }

  /** Type 3/4 Concurrent Batch: Fetch multiple files simultaneously via Promise.all */
  public readFiles(
    items: Array<{
      relativePath: string;
      fileId?: string;
      encoding?: 'utf-8' | 'base64';
      provider?: CloudProvider;
      driveRoot?: boolean;
    }>
  ): Promise<H2ReadFileRes[]> {
    return Promise.all(
      items.map(it =>
        this.readFile(it.relativePath, it.fileId, it.encoding, it.provider, Boolean(it.driveRoot))
      )
    );
  }

  /** Type 5/6: Save file edits or create new files/subdirectories */
  public saveFile({
    provider,
    driveRoot = false,
    relativePath,
    fileId,
    mimeType,
    contentType = 'text',
    encoding = 'utf-8',
    content,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    mimeType?: string;
    contentType?: 'text' | 'binary';
    encoding?: 'utf-8' | 'base64';
    content: string;
  }): Promise<H2SaveFileRes> {
    const payload: Record<string, any> = {
      driveRoot,
      relativePath,
      mimeType,
      contentType,
      encoding,
      content,
    };
    if (provider && provider !== 'all') payload.provider = provider;
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    return this.request<H2SaveFileRes>('H2_SAVE_FILE_REQ', payload);
  }

  /** Type 7/8: Delete or trash a file */
  public deleteFile({
    provider,
    driveRoot = false,
    relativePath,
    fileId,
    permanent = false,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    permanent?: boolean;
  }): Promise<H2DeleteFileRes> {
    const payload: Record<string, any> = {
      driveRoot,
      relativePath,
      permanent,
    };
    if (provider && provider !== 'all') payload.provider = provider;
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    return this.request<H2DeleteFileRes>('H2_DELETE_FILE_REQ', payload);
  }

  /** Type 9/10: Create nested folder(s) in the cloud */
  public createFolder({
    provider,
    driveRoot = false,
    relativePath,
    parentRelativePath,
    parentFolderId,
    folderName,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    relativePath?: string;
    parentRelativePath?: string;
    parentFolderId?: string;
    folderName?: string;
  }): Promise<H2CreateFolderRes> {
    const payload: Record<string, any> = { driveRoot };
    if (provider && provider !== 'all') payload.provider = provider;
    if (relativePath !== undefined && relativePath !== '') payload.relativePath = relativePath;
    if (parentRelativePath !== undefined) payload.parentRelativePath = parentRelativePath;
    if (parentFolderId !== undefined && parentFolderId !== '') payload.parentFolderId = parentFolderId;
    if (folderName !== undefined && folderName !== '') payload.folderName = folderName;
    return this.request<H2CreateFolderRes>('H2_CREATE_FOLDER_REQ', payload);
  }

  /** Type 11/12: Recursively delete or trash a folder */
  public deleteFolder({
    provider,
    driveRoot = false,
    relativePath,
    folderId,
    permanent = false,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    relativePath: string;
    folderId?: string;
    permanent?: boolean;
  }): Promise<H2DeleteFolderRes> {
    const payload: Record<string, any> = {
      driveRoot,
      relativePath,
      permanent,
    };
    if (provider && provider !== 'all') payload.provider = provider;
    if (folderId !== undefined && folderId !== '') payload.folderId = folderId;
    return this.request<H2DeleteFolderRes>('H2_DELETE_FOLDER_REQ', payload);
  }

  /** Helper: Route deletion to H2_DELETE_FOLDER_REQ or H2_DELETE_FILE_REQ */
  public deleteItem({
    provider,
    driveRoot = false,
    itemType = 'file',
    relativePath,
    fileId,
    folderId,
    permanent = false,
  }: {
    provider?: CloudProvider;
    driveRoot?: boolean;
    itemType?: 'file' | 'folder';
    relativePath: string;
    fileId?: string;
    folderId?: string;
    permanent?: boolean;
  }): Promise<H2DeleteFileRes | H2DeleteFolderRes> {
    if (itemType === 'folder') {
      return this.deleteFolder({ provider, driveRoot, relativePath, folderId, permanent });
    }
    return this.deleteFile({ provider, driveRoot, relativePath, fileId, permanent });
  }

  /** Type 13/14: Same-drive native file move or rename */
  public moveFile({
    provider,
    targetProvider,
    driveRoot = false,
    relativePath,
    fileId,
    targetRelativePath,
    targetParentPath,
    newName,
    overwrite = false,
  }: {
    provider?: CloudProvider;
    targetProvider?: CloudProvider;
    driveRoot?: boolean;
    relativePath: string;
    fileId?: string;
    targetRelativePath?: string;
    targetParentPath?: string;
    newName?: string;
    overwrite?: boolean;
  }): Promise<H2MoveFileRes> {
    const payload: Record<string, any> = {
      driveRoot,
      relativePath,
      overwrite,
    };
    if (provider && provider !== 'all') payload.provider = provider;
    if (targetProvider && targetProvider !== 'all') payload.targetProvider = targetProvider;
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    if (targetRelativePath !== undefined) payload.targetRelativePath = targetRelativePath;
    if (targetParentPath !== undefined) payload.targetParentPath = targetParentPath;
    if (newName !== undefined && newName !== '') payload.newName = newName;
    return this.request<H2MoveFileRes>('H2_MOVE_FILE_REQ', payload);
  }

  /** Type 15/16: Same-drive native folder move or rename */
  public moveFolder({
    provider,
    targetProvider,
    driveRoot = false,
    relativePath,
    folderId,
    targetRelativePath,
    targetParentPath,
    newName,
    overwrite = false,
  }: {
    provider?: CloudProvider;
    targetProvider?: CloudProvider;
    driveRoot?: boolean;
    relativePath: string;
    folderId?: string;
    targetRelativePath?: string;
    targetParentPath?: string;
    newName?: string;
    overwrite?: boolean;
  }): Promise<H2MoveFolderRes> {
    const payload: Record<string, any> = {
      driveRoot,
      relativePath,
      overwrite,
    };
    if (provider && provider !== 'all') payload.provider = provider;
    if (targetProvider && targetProvider !== 'all') payload.targetProvider = targetProvider;
    if (folderId !== undefined && folderId !== '') payload.folderId = folderId;
    if (targetRelativePath !== undefined) payload.targetRelativePath = targetRelativePath;
    if (targetParentPath !== undefined) payload.targetParentPath = targetParentPath;
    if (newName !== undefined && newName !== '') payload.newName = newName;
    return this.request<H2MoveFolderRes>('H2_MOVE_FOLDER_REQ', payload);
  }

  /** Type 17a/17b: Gracefully terminate the active bridge session & clear sessionStorage */
  public async disconnect(): Promise<void> {
    try {
      window.sessionStorage.removeItem(this.storageKey);
    } catch {
      // Ignore storage errors
    }
    if (this.sessionId) {
      await this.request<H2DisconnectRes>('H2_DISCONNECT_REQ', {}, 5000).catch(() => {});
      this.sessionId = null;
    }
    this.destroy();
  }

  public destroy(): void {
    this.pending.forEach(entry => {
      entry.reject(new H2BridgeError('H2BridgeClient destroyed', 'DESTROYED'));
    });
    this.pending.clear();
    window.removeEventListener('message', this._onMsg);
  }
}
