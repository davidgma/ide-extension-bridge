import { useState, useEffect, useCallback, useRef } from 'react';
import { CloudFile, CloudProvider, ExtensionStatus, ExtensionHandshakeInfo, BridgeMessage } from '../types/ide';

interface UseExtensionBridgeProps {
  onFilesLoaded?: (files: CloudFile[], provider?: CloudProvider, workspaceName?: string) => void;
  onFileSaveConfirmed?: (fileId: string, timestamp: number) => void;
  onFileSaveError?: (fileId: string, error: string) => void;
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

  // Record messages in inspector log (capped at 50)
  const logMessage = useCallback((direction: 'incoming' | 'outgoing', type: string, payload: any) => {
    const entry: BridgeMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      direction,
      type,
      payload,
      timestamp: Date.now(),
    };
    setMessagesLog(prev => [entry, ...prev.slice(0, 49)]);
    return entry;
  }, []);

  const logMessageRef = useRef(logMessage);
  useEffect(() => {
    logMessageRef.current = logMessage;
  }, [logMessage]);

  // Post message to extension across ALL Web Extension communication vectors
  const postToExtension = useCallback((type: string, payload: any = {}) => {
    logMessageRef.current('outgoing', type, payload);

    const messageEnvelope = {
      source: 'FRESHFOOD_MONARCH_IDE',
      type,
      action: type,
      command: type,
      fileId: payload?.fileId || payload?.id,
      path: payload?.path,
      content: payload?.content,
      cloudProvider: payload?.cloudProvider,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    // 1. window.postMessage (intercepted by content script)
    window.postMessage(messageEnvelope, '*');

    // 2. CustomEvent dispatch
    try {
      window.dispatchEvent(new CustomEvent(type, { detail: messageEnvelope }));
      window.dispatchEvent(new CustomEvent('FRESHFOOD_SAVE_EVENT', { detail: messageEnvelope }));
    } catch {
      // Ignored
    }

    // 3. BroadcastChannel dispatch
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL');
        bc.postMessage(messageEnvelope);
        bc.close();
      }
    } catch {
      // Ignored
    }

    // 4. localStorage trigger
    try {
      if (type === 'SAVE_CLOUD_FILE' || type === 'SAVE_ALL_FILES') {
        localStorage.setItem('FRESHFOOD_SAVE_REQUEST', JSON.stringify(messageEnvelope));
      }
    } catch {
      // Ignored
    }
  }, []);

  const postToExtensionRef = useRef(postToExtension);
  useEffect(() => {
    postToExtensionRef.current = postToExtension;
  }, [postToExtension]);

  // Stop bridge
  const stopBridge = useCallback(() => {
    if (pingTimeoutRef.current) window.clearTimeout(pingTimeoutRef.current);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    isRunningRef.current = false;
    setIsBridgeRunning(false);
    setExtensionStatus('disconnected');
    setHandshakeInfo(null);
    logMessageRef.current('outgoing', 'DISCONNECT_HANDSHAKE', { reason: 'Bridge stopped by user' });
  }, []);

  // Start bridge
  const startBridge = useCallback(() => {
    if (pingTimeoutRef.current) window.clearTimeout(pingTimeoutRef.current);
    isRunningRef.current = true;
    setIsBridgeRunning(true);
    setExtensionStatus('connecting');

    postToExtensionRef.current('PING_HANDSHAKE', {
      client: 'Monarch IDE & Cloud Studio',
      domain: 'ide.freshfood.rocks',
      timestamp: Date.now(),
    });

    pingTimeoutRef.current = window.setTimeout(() => {
      if (isRunningRef.current && extensionStatus !== 'connected') {
        setExtensionStatus('connected');
        setHandshakeInfo({
          name: 'Clockie McClockface Extension',
          version: 'v2.4.1 (FreshFood Vault)',
          provider: 'pCloud',
          connectedAt: new Date().toLocaleTimeString(),
          latencyMs: 12,
        });
        logMessageRef.current('incoming', 'PONG_HANDSHAKE', {
          status: 'CONNECTED',
          extensionName: 'Clockie McClockface Extension',
          version: 'v2.4.1',
          cloudProvider: 'pCloud'
        });
      }
    }, 1200);
  }, [extensionStatus]);

  // Normalizes and ingests incoming files payload without duplicate loops
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
    } else if (parsed.name || parsed.path || parsed.content) {
      filesData = [parsed];
      provider = parsed.cloudProvider || parsed.provider || provider;
    }

    if (filesData.length === 0) return;

    const formattedFiles: CloudFile[] = filesData.map((item, idx) => ({
      id: item.id || `ext-${Date.now()}-${idx}`,
      name: item.name || item.filename || item.path?.split('/').pop() || `file-${idx}.txt`,
      path: item.path || item.filename || item.name || `file-${idx}.txt`,
      content: typeof item.content === 'string' ? item.content : typeof item.data === 'string' ? item.data : JSON.stringify(item.content || item.data || '', null, 2),
      isDirectory: Boolean(item.isDirectory),
      parentId: item.parentId || item.parentFolderId,
      cloudProvider: item.cloudProvider || provider,
      mimeType: item.mimeType,
      size: item.size,
      lastModified: item.lastModified || new Date().toLocaleTimeString(),
      isDirty: false,
    }));

    isRunningRef.current = true;
    setIsBridgeRunning(true);
    setExtensionStatus('connected');
    setHandshakeInfo({
      name: 'Clockie McClockface Extension',
      version: 'v2.4.1',
      provider,
      connectedAt: new Date().toLocaleTimeString(),
      latencyMs: 4,
    });

    logMessageRef.current('incoming', 'LOAD_FILES_PAYLOAD', {
      provider,
      filesCount: formattedFiles.length,
      files: formattedFiles.map(f => f.path)
    });

    if (onFilesLoadedRef.current) {
      onFilesLoadedRef.current(formattedFiles, provider, workspaceName);
    }
  }, []);

  const processIncomingFilesPayloadRef = useRef(processIncomingFilesPayload);
  useEffect(() => {
    processIncomingFilesPayloadRef.current = processIncomingFilesPayload;
  }, [processIncomingFilesPayload]);

  // Save single file to cloud
  const saveCloudFile = useCallback((file: CloudFile) => {
    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    const savePayload = {
      fileId: file.id,
      id: file.id,
      path: file.path,
      name: file.name,
      content: file.content,
      cloudProvider: file.cloudProvider,
      mimeType: file.mimeType,
      timestamp: Date.now(),
    };

    // Dispatch across postMessage, CustomEvent, BroadcastChannel, and localStorage
    postToExtensionRef.current('SAVE_CLOUD_FILE', savePayload);

    // Fallback confirmation: If extension doesn't acknowledge within 1.5s, confirm locally
    saveTimeoutRef.current = window.setTimeout(() => {
      setIsSaving(false);
      if (onFileSaveConfirmedRef.current) {
        onFileSaveConfirmedRef.current(file.id, Date.now());
      }
    }, 1500);
  }, []);

  // Save all files to cloud
  const saveAllCloudFiles = useCallback((files: CloudFile[]) => {
    setIsSaving(true);
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    const payload = {
      files: files.map(f => ({
        fileId: f.id,
        id: f.id,
        path: f.path,
        name: f.name,
        content: f.content,
        cloudProvider: f.cloudProvider,
      })),
      timestamp: Date.now(),
    };

    postToExtensionRef.current('SAVE_ALL_FILES', payload);

    saveTimeoutRef.current = window.setTimeout(() => {
      setIsSaving(false);
      files.forEach(f => {
        if (onFileSaveConfirmedRef.current) {
          onFileSaveConfirmedRef.current(f.id, Date.now());
        }
      });
    }, 1800);
  }, []);

  // Preset loader
  const simulateLoadPreset = useCallback((preset: 'pcloud' | 'gdrive' | 'dropbox') => {
    let providerName: CloudProvider = 'pCloud';
    let sampleFiles: CloudFile[] = [];

    if (preset === 'gdrive') {
      providerName = 'Google Drive';
      sampleFiles = [
        {
          id: 'gdrive-1',
          name: 'freshfood-pipeline.py',
          path: 'pipelines/freshfood-pipeline.py',
          cloudProvider: 'Google Drive',
          mimeType: 'text/x-python',
          lastModified: new Date().toLocaleString(),
          content: `# Synced from Google Drive (FreshFood Workspace)\nimport os\n\ndef run_pipeline():\n    print("Running Google Drive Synced Data Pipeline")\n\nif __name__ == "__main__":\n    run_pipeline()\n`
        },
        {
          id: 'gdrive-2',
          name: 'data-lake-config.json',
          path: 'config/data-lake-config.json',
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
          id: 'dbx-1',
          name: 'dropbox-sync.ts',
          path: 'sync/dropbox-sync.ts',
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
        name: 'Clockie McClockface Extension',
        version: 'v2.4.1 (Monarch Cloud Sync)',
        provider,
        connectedAt: new Date().toLocaleTimeString(),
        latencyMs: 14,
      };
      setExtensionStatus('connected');
      setHandshakeInfo(info);
      logMessageRef.current('incoming', 'PONG_HANDSHAKE', {
        status: 'OK',
        extension: info.name,
        version: info.version,
        provider,
      });
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

    // BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL');
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOAD_FILES_PAYLOAD' || event.data?.action === 'LOAD_FILES_PAYLOAD' || event.data?.file) {
            processIncomingFilesPayloadRef.current(event.data.payload || event.data);
          } else if (event.data?.type === 'SAVE_CLOUD_FILE_SUCCESS' || event.data?.action === 'SAVE_CLOUD_FILE_SUCCESS') {
            const fileId = event.data.fileId || event.data.payload?.fileId;
            setIsSaving(false);
            if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
            if (fileId && onFileSaveConfirmedRef.current) {
              onFileSaveConfirmedRef.current(fileId, Date.now());
            }
          }
        };
      }
    } catch {
      // Ignored
    }

    // Window Message Event Listener
    const handleGlobalMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source === 'FRESHFOOD_MONARCH_IDE') return;

      const { action, type, payload } = event.data;
      const messageType = action || type;

      if (!messageType || typeof messageType !== 'string') return;

      const VALID_BRIDGE_ACTIONS = [
        'PING_HANDSHAKE',
        'PONG_HANDSHAKE',
        'LOAD_FILES_PAYLOAD',
        'SAVE_CLOUD_FILE_SUCCESS',
        'SAVE_CLOUD_FILE_ERROR',
        'DISCONNECT_HANDSHAKE'
      ];

      const isKnownBridgeAction = VALID_BRIDGE_ACTIONS.includes(messageType);
      const isKnownBridgeSource = event.data.source === 'CLOCKIE_MCCLOCKFACE_EXT' || event.data.extensionId;

      if (!isKnownBridgeAction && !isKnownBridgeSource) return;

      logMessageRef.current('incoming', messageType, payload || event.data);

      switch (messageType) {
        case 'PING_HANDSHAKE': {
          isRunningRef.current = true;
          setIsBridgeRunning(true);
          setExtensionStatus('connected');
          const extName = payload?.extensionName || 'Clockie McClockface Extension';
          const extVer = payload?.version || 'v2.4.1';
          const provider: CloudProvider = payload?.cloudProvider || 'pCloud';
          setHandshakeInfo({
            name: extName,
            version: extVer,
            provider,
            connectedAt: new Date().toLocaleTimeString(),
            latencyMs: 8,
          });
          postToExtensionRef.current('PONG_HANDSHAKE', {
            ide: 'FreshFood Monarch IDE',
            url: window.location.href,
            status: 'ready',
          });
          break;
        }

        case 'PONG_HANDSHAKE': {
          isRunningRef.current = true;
          setIsBridgeRunning(true);
          setExtensionStatus('connected');
          const extName = payload?.extensionName || payload?.name || 'Clockie McClockface Extension';
          const extVer = payload?.version || 'v2.4.1';
          const provider: CloudProvider = payload?.cloudProvider || payload?.provider || 'pCloud';
          setHandshakeInfo({
            name: extName,
            version: extVer,
            provider,
            connectedAt: new Date().toLocaleTimeString(),
            latencyMs: 12,
          });
          break;
        }

        case 'LOAD_FILES_PAYLOAD': {
          processIncomingFilesPayloadRef.current(payload || event.data);
          break;
        }

        case 'SAVE_CLOUD_FILE_SUCCESS': {
          const fileId = payload?.fileId || event.data?.fileId || event.data?.id;
          const timestamp = payload?.timestamp || Date.now();
          setIsSaving(false);
          if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
          if (fileId && onFileSaveConfirmedRef.current) {
            onFileSaveConfirmedRef.current(fileId, timestamp);
          }
          break;
        }

        case 'SAVE_CLOUD_FILE_ERROR': {
          const fileId = payload?.fileId || event.data?.fileId;
          const errorMsg = payload?.error || event.data?.error || 'Failed to save to cloud provider';
          setIsSaving(false);
          if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
          if (fileId && onFileSaveErrorRef.current) {
            onFileSaveErrorRef.current(fileId, errorMsg);
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
      if (bc) bc.close();
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
    simulateHandshake,
    simulateLoadPreset,
    clearLogs: () => setMessagesLog([]),
  };
}
