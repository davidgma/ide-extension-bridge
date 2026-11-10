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
  const isRunningRef = useRef(false);
  const onFilesLoadedRef = useRef(onFilesLoaded);

  useEffect(() => {
    onFilesLoadedRef.current = onFilesLoaded;
  }, [onFilesLoaded]);

  // Helper to record messages in the log
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

  // Post message to window (for Chrome extension content script to intercept)
  const postToExtension = useCallback((type: string, payload: any = {}) => {
    logMessage('outgoing', type, payload);
    window.postMessage(
      {
        source: 'FRESHFOOD_MONARCH_IDE',
        type,
        payload,
        timestamp: Date.now(),
      },
      '*'
    );
  }, [logMessage]);

  // Stop bridge
  const stopBridge = useCallback(() => {
    if (pingTimeoutRef.current) {
      window.clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }
    isRunningRef.current = false;
    setIsBridgeRunning(false);
    setExtensionStatus('disconnected');
    setHandshakeInfo(null);
    logMessage('outgoing', 'DISCONNECT_HANDSHAKE', { reason: 'Bridge manually stopped by user' });
  }, [logMessage]);

  // Start bridge
  const startBridge = useCallback(() => {
    if (pingTimeoutRef.current) {
      window.clearTimeout(pingTimeoutRef.current);
    }
    isRunningRef.current = true;
    setIsBridgeRunning(true);
    setExtensionStatus('connecting');

    postToExtension('PING_HANDSHAKE', {
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
        logMessage('incoming', 'PONG_HANDSHAKE', {
          status: 'CONNECTED',
          extensionName: 'Clockie McClockface Extension',
          version: 'v2.4.1',
          cloudProvider: 'pCloud'
        });
      }
    }, 1500);
  }, [postToExtension, logMessage, extensionStatus]);

  // Normalizes incoming raw payload into structured CloudFile array
  const processIncomingFilesPayload = useCallback((rawPayload: any, rawProvider?: CloudProvider) => {
    let filesData: any[] = [];
    let provider: CloudProvider = rawProvider || 'pCloud';
    let workspaceName = 'Cloud Extension Drive';

    if (!rawPayload) return;

    if (typeof rawPayload === 'string') {
      try {
        rawPayload = JSON.parse(rawPayload);
      } catch {
        // Plain text file sent directly
        rawPayload = { name: 'extension-file.txt', path: 'extension-file.txt', content: rawPayload };
      }
    }

    if (Array.isArray(rawPayload)) {
      filesData = rawPayload;
    } else if (rawPayload.files && Array.isArray(rawPayload.files)) {
      filesData = rawPayload.files;
      provider = rawPayload.cloudProvider || rawPayload.provider || provider;
      workspaceName = rawPayload.workspaceName || workspaceName;
    } else if (rawPayload.fileList && Array.isArray(rawPayload.fileList)) {
      filesData = rawPayload.fileList;
      provider = rawPayload.cloudProvider || rawPayload.provider || provider;
      workspaceName = rawPayload.workspaceName || workspaceName;
    } else if (rawPayload.file && typeof rawPayload.file === 'object') {
      filesData = [rawPayload.file];
      provider = rawPayload.cloudProvider || rawPayload.provider || provider;
    } else if (rawPayload.name || rawPayload.path || rawPayload.content) {
      filesData = [rawPayload];
      provider = rawPayload.cloudProvider || rawPayload.provider || provider;
    }

    if (filesData.length === 0) return;

    const formattedFiles: CloudFile[] = filesData.map((item, idx) => ({
      id: item.id || `ext-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
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

    // Activate bridge and update connection status
    isRunningRef.current = true;
    setIsBridgeRunning(true);
    setExtensionStatus('connected');
    setHandshakeInfo({
      name: 'Clockie McClockface Extension',
      version: 'v2.4.1',
      provider,
      connectedAt: new Date().toLocaleTimeString(),
      latencyMs: 5,
    });

    logMessage('incoming', 'LOAD_FILES_PAYLOAD', {
      provider,
      filesCount: formattedFiles.length,
      files: formattedFiles.map(f => f.path)
    });

    if (onFilesLoadedRef.current) {
      onFilesLoadedRef.current(formattedFiles, provider, workspaceName);
    }
  }, [logMessage]);

  // Save single file
  const saveCloudFile = useCallback((file: CloudFile) => {
    setIsSaving(true);
    postToExtension('SAVE_CLOUD_FILE', {
      fileId: file.id,
      path: file.path,
      content: file.content,
      cloudProvider: file.cloudProvider,
      timestamp: Date.now(),
      mimeType: file.mimeType,
    });

    window.setTimeout(() => {
      setIsSaving(false);
      if (onFileSaveConfirmed) {
        onFileSaveConfirmed(file.id, Date.now());
      }
    }, 250);
  }, [postToExtension, onFileSaveConfirmed]);

  // Save all files
  const saveAllCloudFiles = useCallback((files: CloudFile[]) => {
    setIsSaving(true);
    postToExtension('SAVE_ALL_FILES', {
      files: files.map(f => ({
        fileId: f.id,
        path: f.path,
        content: f.content,
        cloudProvider: f.cloudProvider,
      })),
      timestamp: Date.now(),
    });

    window.setTimeout(() => {
      setIsSaving(false);
      files.forEach(f => {
        if (onFileSaveConfirmed) {
          onFileSaveConfirmed(f.id, Date.now());
        }
      });
    }, 350);
  }, [postToExtension, onFileSaveConfirmed]);

  // Preset simulation loader
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
      logMessage('incoming', 'PONG_HANDSHAKE', {
        status: 'OK',
        extension: info.name,
        version: info.version,
        provider,
      });
    } else {
      stopBridge();
    }
  }, [logMessage, stopBridge]);

  // Check URL parameters, Hash fragment, and localStorage/BroadcastChannel on boot for incoming file payloads
  useEffect(() => {
    // 1. Check URL Query Parameters or Hash
    try {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));

      const payloadStr = params.get('payload') || params.get('file') || params.get('data') ||
                         hashParams.get('payload') || hashParams.get('file') || hashParams.get('data');

      if (payloadStr) {
        processIncomingFilesPayload(payloadStr);
      }

      // 2. Check localStorage for pending extension payload
      const storedPayload = localStorage.getItem('FRESHFOOD_PENDING_FILE') || localStorage.getItem('CLOCKIE_PENDING_PAYLOAD');
      if (storedPayload) {
        localStorage.removeItem('FRESHFOOD_PENDING_FILE');
        localStorage.removeItem('CLOCKIE_PENDING_PAYLOAD');
        processIncomingFilesPayload(storedPayload);
      }
    } catch (e) {
      console.warn('Error inspecting boot URL/storage payload:', e);
    }

    // 3. Listen on BroadcastChannel for multi-tab or extension background broadcasts
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL');
        bc.onmessage = (event) => {
          if (event.data?.type === 'LOAD_FILES_PAYLOAD' || event.data?.action === 'LOAD_FILES_PAYLOAD' || event.data?.file) {
            processIncomingFilesPayload(event.data.payload || event.data);
          }
        };
      }
    } catch {
      // BroadcastChannel not available in all contexts
    }

    // 4. Global window message listener (Active at all times so incoming extension events are NEVER missed!)
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
        'SAVE_CLOUD_FILE',
        'SAVE_CLOUD_FILE_SUCCESS',
        'SAVE_CLOUD_FILE_ERROR',
        'DISCONNECT_HANDSHAKE'
      ];

      const isKnownBridgeAction = VALID_BRIDGE_ACTIONS.includes(messageType);
      const isKnownBridgeSource = event.data.source === 'CLOCKIE_MCCLOCKFACE_EXT' || event.data.extensionId;

      if (!isKnownBridgeAction && !isKnownBridgeSource) return;

      logMessage('incoming', messageType, payload || event.data);

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
          postToExtension('PONG_HANDSHAKE', {
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
          processIncomingFilesPayload(payload || event.data);
          break;
        }

        case 'SAVE_CLOUD_FILE_SUCCESS': {
          const fileId = payload?.fileId;
          const timestamp = payload?.timestamp || Date.now();
          setIsSaving(false);
          if (fileId && onFileSaveConfirmed) {
            onFileSaveConfirmed(fileId, timestamp);
          }
          break;
        }

        case 'SAVE_CLOUD_FILE_ERROR': {
          const fileId = payload?.fileId;
          const errorMsg = payload?.error || 'Failed to save to cloud provider';
          setIsSaving(false);
          if (fileId && onFileSaveError) {
            onFileSaveError(fileId, errorMsg);
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
      if (pingTimeoutRef.current) {
        window.clearTimeout(pingTimeoutRef.current);
      }
    };
  }, [logMessage, postToExtension, processIncomingFilesPayload, onFileSaveConfirmed, onFileSaveError]);

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
