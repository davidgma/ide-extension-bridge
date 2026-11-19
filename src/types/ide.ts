/**
 * Core TypeScript definitions for Monarch IDE & Clockie H2 Bridge Protocol v1.3 (H2_CLOUD_BRIDGE).
 * Zero-URL session binding via per-tab sessionStorage and unified H2_CONNECT_REQ/RES startup.
 *
 * Official Documentation:
 * - TypeScript Handbook: https://www.typescriptlang.org/docs/
 * - Window.postMessage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 */

export type CloudProvider = string;

export type ExtensionStatus = 'connected' | 'disconnected' | 'connecting';

export type H2AccessMode = 'readwrite' | 'readonly';

export type H2SessionMode = 'launched' | 'direct';

export interface H2DriveStatus {
  connected: boolean;
  visible: boolean;
}

export interface H2LaunchedScope {
  provider: CloudProvider;
  rootName: string;
  rootFolderId?: string;
  rootPath?: string;
  launchedItemType: 'file' | 'folder' | 'workspace';
  primaryRelativePath?: string;
}

export interface H2Capabilities {
  lazyTree?: boolean;
  lazyRead?: boolean;
  listFolder?: boolean;
  workspaceTreeDepth?: boolean;
  multiDrive?: boolean;
  driveRootSwitch?: boolean;
  save?: boolean;
  createFiles?: boolean;
  createFolders?: boolean;
  deleteFiles?: boolean;
  deleteFolders?: boolean;
  trashByDefault?: boolean;
}

export interface CloudFile {
  /** Stable client-side key for React rendering and open tabs */
  id: string;
  /** Remote cloud file ID from H2_WORKSPACE_TREE / H2_SAVE_FILE_RES (undefined for newly created unsaved files) */
  cloudFileId?: string;
  /** Remote cloud folder ID when item is a directory */
  folderId?: string;
  /** Remote parent folder ID */
  parentId?: string;
  /** Parent folder relative path (e.g. "src" or "") */
  parentRelativePath?: string;
  /** File or folder name (e.g. "index.ts") */
  name: string;
  /** Relative path within workspace/drive root (e.g. "src/index.ts") */
  path: string;
  /** Text content or base64 content */
  content: string;
  /** True when H2_WORKSPACE_TREE metadata has been hydrated with file content via H2_READ_FILE_RES */
  contentLoaded?: boolean;
  /** True while an H2_READ_FILE_REQ is currently in flight */
  isLoadingContent?: boolean;
  /** Error message if lazy content loading failed */
  loadError?: string;
  isDirectory?: boolean;
  /** For directories in depth-limited trees: false means deeper children have not been fetched yet */
  childrenLoaded?: boolean;
  /** True while an H2_LIST_FOLDER_REQ for this folder is in flight */
  isLoadingChildren?: boolean;
  /** Whether this item belongs to a full driveRoot browse (outside launchedScope) */
  driveRoot?: boolean;
  cloudProvider: CloudProvider;
  mimeType?: string;
  contentType?: 'text' | 'binary';
  encoding?: 'utf-8' | 'base64';
  size?: number;
  modifiedMs?: number;
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
  sessionId: string;
  sessionMode?: H2SessionMode;
  accessMode?: H2AccessMode;
  provider: CloudProvider;
  rootName?: string;
  rootFolderId?: string;
  launchedItemType?: 'folder' | 'file' | 'workspace';
  primaryRelativePath?: string;
  launchedScope?: H2LaunchedScope | null;
  driveRootActive?: boolean;
  drives?: Record<string, H2DriveStatus>;
  capabilities?: H2Capabilities;
  stats?: {
    totalFolders: number;
    totalFiles: number;
    totalBytes: number;
  };
  connectedAt?: string;
  latencyMs?: number;
}

export interface DispatchTargetInfo {
  url: string;
  origin: string;
  host: string;
  protocol: string;
  port: string;
  postMessageTarget: string;
  sessionId: string | null;
}

export type H2MessageType =
  | 'H2_BRIDGE_READY'
  | 'H2_CONNECT_REQ'
  | 'H2_CONNECT_RES'
  | 'H2_WORKSPACE_TREE_REQ'
  | 'H2_WORKSPACE_TREE'
  | 'H2_LIST_FOLDER_REQ'
  | 'H2_LIST_FOLDER_RES'
  | 'H2_READ_FILE_REQ'
  | 'H2_READ_FILE_RES'
  | 'H2_SAVE_FILE_REQ'
  | 'H2_SAVE_FILE_RES'
  | 'H2_DELETE_FILE_REQ'
  | 'H2_DELETE_FILE_RES'
  | 'H2_DISCONNECT_REQ'
  | 'H2_DISCONNECT_RES'
  | 'H2_SYSTEM_EVENT';

export interface BridgeMessage {
  id: string;
  direction: 'incoming' | 'outgoing' | 'event';
  type: H2MessageType | string;
  requestId?: string;
  sessionId?: string | null;
  channel?: 'postMessage' | 'system';
  payload: any;
  response?: any;
  status?: 'sent' | 'received' | 'error' | 'timeout';
  roundtripMs?: number;
  timestamp: number;
  formattedTime: string;
  dispatchInfo?: DispatchTargetInfo;
}

export type EditorTheme = 'freshfood-dark' | 'freshfood-cyber' | 'freshfood-light' | 'vs-dark' | 'vs' | 'hc-black';

export type UiColorMode = 'light' | 'dark';

/**
 * Persisted IDE user preferences stored in localStorage and exported/imported via JSON.
 * Strictly separate from Clockie H2 bridge sessionId (which stays in per-tab sessionStorage).
 */
export interface IdeSettings {
  /** Whole-IDE shell color mode ('light' | 'dark') */
  colorMode: UiColorMode;
  /** Active Monaco Editor syntax/color theme */
  editorTheme: EditorTheme;
  /** Remembered Monaco theme for Dark mode */
  lastDarkEditorTheme: EditorTheme;
  /** Remembered Monaco theme for Light mode */
  lastLightEditorTheme: EditorTheme;
  /** Editor font size in pixels */
  fontSize: number;
  /** Spaces per indentation tab */
  tabSize: number;
  /** Wrap long lines in Monaco */
  wordWrap: boolean;
  /** Show code minimap in Monaco */
  minimap: boolean;
  /** Primary sidebar width in pixels */
  sidebarWidth: number;
  /** Whether the primary sidebar is visible */
  sidebarOpen: boolean;
  /** Preferred cloud provider for exporting preferences JSON (e.g. "pcloud") */
  preferencesExportProvider: string;
  /** Preferred cloud folder path for exporting preferences JSON (e.g. "2026/downloads") */
  preferencesExportFolder: string;
  /** Preferred filename for exporting preferences JSON */
  preferencesExportFilename: string;
  /** When true, the default export filename updates to today's date automatically */
  preferencesUseAutoDateFilename: boolean;
  /** Most recent cloud provider used when importing preferences JSON */
  preferencesLastImportProvider: string;
  /** Most recent cloud folder path used when importing preferences JSON */
  preferencesLastImportFolder: string;
  /** Most recent filename used when importing preferences JSON */
  preferencesLastImportFile: string;
}

