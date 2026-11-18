/**
 * Clockie H2 + File Manager — External Web App Bridge Client (Protocol v1.2 / H2_CLOUD_BRIDGE).
 * Supports both Launched Mode (#h2Session=<id>) and Direct Mode (H2_CONNECT_REQ/RES),
 * lazy depth-limited trees (H2_WORKSPACE_TREE_REQ, H2_LIST_FOLDER_REQ/RES),
 * concurrent file reads (H2_READ_FILE_REQ/RES), saves, deletes, and clean disconnect.
 *
 * Official Documentation:
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - URL Hash & Search Parsing: https://developer.mozilla.org/en-US/docs/Web/API/Location
 */

import {
  CloudProvider,
  H2AccessMode,
  H2Capabilities,
  H2DriveStatus,
  H2SessionMode,
} from '../types/ide';

export const H2_PROTOCOL = 'H2_CLOUD_BRIDGE' as const;
export const H2_PROTOCOL_VERSION = '1.2' as const;

export interface H2BaseEnvelope {
  protocol: typeof H2_PROTOCOL;
  protocolVersion: typeof H2_PROTOCOL_VERSION;
  sessionId?: string;
  requestId: string;
  type: string;
}

export interface H2ConnectReq extends H2BaseEnvelope {
  type: 'H2_CONNECT_REQ';
  clientName: string;
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
  accessMode: H2AccessMode;
  drives?: Record<string, H2DriveStatus>;
  capabilities: H2Capabilities;
  error: string | null;
}

export interface H2HandshakeReq extends H2BaseEnvelope {
  type: 'H2_HANDSHAKE_REQ';
  sessionId: string;
  clientName: string;
  supportedVersions: string[];
}

export interface H2HandshakeRes extends H2BaseEnvelope {
  type: 'H2_HANDSHAKE_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  reasonCode?: string | null;
  negotiatedVersion: string;
  sessionMode?: H2SessionMode;
  accessMode?: H2AccessMode;
  provider: CloudProvider;
  rootName: string;
  launchedItemType: 'folder' | 'file';
  primaryRelativePath: string;
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

export interface H2WorkspaceTreeReq extends H2BaseEnvelope {
  type: 'H2_WORKSPACE_TREE_REQ';
  sessionId: string;
  provider?: CloudProvider;
  basePath?: string;
  baseFolderId?: string;
  maxDepth?: number;
}

export interface H2ListFolderReq extends H2BaseEnvelope {
  type: 'H2_LIST_FOLDER_REQ';
  sessionId: string;
  provider?: CloudProvider;
  basePath?: string;
  baseFolderId?: string;
  maxDepth?: number;
}

export interface H2WorkspaceTree extends H2BaseEnvelope {
  type: 'H2_WORKSPACE_TREE' | 'H2_LIST_FOLDER_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  basePath?: string;
  maxDepth?: number;
  rootName: string;
  rootFolderId?: string;
  launchedItemType?: 'folder' | 'file';
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

export interface H2WorkspaceTreeAck extends H2BaseEnvelope {
  type: 'H2_WORKSPACE_TREE_ACK';
  sessionId: string;
  received: boolean;
  fileCount: number;
  folderCount: number;
  error: string | null;
}

export interface H2ReadFileReq extends H2BaseEnvelope {
  type: 'H2_READ_FILE_REQ';
  sessionId: string;
  provider?: CloudProvider;
  relativePath: string;
  fileId?: string;
  encoding?: 'utf-8' | 'base64';
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

export interface H2SaveFileReq extends H2BaseEnvelope {
  type: 'H2_SAVE_FILE_REQ';
  sessionId: string;
  provider?: CloudProvider;
  relativePath: string;
  fileId?: string;
  mimeType?: string;
  contentType: 'text' | 'binary';
  encoding: 'utf-8' | 'base64';
  content: string;
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

export interface H2DeleteFileReq extends H2BaseEnvelope {
  type: 'H2_DELETE_FILE_REQ';
  sessionId: string;
  provider?: CloudProvider;
  itemType: 'file' | 'folder';
  relativePath: string;
  fileId?: string;
  folderId?: string;
  permanent: boolean;
}

export interface H2DeleteFileRes extends H2BaseEnvelope {
  type: 'H2_DELETE_FILE_RES';
  sessionId: string;
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  itemType: 'file' | 'folder';
  fileId?: string;
  folderId?: string;
  relativePath: string;
  trashed?: boolean;
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
  onOutgoing?: (type: string, envelope: H2BaseEnvelope & Record<string, any>) => void;
  onIncoming?: (type: string, envelope: any, roundtripMs?: number) => void;
  onTimeout?: (type: string, requestId: string, errorMessage: string) => void;
}

/**
 * Extracts h2Session=<sessionId> from window.location.hash or window.location.search.
 */
export function getH2SessionId(): string | null {
  if (typeof window === 'undefined') return null;
  const hashMatch = window.location.hash.match(/[#&]h2Session=([^&]+)/);
  if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);
  const qMatch = window.location.search.match(/[?&]h2Session=([^&]+)/);
  return qMatch?.[1] ? decodeURIComponent(qMatch[1]) : null;
}

/**
 * Spec-compliant H2 Bridge Client for Protocol v1.2 (H2_CLOUD_BRIDGE).
 */
export class H2BridgeClient {
  public sessionId: string | null;
  public sessionInfo: H2ConnectRes | H2HandshakeRes | null = null;
  private pending = new Map<
    string,
    {
      type: string;
      startedAt: number;
      resolve: (data: any) => void;
      reject: (err: Error) => void;
    }
  >();
  public onTree: ((treeMsg: H2WorkspaceTree) => void) | null = null;
  private hooks: H2BridgeLoggerHooks;
  private _onMsg: (event: MessageEvent) => void;

  constructor(sessionId: string | null = null, hooks: H2BridgeLoggerHooks = {}) {
    this.sessionId = sessionId;
    this.hooks = hooks;

    this._onMsg = (event: MessageEvent) => {
      // Strictly validate replies per Protocol v1.2 spec:
      // event.source === window, protocol === "H2_CLOUD_BRIDGE", __h2FromExtension === true
      if (event.source !== window) return;
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.protocol !== H2_PROTOCOL || d.__h2FromExtension !== true) return;

      const entry = this.pending.get(d.requestId);
      const roundtripMs = entry ? Math.round(performance.now() - entry.startedAt) : undefined;

      // Handle unsolicited or requested H2_WORKSPACE_TREE messages
      if (d.type === 'H2_WORKSPACE_TREE' && (!this.sessionId || d.sessionId === this.sessionId)) {
        this.hooks.onIncoming?.(d.type, d, roundtripMs);
        this._post(
          'H2_WORKSPACE_TREE_ACK',
          {
            received: true,
            fileCount: d.files?.length || 0,
            folderCount: d.folders?.length || 0,
            error: null,
          },
          d.requestId
        );
        if (typeof this.onTree === 'function') {
          this.onTree(d as H2WorkspaceTree);
        }
      }

      if (entry) {
        if (this.sessionId && d.sessionId && d.sessionId !== this.sessionId) return;
        this.pending.delete(d.requestId);
        if (d.type !== 'H2_WORKSPACE_TREE') {
          this.hooks.onIncoming?.(d.type, d, roundtripMs);
        }
        if (d.success) {
          if (d.sessionId) this.sessionId = d.sessionId;
          entry.resolve(d);
        } else {
          entry.reject(new H2BridgeError(d.error || `${d.type} failed`, d.reasonCode || null));
        }
      } else if (d.type !== 'H2_WORKSPACE_TREE') {
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

    // Omit sessionId on H2_CONNECT_REQ per v1.2 spec; include it on all session requests
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

  /** Type 0a/0b: Direct Mode connection when URL has no #h2Session parameter */
  public connectDirect(clientName = 'FreshFood Rocks - Monarch IDE'): Promise<H2ConnectRes> {
    return this.request<H2ConnectRes>(
      'H2_CONNECT_REQ',
      {
        clientName,
        supportedVersions: ['1.2', '1.1'],
      },
      15000
    );
  }

  /** Type 1a/1b: Launched Mode handshake when URL contains #h2Session=<sessionId> */
  public handshake(clientName = 'FreshFood Rocks - Monarch IDE'): Promise<H2HandshakeRes> {
    return this.request<H2HandshakeRes>(
      'H2_HANDSHAKE_REQ',
      {
        clientName,
        supportedVersions: ['1.2', '1.1'],
      },
      15000
    );
  }

  /** Type 2a/2: Request workspace tree (optionally depth-limited or filtered by provider/basePath) */
  public requestTree({
    provider,
    basePath,
    baseFolderId,
    maxDepth,
  }: {
    provider?: CloudProvider;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  } = {}): Promise<H2WorkspaceTree> {
    const payload: Record<string, any> = {};
    if (provider !== undefined) payload.provider = provider;
    if (basePath !== undefined) payload.basePath = basePath;
    if (baseFolderId !== undefined && baseFolderId !== '') payload.baseFolderId = baseFolderId;
    if (maxDepth !== undefined) payload.maxDepth = maxDepth;
    return this.request<H2WorkspaceTree>('H2_WORKSPACE_TREE_REQ', payload);
  }

  /** Type 2b/2c: Single-folder / depth-limited shorthand listing */
  public listFolder({
    provider,
    basePath,
    baseFolderId,
    maxDepth = 1,
  }: {
    provider?: CloudProvider;
    basePath?: string;
    baseFolderId?: string;
    maxDepth?: number;
  } = {}): Promise<H2WorkspaceTree> {
    const payload: Record<string, any> = { maxDepth };
    if (provider !== undefined) payload.provider = provider;
    if (basePath !== undefined) payload.basePath = basePath;
    if (baseFolderId !== undefined && baseFolderId !== '') payload.baseFolderId = baseFolderId;
    return this.request<H2WorkspaceTree>('H2_LIST_FOLDER_REQ', payload);
  }

  /** Type 4/5: Lazily read individual file content */
  public readFile(
    relativePath: string,
    fileId?: string,
    encoding?: 'utf-8' | 'base64',
    provider?: CloudProvider
  ): Promise<H2ReadFileRes> {
    const payload: Record<string, any> = { relativePath };
    if (provider && provider !== 'all') payload.provider = provider;
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    if (encoding) payload.encoding = encoding;
    return this.request<H2ReadFileRes>('H2_READ_FILE_REQ', payload);
  }

  /** Type 4/5 Concurrent Batch: Fetch multiple files simultaneously via Promise.all */
  public readFiles(
    items: Array<{
      relativePath: string;
      fileId?: string;
      encoding?: 'utf-8' | 'base64';
      provider?: CloudProvider;
    }>
  ): Promise<H2ReadFileRes[]> {
    return Promise.all(
      items.map(it => this.readFile(it.relativePath, it.fileId, it.encoding, it.provider))
    );
  }

  /** Type 6/7: Save file edits or create new files/subdirectories */
  public saveFile({
    provider,
    relativePath,
    fileId,
    mimeType,
    contentType = 'text',
    encoding = 'utf-8',
    content,
  }: {
    provider?: CloudProvider;
    relativePath: string;
    fileId?: string;
    mimeType?: string;
    contentType?: 'text' | 'binary';
    encoding?: 'utf-8' | 'base64';
    content: string;
  }): Promise<H2SaveFileRes> {
    const payload: Record<string, any> = {
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

  /** Type 8/9: Delete or trash files and folders */
  public deleteItem({
    provider,
    itemType = 'file',
    relativePath,
    fileId,
    folderId,
    permanent = false,
  }: {
    provider?: CloudProvider;
    itemType?: 'file' | 'folder';
    relativePath: string;
    fileId?: string;
    folderId?: string;
    permanent?: boolean;
  }): Promise<H2DeleteFileRes> {
    const payload: Record<string, any> = {
      itemType,
      relativePath,
      permanent,
    };
    if (provider && provider !== 'all') payload.provider = provider;
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    if (folderId !== undefined && folderId !== '') payload.folderId = folderId;
    return this.request<H2DeleteFileRes>('H2_DELETE_FILE_REQ', payload);
  }

  /** Type 10a/10b: Gracefully terminate the active bridge session */
  public async disconnect(): Promise<void> {
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
