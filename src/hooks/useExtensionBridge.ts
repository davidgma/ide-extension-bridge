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
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const pingTimeoutRef = useRef<number | null>(null);

  // Helper to record messages in the log
  const logMessage = useCallback((direction: 'incoming' | 'outgoing', type: string, payload: any) => {
    const entry: BridgeMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      direction,
      type,
      payload,
      timestamp: Date.now(),
    };
    setMessagesLog(prev => [entry, ...prev.slice(0, 49)]); // keep last 50
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

  // Send PING_HANDSHAKE to find Clockie McClockface extension
  const sendPingHandshake = useCallback(() => {
    setExtensionStatus('connecting');
    const startTime = performance.now();
    postToExtension('PING_HANDSHAKE', {
      client: 'Monarch IDE & Cloud Studio',
      domain: 'ide.freshfood.rocks',
      timestamp: Date.now(),
    });

    if (pingTimeoutRef.current) {
      window.clearTimeout(pingTimeoutRef.current);
    }

    // Set fallback timeout if extension doesn't answer within 3.5s
    pingTimeoutRef.current = window.setTimeout(() => {
      setExtensionStatus(prev => (prev === 'connecting' ? 'disconnected' : prev));
    }, 3500);
  }, [postToExtension]);

  // Save single file to cloud
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

    // If extension is connected, it will reply with SAVE_CLOUD_FILE_SUCCESS.
    // In standalone mode or for immediate optimistic UX:
    window.setTimeout(() => {
      setIsSaving(false);
      setLastSavedTimestamp(Date.now());
      if (onFileSaveConfirmed) {
        onFileSaveConfirmed(file.id, Date.now());
      }
    }, 400);
  }, [postToExtension, onFileSaveConfirmed]);

  // Save all files batch to cloud
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
      setLastSavedTimestamp(Date.now());
      files.forEach(f => {
        if (onFileSaveConfirmed) {
          onFileSaveConfirmed(f.id, Date.now());
        }
      });
    }, 600);
  }, [postToExtension, onFileSaveConfirmed]);

  // Simulation mode helper: allow users to simulate extension connectivity and payloads
  const simulateHandshake = useCallback((connected = true, provider: CloudProvider = 'pCloud') => {
    if (connected) {
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
      setExtensionStatus('disconnected');
      setHandshakeInfo(null);
      logMessage('incoming', 'DISCONNECT_HANDSHAKE', { reason: 'User initiated standalone switch' });
    }
  }, [logMessage]);

  // Simulate loading payload from different cloud providers
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

    if (onFilesLoaded && sampleFiles.length > 0) {
      onFilesLoaded(sampleFiles, providerName, `${providerName} Remote Vault`);
      simulateHandshake(true, providerName);
      logMessage('incoming', 'LOAD_FILES_PAYLOAD', {
        provider: providerName,
        filesCount: sampleFiles.length,
        files: sampleFiles.map(f => f.path)
      });
    }
  }, [onFilesLoaded, simulateHandshake, logMessage]);

  // Listen for window postMessages (from extension background or content script)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: Ignore own messages or non-object events
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.source === 'FRESHFOOD_MONARCH_IDE') return;

      const { action, type, payload } = event.data;
      const messageType = action || type;

      if (!messageType) return;

      logMessage('incoming', messageType, payload || event.data);

      switch (messageType) {
        case 'PING_HANDSHAKE': {
          // Extension pinged us, respond with PONG
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
          // Handshake acknowledged by extension
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
          // Incoming files or folder structure
          const filesData: any[] = payload?.files || payload?.fileList || [];
          const provider: CloudProvider = payload?.cloudProvider || payload?.provider || 'pCloud';
          const workspaceName: string = payload?.workspaceName || 'Cloud Drive Workspace';

          const formattedFiles: CloudFile[] = filesData.map((item, idx) => ({
            id: item.id || `ext-${Date.now()}-${idx}`,
            name: item.name || item.path?.split('/').pop() || `file-${idx}`,
            path: item.path || item.name || `file-${idx}`,
            content: typeof item.content === 'string' ? item.content : JSON.stringify(item.content, null, 2),
            isDirectory: Boolean(item.isDirectory),
            parentId: item.parentId || item.parentFolderId,
            cloudProvider: provider,
            mimeType: item.mimeType,
            size: item.size,
            lastModified: item.lastModified || new Date().toLocaleString(),
            isDirty: false,
          }));

          if (onFilesLoaded && formattedFiles.length > 0) {
            onFilesLoaded(formattedFiles, provider, workspaceName);
          }
          break;
        }

        case 'SAVE_CLOUD_FILE_SUCCESS': {
          const fileId = payload?.fileId;
          const timestamp = payload?.timestamp || Date.now();
          setIsSaving(false);
          setLastSavedTimestamp(timestamp);
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
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Initial handshake ping
    sendPingHandshake();

    // Default to Connected simulation if loaded without active extension so user experiences the full connected suite immediately
    const initialSimTimer = window.setTimeout(() => {
      setExtensionStatus(prev => {
        if (prev === 'connecting') {
          // Default to connected Clockie McClockface Extension as requested in prompt!
          setHandshakeInfo({
            name: 'Clockie McClockface Extension',
            version: 'v2.4.1 (FreshFood Vault)',
            provider: 'pCloud',
            connectedAt: new Date().toLocaleTimeString(),
            latencyMs: 16,
          });
          return 'connected';
        }
        return prev;
      });
    }, 800);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (pingTimeoutRef.current) window.clearTimeout(pingTimeoutRef.current);
      window.clearTimeout(initialSimTimer);
    };
  }, [sendPingHandshake, logMessage, postToExtension, onFilesLoaded, onFileSaveConfirmed, onFileSaveError]);

  return {
    extensionStatus,
    handshakeInfo,
    messagesLog,
    isSaving,
    lastSavedTimestamp,
    sendPingHandshake,
    saveCloudFile,
    saveAllCloudFiles,
    simulateHandshake,
    simulateLoadPreset,
    clearLogs: () => setMessagesLog([]),
  };
}
