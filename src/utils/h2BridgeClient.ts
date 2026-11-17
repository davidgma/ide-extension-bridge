/**
 * Clockie H2 + File Manager — External Web App Bridge Client (Protocol v1.1 / H2_CLOUD_BRIDGE).
 *
 * Official Documentation:
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - URL Hash & Search Parsing: https://developer.mozilla.org/en-US/docs/Web/API/Location
 */

import { CloudProvider, H2Capabilities } from '../types/ide';

export const H2_PROTOCOL = 'H2_CLOUD_BRIDGE' as const;
export const H2_PROTOCOL_VERSION = '1.1' as const;

export interface H2BaseEnvelope {
  protocol: typeof H2_PROTOCOL;
  protocolVersion: typeof H2_PROTOCOL_VERSION;
  sessionId: string;
  requestId: string;
  type: string;
}

export interface H2HandshakeReq extends H2BaseEnvelope {
  type: 'H2_HANDSHAKE_REQ';
  clientName: string;
  supportedVersions: string[];
}

export interface H2HandshakeRes extends H2BaseEnvelope {
  type: 'H2_HANDSHAKE_RES';
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  negotiatedVersion: string;
  provider: CloudProvider;
  rootName: string;
  launchedItemType: 'folder' | 'file';
  primaryRelativePath: string;
  capabilities: H2Capabilities;
  error: string | null;
}

export interface H2FolderMetadata {
  itemType: 'folder';
  name: string;
  relativePath: string;
  parentRelativePath: string;
  folderId?: string;
  parentFolderId?: string;
  modifiedMs?: number;
}

export interface H2FileMetadata {
  itemType: 'file';
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
  type: 'H2_WORKSPACE_TREE';
  __h2FromExtension: true;
  source?: string;
  success: boolean;
  provider: CloudProvider;
  rootName: string;
  rootFolderId?: string;
  launchedItemType: 'folder' | 'file';
  primaryRelativePath: string;
  stats?: {
    totalFolders: number;
    totalFiles: number;
    totalBytes: number;
  };
  folders?: H2FolderMetadata[];
  files?: H2FileMetadata[];
  tree?: any;
  error: string | null;
}

export interface H2WorkspaceTreeAck extends H2BaseEnvelope {
  type: 'H2_WORKSPACE_TREE_ACK';
  received: boolean;
  fileCount: number;
  folderCount: number;
  error: string | null;
}

export interface H2ReadFileReq extends H2BaseEnvelope {
  type: 'H2_READ_FILE_REQ';
  relativePath: string;
  fileId?: string;
  encoding?: 'utf-8' | 'base64';
}

export interface H2ReadFileRes extends H2BaseEnvelope {
  type: 'H2_READ_FILE_RES';
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
  relativePath: string;
  fileId?: string;
  mimeType?: string;
  contentType: 'text' | 'binary';
  encoding: 'utf-8' | 'base64';
  content: string;
}

export interface H2SaveFileRes extends H2BaseEnvelope {
  type: 'H2_SAVE_FILE_RES';
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
  itemType: 'file' | 'folder';
  relativePath: string;
  fileId?: string;
  folderId?: string;
  permanent: boolean;
}

export interface H2DeleteFileRes extends H2BaseEnvelope {
  type: 'H2_DELETE_FILE_RES';
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
 * Spec-compliant H2 Bridge Client for Protocol v1.1 (H2_CLOUD_BRIDGE).
 * Handles request/response correlation over window.postMessage and automatic tree ACK.
 */
export class H2BridgeClient {
  public readonly sessionId: string;
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

  constructor(sessionId: string, hooks: H2BridgeLoggerHooks = {}) {
    this.sessionId = sessionId;
    this.hooks = hooks;

    this._onMsg = (event: MessageEvent) => {
      // Strictly validate replies per Protocol v1.1 spec:
      // event.source === window, protocol === "H2_CLOUD_BRIDGE", __h2FromExtension === true, sessionId match
      if (event.source !== window) return;
      const d = event.data;
      if (!d || typeof d !== 'object') return;
      if (d.protocol !== H2_PROTOCOL || d.__h2FromExtension !== true) return;
      if (d.sessionId !== this.sessionId) return;

      if (d.type === 'H2_WORKSPACE_TREE') {
        this.hooks.onIncoming?.(d.type, d);
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
        return;
      }

      const entry = this.pending.get(d.requestId);
      if (entry) {
        this.pending.delete(d.requestId);
        const roundtripMs = Math.round(performance.now() - entry.startedAt);
        this.hooks.onIncoming?.(d.type, d, roundtripMs);
        if (d.success) {
          entry.resolve(d);
        } else {
          entry.reject(new Error(d.error || `${d.type} failed`));
        }
      } else {
        // Log unsolicited extension bridge messages matching this session
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
      sessionId: this.sessionId,
      requestId,
      type,
      ...payload,
    };

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
          reject(new Error(errorMessage));
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

  public handshake(clientName = 'FreshFood Rocks - Monarch IDE'): Promise<H2HandshakeRes> {
    return this.request<H2HandshakeRes>(
      'H2_HANDSHAKE_REQ',
      {
        clientName,
        supportedVersions: [H2_PROTOCOL_VERSION],
      },
      15000
    );
  }

  public readFile(
    relativePath: string,
    fileId?: string,
    encoding?: 'utf-8' | 'base64'
  ): Promise<H2ReadFileRes> {
    const payload: Record<string, any> = { relativePath };
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    if (encoding) payload.encoding = encoding;
    return this.request<H2ReadFileRes>('H2_READ_FILE_REQ', payload);
  }

  public saveFile({
    relativePath,
    fileId,
    mimeType,
    contentType = 'text',
    encoding = 'utf-8',
    content,
  }: {
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
    if (fileId !== undefined && fileId !== '') {
      payload.fileId = fileId;
    }
    return this.request<H2SaveFileRes>('H2_SAVE_FILE_REQ', payload);
  }

  public deleteItem({
    itemType = 'file',
    relativePath,
    fileId,
    folderId,
    permanent = false,
  }: {
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
    if (fileId !== undefined && fileId !== '') payload.fileId = fileId;
    if (folderId !== undefined && folderId !== '') payload.folderId = folderId;
    return this.request<H2DeleteFileRes>('H2_DELETE_FILE_REQ', payload);
  }

  public destroy(): void {
    this.pending.forEach(entry => {
      entry.reject(new Error('H2BridgeClient destroyed'));
    });
    this.pending.clear();
    window.removeEventListener('message', this._onMsg);
  }
}
