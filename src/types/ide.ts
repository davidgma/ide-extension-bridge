export type CloudProvider = 'pCloud' | 'Google Drive' | 'Dropbox' | 'OneDrive' | 'Box' | 'Local Workspace';

export type ExtensionStatus = 'connected' | 'disconnected' | 'connecting';

export interface CloudFile {
  id: string;
  name: string;
  path: string; // e.g. "src/index.ts"
  content: string;
  isDirectory?: boolean;
  parentId?: string;
  cloudProvider: CloudProvider;
  mimeType?: string;
  size?: number;
  lastModified?: string;
  isDirty?: boolean;
  isBinary?: boolean;
  binaryUrl?: string;
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
  file?: CloudFile;
}

export interface OpenTab {
  fileId: string;
  path: string;
  title: string;
  isDirty?: boolean;
  previewMode?: 'code' | 'preview' | 'split';
}

export interface ExtensionHandshakeInfo {
  name: string;
  version: string;
  extensionId?: string;
  connectedAt?: string;
  provider: CloudProvider;
  latencyMs?: number;
}

export interface BridgeMessage {
  id: string;
  direction: 'incoming' | 'outgoing' | 'event';
  type: string;
  channel?: 'postMessage' | 'BroadcastChannel' | 'CustomEvent' | 'localStorage' | 'system';
  payload: any;
  response?: any;
  status?: 'sent' | 'received' | 'acknowledged' | 'error' | 'timeout';
  roundtripMs?: number;
  timestamp: number;
  formattedTime: string;
}

export type EditorTheme = 'freshfood-dark' | 'freshfood-cyber' | 'freshfood-light' | 'vs-dark' | 'vs' | 'hc-black';
