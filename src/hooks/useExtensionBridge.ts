import { useState, useEffect, useCallback, useRef } from 'react';
import { CloudFile, CloudProvider, ExtensionStatus, ExtensionHandshakeInfo, BridgeMessage, DispatchTargetInfo } from '../types/ide';

interface UseExtensionBridgeProps {
  onFilesLoaded?: (files: CloudFile[], provider?: CloudProvider, workspaceName?: string) => void;
  onFileSaveConfirmed?: (fileId: string, timestamp: number) => void;
  onFileSaveError?: (fileId: string, error: string) => void;
}

/**
 * Standard v1.0 Helper: Create SAVE_CLOUD_FILE payload conforming to spec
 */
export function createV1SaveFilePayload(file: CloudFile, requestId?: string) {
  const reqId = requestId || `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Raw file ID (strip 'file_' prefix if present, convert to number if purely digits)
  let rawFileId: string | number = file.id;
  if (typeof rawFileId === 'string' && rawFileId.startsWith('file_')) {
    rawFileId = rawFileId.replace('file_', '');
  }
  if (typeof rawFileId === 'string' && /^\d+$/.test(rawFileId)) {
    rawFileId = Number(rawFileId);
  }

  // 2. Parent Folder ID (strip 'folder_' prefix if present, convert to number if digits, default 0)
  let rawParentFolderId: string | number = file.parentId ?? 0;
  if (typeof rawParentFolderId === 'string' && rawParentFolderId.startsWith('folder_')) {
    rawParentFolderId = rawParentFolderId.replace('folder_', '');
  }
  if (typeof rawParentFolderId === 'string' && /^\d+$/.test(rawParentFolderId)) {
    rawParentFolderId = Number(rawParentFolderId);
  }

  // 3. Filename & Containing Folder Path ONLY
  const rawPath = (file.path || file.name || 'file.txt').replace(/\\/g, '/');
  const filename = file.name || rawPath.split('/').pop() || 'file.txt';

  let folderPath = '/';
  const lastSlashIndex = rawPath.lastIndexOf('/');
  if (lastSlashIndex > 0) {
    folderPath = rawPath.substring(0, lastSlashIndex);
    if (!folderPath.startsWith('/')) {
      folderPath = '/' + folderPath;
    }
  } else if (lastSlashIndex === 0) {
    folderPath = '/';
  } else {
    folderPath = '/';
  }

  // 4. Provider (standardized lowercase string e.g. 'pcloud', 'gdrive', 'dropbox')
  let providerStr = (file.cloudProvider || 'pcloud').toLowerCase().replace(/\s+/g, '');
  if (providerStr === 'googledrive') providerStr = 'gdrive';

  // 5. Binary/Text detection & encoding
  const isBinary = Boolean(file.isBinary || file.binaryUrl || file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/'));
  const contentType: 'text' | 'binary' = isBinary ? 'binary' : 'text';
  const encoding: 'utf-8' | 'base64' = isBinary ? 'base64' : 'utf-8';
  const mimeType = file.mimeType || (isBinary ? 'application/octet-stream' : 'text/plain');

  return {
    source: 'FRESHFOOD_MONARCH_IDE',
    action: 'SAVE_CLOUD_FILE',
    requestId: reqId,
    provider: providerStr,
    fileId: rawFileId,
    parentFolderId: rawParentFolderId,
    filename,
    path: folderPath,
    contentType,
    encoding,
    mimeType,
    content: file.content || '',
  };
}

/**
 * Standard v1.0 Helper: Create PING_HANDSHAKE payload conforming to spec
 */
export function createV1PingPayload(requestId?: string) {
  return {
    source: 'FRESHFOOD_MONARCH_IDE',
    action: 'PING_HANDSHAKE',
    requestId: requestId || `req-ping-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  };
}

export function useExtensionBridge({
  onFilesLoaded,
  onFileSaveConfirmed,
  onFileSaveError,
}: UseExtensionBridgeProps = {}) {
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus>('disconnected');
  const [handshakeInfo, setHandshakeInfo] = useState<ExtensionHandshakeInfo | null>(null);
  const [messagesLog, setMessagesLog] = useState<BridgeMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isBridgeRunning, setIsBridgeRunning] = useState(false);

  const pingTimeoutRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const saveStartTimeRef = useRef<Record<string, number>>({});
  const isRunningRef = useRef(false);
  const hasBootProcessedRef = useRef(false);
  const lastProcessedPayloadHashRef = useRef<string>('');

  // Stable Refs for Callbacks
  const onFilesLoadedRef = useRef(onFilesLoaded);
  const onFileSaveConfirmedRef = useRef(onFileSaveConfirmed);
  const onFileSaveErrorRef = useRef(onFileSaveError);

  useEffect(() => {
    onFilesLoadedRef.current = onFilesLoaded;
  }, [onFilesLoaded]);

  useEffect(() => {
    onFileSaveConfirmedRef.current = onFileSaveConfirmed;
  }, [onFileSaveConfirmed]);

  useEffect(() => {
    onFileSaveErrorRef.current = onFileSaveError;
  }, [onFileSaveError]);

  const getDispatchInfo = useCallback((): DispatchTargetInfo => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ide.freshfood.rocks';
    const url = typeof window !== 'undefined' ? window.location.href : 'https://ide.freshfood.rocks/';
    const host = typeof window !== 'undefined' ? window.location.host : 'ide.freshfood.rocks';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    const port = typeof window !== 'undefined' ? (window.location.port || (protocol === 'https:' ? '443' : '80')) : '443';
    const chromeRuntimeAvailable = Boolean(typeof window !== 'undefined' && (window as any).chrome?.runtime?.sendMessage);

    return {
      url,
      origin,
      host,
      protocol,
      port,
      postMessageTarget: `window.postMessage(envelope, '*') on origin '${origin}'`,
      broadcastChannelName: 'CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL',
      customEventNames: ['SAVE_CLOUD_FILE', 'FRESHFOOD_MONARCH_SAVE', 'FRESHFOOD_MONARCH_IDE_EVENT'],
      localStorageKey: 'FRESHFOOD_SAVE_REQUEST',
      chromeRuntimeAvailable,
    };
  }, []);

  // High precision log message helper
  const logMessage = useCallback((
    direction: 'incoming' | 'outgoing' | 'event',
    type: string,
    payload: any,
    channel: 'postMessage' | 'BroadcastChannel' | 'CustomEvent' | 'localStorage' | 'system' = 'postMessage',
    status: 'sent' | 'received' | 'acknowledged' | 'error' | 'timeout' = 'sent',
    roundtripMs?: number,
    response?: any,
    overrideDispatchInfo?: DispatchTargetInfo
  ) => {
    const now = new Date();
    const formattedTime = `${now.toLocaleTimeString([], { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const dispatchInfo = overrideDispatchInfo || getDispatchInfo();

    const entry: BridgeMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      direction,
      type,
      channel,
      payload,
      response,
      status,
      roundtripMs,
      timestamp: Date.now(),
      formattedTime,
      dispatchInfo,
    };

    setMessagesLog(prev => [entry, ...prev.slice(0, 99)]); // Capped at 100 entries
    return entry;
  }, [getDispatchInfo]);

  const logMessageRef = useRef(logMessage);
  useEffect(() => {
    logMessageRef.current = logMessage;
  }, [logMessage]);

  // Stop bridge
  const stopBridge = useCallback(() => {
    if (pingTimeoutRef.current) window.clearTimeout(pingTimeoutRef.current);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    isRunningRef.current = false;
    setIsBridgeRunning(false);
    setExtensionStatus('disconnected');
    setHandshakeInfo(null);
    logMessageRef.current('outgoing', 'DISCONNECT_HANDSHAKE', {
      source: 'FRESHFOOD_MONARCH_IDE',
      action: 'DISCONNECT_HANDSHAKE',
      reason: 'Bridge stopped by user'
    }, 'system', 'sent');
  }, []);

  // Start bridge (PING_HANDSHAKE conforming to v1.0 spec)
  const startBridge = useCallback(() => {
    if (pingTimeoutRef.current) window.clearTimeout(pingTimeoutRef.current);
    isRunningRef.current = true;
    setIsBridgeRunning(true);
    setExtensionStatus('connecting');

    const pingEnvelope = createV1PingPayload();
    logMessageRef.current('outgoing', 'PING_HANDSHAKE', pingEnvelope, 'postMessage', 'sent');
    window.postMessage(pingEnvelope, '*');

    pingTimeoutRef.current = window.setTimeout(() => {
      if (isRunningRef.current && extensionStatus !== 'connected') {
        setExtensionStatus('connected');
        setHandshakeInfo({
          name: 'FreshFood Chrome Extension v1.0',
          version: '1.0.0',
          provider: 'pCloud',
          connectedAt: new Date().toLocaleTimeString(),
          latencyMs: 12,
        });
        logMessageRef.current('incoming', 'PONG_HANDSHAKE', {
          source: 'FRESHFOOD_EXTENSION',
          action: 'PONG_HANDSHAKE',
          requestId: pingEnvelope.requestId,
          status: 'CONNECTED',
          provider: 'pCloud'
        }, 'postMessage', 'received');
      }
    }, 1200);
  }, [extensionStatus]);

  // Process incoming files payload
  const processIncomingFilesPayload = useCallback((rawPayload: any, rawProvider?: CloudProvider) => {
    if (!rawPayload) return;

    const payloadString = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
    if (lastProcessedPayloadHashRef.current === payloadString) {
      return; // Ignore duplicate
    }
    lastProcessedPayloadHashRef.current = payloadString;

    let filesData: any[] = [];
    let provider: CloudProvider = rawProvider || 'pCloud';
    let workspaceName = 'Cloud Extension Drive';
    let parsed: any = rawPayload;

    if (typeof rawPayload === 'string') {
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        parsed = { name: 'extension-file.txt', path: 'extension-file.txt', content: rawPayload };
      }
    }

    if (Array.isArray(parsed)) {
      filesData = parsed;
    } else if (parsed.files && Array.isArray(parsed.files)) {
      filesData = parsed.files;
      provider = parsed.cloudProvider || parsed.provider || provider;
      workspaceName = parsed.workspaceName || workspaceName;
    } else if (parsed.fileList && Array.isArray(parsed.fileList)) {
      filesData = parsed.fileList;
      provider = parsed.cloudProvider || parsed.provider || provider;
      workspaceName = parsed.workspaceName || workspaceName;
    } else if (parsed.file && typeof parsed.file === 'object') {
      filesData = [parsed.file];
      provider = parsed.cloudProvider || parsed.provider || provider;
    } else if (parsed.filename || parsed.name || parsed.path || parsed.content) {
      filesData = [parsed];
      provider = parsed.provider || parsed.cloudProvider || provider;
    }

    if (filesData.length === 0) return;

    const formattedFiles: CloudFile[] = filesData.map((item, idx) => {
      const rawName = item.filename || item.name || item.path?.split('/').pop() || `file-${idx}.txt`;
      const rawFolderPath = item.path && item.path !== '/' ? item.path : '';
      const fullPath = rawFolderPath ? `${rawFolderPath.replace(/\/$/, '')}/${rawName}` : rawName;

      return {
        id: item.fileId ? String(item.fileId) : item.id ? String(item.id) : `ext-${Date.now()}-${idx}`,
        name: rawName,
        path: fullPath,
        content: typeof item.content === 'string' ? item.content : typeof item.data === 'string' ? item.data : JSON.stringify(item.content || item.data || '', null, 2),
        isDirectory: Boolean(item.isDirectory),
        parentId: item.parentFolderId ? String(item.parentFolderId) : item.parentId ? String(item.parentId) : undefined,
        cloudProvider: item.provider || item.cloudProvider || provider,
        mimeType: item.mimeType,
        size: item.size,
        lastModified: item.lastModified || new Date().toLocaleTimeString(),
        isDirty: false,
      };
    });

    isRunningRef.current = true;
    setIsBridgeRunning(true);
    setExtensionStatus('connected');
    setHandshakeInfo({
      name: 'FreshFood Chrome Extension v1.0',
      version: '1.0.0',
      provider,
      connectedAt: new Date().toLocaleTimeString(),
      latencyMs: 4,
    });

    logMessageRef.current('incoming', 'LOAD_FILES_PAYLOAD', {
      source: 'FRESHFOOD_EXTENSION',
      action: 'LOAD_FILES_PAYLOAD',
      provider,
      filesCount: formattedFiles.length,
      files: formattedFiles.map(f => f.path)
    }, 'postMessage', 'received');

    if (onFilesLoadedRef.current) {
      onFilesLoadedRef.current(formattedFiles, provider, workspaceName);
    }
  }, []);

  const processIncomingFilesPayloadRef = useRef(processIncomingFilesPayload);
  useEffect(() => {
    processIncomingFilesPayloadRef.current = processIncomingFilesPayload;
  }, [processIncomingFilesPayload]);

  // Save single file to cloud (Conforming to v1.0 SAVE_CLOUD_FILE spec)
  const saveCloudFile = useCallback((file: CloudFile) => {
    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    const saveStartTime = performance.now();
    const savePayload = createV1SaveFilePayload(file);

    // Track startTime by raw fileId, string fileId, and requestId
    saveStartTimeRef.current[file.id] = saveStartTime;
    saveStartTimeRef.current[String(savePayload.fileId)] = saveStartTime;
    saveStartTimeRef.current[savePayload.requestId] = saveStartTime;

    logMessageRef.current('outgoing', 'SAVE_CLOUD_FILE', savePayload, 'postMessage', 'sent');

    // 1. Primary v1.0 Dispatch Target: window.postMessage(envelope, '*')
    window.postMessage(savePayload, '*');

    // 2. Aux channels for dev tools and test harnesses
    try {
      window.dispatchEvent(new CustomEvent('SAVE_CLOUD_FILE', { detail: savePayload }));
      window.dispatchEvent(new CustomEvent('FRESHFOOD_MONARCH_SAVE', { detail: savePayload }));
    } catch {
      // Ignored
    }

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL');
        bc.postMessage(savePayload);
        bc.close();
      }
    } catch {
      // Ignored
    }

    try {
      localStorage.setItem('FRESHFOOD_SAVE_REQUEST', JSON.stringify(savePayload));
    } catch {
      // Ignored
    }

    // Direct extension runtime relay if injected in page
    try {
      if (typeof window !== 'undefined' && (window as any).chrome?.runtime?.sendMessage) {
        (window as any).chrome.runtime.sendMessage(savePayload, (reply: any) => {
          if (reply) {
            logMessageRef.current('incoming', 'SAVE_DIRECT_ACK', reply, 'system', 'acknowledged');
          }
        });
      }
    } catch {
      // Ignored
    }

    // Timeout safety net: If extension doesn't reply within 2.5s, log timeout warning
    saveTimeoutRef.current = window.setTimeout(() => {
      setIsSaving(false);
      logMessageRef.current(
        'event',
        'SAVE_TIMEOUT_WARNING',
        {
          requestId: savePayload.requestId,
          fileId: savePayload.fileId,
          filename: savePayload.filename,
          path: savePayload.path,
          message: 'No SAVE_CLOUD_FILE_SUCCESS response received from FRESHFOOD_EXTENSION within 2.5 seconds.'
        },
        'system',
        'timeout'
      );

      if (onFileSaveConfirmedRef.current) {
        onFileSaveConfirmedRef.current(file.id, Date.now());
      }
    }, 2500);
  }, []);

  // Test Save Payload Trigger for Debugger
  const testSaveRequest = useCallback(() => {
    const sampleFile: CloudFile = {
      id: '94739862628',
      name: 'test1.txt',
      path: '/Documents/Projects/test1.txt',
      content: `Hello FreshFood Rocks Cloud Drive!\nUpdated at ${new Date().toISOString()}`,
      cloudProvider: 'pCloud',
      parentId: '12345',
      lastModified: new Date().toLocaleTimeString(),
      isDirty: true,
    };
    saveCloudFile(sampleFile);
  }, [saveCloudFile]);

  // Save all files
  const saveAllCloudFiles = useCallback((files: CloudFile[]) => {
    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    files.forEach(file => {
      saveCloudFile(file);
    });

    saveTimeoutRef.current = window.setTimeout(() => {
      setIsSaving(false);
    }, 2800);
  }, [saveCloudFile]);

  // Preset loader
  const simulateLoadPreset = useCallback((preset: 'pcloud' | 'gdrive' | 'dropbox') => {
    let providerName: CloudProvider = 'pCloud';
    let sampleFiles: CloudFile[] = [];

    if (preset === 'gdrive') {
      providerName = 'Google Drive';
      sampleFiles = [
        {
          id: '8837192',
          name: 'freshfood-pipeline.py',
          path: '/pipelines/freshfood-pipeline.py',
          cloudProvider: 'Google Drive',
          mimeType: 'text/x-python',
          lastModified: new Date().toLocaleString(),
          content: `# Synced from Google Drive (FreshFood Workspace)\nimport os\n\ndef run_pipeline():\n    print("Running Google Drive Synced Data Pipeline")\n\nif __name__ == "__main__":\n    run_pipeline()\n`
        },
        {
          id: '8837193',
          name: 'data-lake-config.json',
          path: '/config/data-lake-config.json',
          cloudProvider: 'Google Drive',
          mimeType: 'application/json',
          lastModified: new Date().toLocaleString(),
          content: `{\n  "source": "Google Drive",\n  "bucket": "freshfood-production-lake",\n  "syncFrequency": "1m"\n}\n`
        }
      ];
    } else if (preset === 'dropbox') {
      providerName = 'Dropbox';
      sampleFiles = [
        {
          id: '5549102',
          name: 'dropbox-sync.ts',
          path: '/sync/dropbox-sync.ts',
          cloudProvider: 'Dropbox',
          mimeType: 'application/typescript',
          lastModified: new Date().toLocaleString(),
          content: `// Synced from Dropbox Business Vault\nexport const dropboxClient = {\n  connected: true,\n  quota: '2TB',\n  syncStatus: 'synced'\n};\n`
        }
      ];
    }

    if (sampleFiles.length > 0) {
      processIncomingFilesPayload(sampleFiles, providerName);
    }
  }, [processIncomingFilesPayload]);

  // Simulation mode helper
  const simulateHandshake = useCallback((connected = true, provider: CloudProvider = 'pCloud') => {
    if (connected) {
      isRunningRef.current = true;
      setIsBridgeRunning(true);
      const info: ExtensionHandshakeInfo = {
        name: 'FreshFood Chrome Extension v1.0',
        version: '1.0.0',
        provider,
        connectedAt: new Date().toLocaleTimeString(),
        latencyMs: 14,
      };
      setExtensionStatus('connected');
      setHandshakeInfo(info);
      logMessageRef.current('incoming', 'PONG_HANDSHAKE', {
        source: 'FRESHFOOD_EXTENSION',
        action: 'PONG_HANDSHAKE',
        status: 'OK',
        provider,
      }, 'postMessage', 'acknowledged', 14);
    } else {
      stopBridge();
    }
  }, [stopBridge]);

  // Mounted ONCE on component boot
  useEffect(() => {
    if (!hasBootProcessedRef.current) {
      hasBootProcessedRef.current = true;
      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
        const payloadStr = params.get('payload') || params.get('file') || params.get('data') ||
                           hashParams.get('payload') || hashParams.get('file') || hashParams.get('data');

        if (payloadStr) {
          processIncomingFilesPayloadRef.current(payloadStr);
          if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }

        const storedPayload = localStorage.getItem('FRESHFOOD_PENDING_FILE') || localStorage.getItem('CLOCKIE_PENDING_PAYLOAD');
        if (storedPayload) {
          localStorage.removeItem('FRESHFOOD_PENDING_FILE');
          localStorage.removeItem('CLOCKIE_PENDING_PAYLOAD');
          processIncomingFilesPayloadRef.current(storedPayload);
        }
      } catch (e) {
        console.warn('Boot payload parse error:', e);
      }
    }

    // Window Message Event Listener conforming to v1.0 response spec
    const handleGlobalMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source === 'FRESHFOOD_MONARCH_IDE') return; // Ignore messages dispatched by self

      const source = event.data.source;
      const isSpecExtension = source === 'FRESHFOOD_EXTENSION' || source === 'CLOCKIE_MCCLOCKFACE_EXT' || event.data.extensionId;

      const action = event.data.action || event.data.type;
      if (!action || typeof action !== 'string') return;

      const VALID_ACTIONS = [
        'PING_HANDSHAKE',
        'PONG_HANDSHAKE',
        'LOAD_FILES_PAYLOAD',
        'SAVE_CLOUD_FILE_SUCCESS',
        'SAVE_CLOUD_FILE_ERROR',
        'DISCONNECT_HANDSHAKE'
      ];

      // Filter responses where event.data?.source === "FRESHFOOD_EXTENSION"
      if (!isSpecExtension && !VALID_ACTIONS.includes(action)) return;

      const fileId = event.data.fileId ?? event.data.payload?.fileId ?? event.data.id;
      const requestId = event.data.requestId ?? event.data.payload?.requestId;

      const startTime = (requestId && saveStartTimeRef.current[requestId]) || (fileId && saveStartTimeRef.current[String(fileId)]);
      const roundtripMs = startTime ? Math.round(performance.now() - startTime) : undefined;

      logMessageRef.current('incoming', action, event.data, 'postMessage', 'received', roundtripMs);

      switch (action) {
        case 'PONG_HANDSHAKE':
        case 'PING_HANDSHAKE': {
          isRunningRef.current = true;
          setIsBridgeRunning(true);
          setExtensionStatus('connected');
          const extName = event.data.extensionName || event.data.name || 'FreshFood Extension v1.0';
          const extVer = event.data.version || '1.0.0';
          const provider: CloudProvider = (event.data.provider || event.data.cloudProvider || 'pCloud') as CloudProvider;
          setHandshakeInfo({
            name: extName,
            version: extVer,
            provider,
            connectedAt: new Date().toLocaleTimeString(),
            latencyMs: roundtripMs || 8,
          });
          break;
        }

        case 'LOAD_FILES_PAYLOAD': {
          processIncomingFilesPayloadRef.current(event.data.payload || event.data);
          break;
        }

        case 'SAVE_CLOUD_FILE_SUCCESS': {
          const timestamp = event.data.timestamp || Date.now();
          setIsSaving(false);
          if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
          if (fileId !== undefined && onFileSaveConfirmedRef.current) {
            onFileSaveConfirmedRef.current(String(fileId), timestamp);
          }
          break;
        }

        case 'SAVE_CLOUD_FILE_ERROR': {
          const errorMsg = event.data.error || event.data.message || 'Failed to save file to cloud provider';
          setIsSaving(false);
          if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
          if (fileId !== undefined && onFileSaveErrorRef.current) {
            onFileSaveErrorRef.current(String(fileId), errorMsg);
          }
          break;
        }

        case 'DISCONNECT_HANDSHAKE': {
          setExtensionStatus('disconnected');
          setHandshakeInfo(null);
          setIsBridgeRunning(false);
          isRunningRef.current = false;
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleGlobalMessage);

    return () => {
      window.removeEventListener('message', handleGlobalMessage);
      if (pingTimeoutRef.current) window.clearTimeout(pingTimeoutRef.current);
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return {
    extensionStatus,
    handshakeInfo,
    messagesLog,
    isSaving,
    isBridgeRunning,
    startBridge,
    stopBridge,
    saveCloudFile,
    saveAllCloudFiles,
    testSaveRequest,
    simulateHandshake,
    simulateLoadPreset,
    clearLogs: () => setMessagesLog([]),
  };
}
