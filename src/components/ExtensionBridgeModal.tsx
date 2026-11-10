import React, { useState } from 'react';
import { 
  X, 
  Radio, 
  Copy, 
  Check, 
  Trash2, 
  HardDrive, 
  Terminal,
  RotateCw,
  Code
} from 'lucide-react';
import { ExtensionStatus, ExtensionHandshakeInfo, BridgeMessage, CloudProvider } from '../types/ide';

interface ExtensionBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  messagesLog: BridgeMessage[];
  onSendPing: () => void;
  onSimulateHandshake: (connected: boolean, provider?: CloudProvider) => void;
  onSimulateLoadPreset: (preset: 'pcloud' | 'gdrive' | 'dropbox') => void;
  onClearLogs: () => void;
}

export const ExtensionBridgeModal: React.FC<ExtensionBridgeModalProps> = ({
  isOpen,
  onClose,
  extensionStatus,
  handshakeInfo,
  messagesLog,
  onSendPing,
  onSimulateHandshake,
  onSimulateLoadPreset,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'manifest' | 'contentScript' | 'backgroundScript'>('console');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(label);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const extensionManifestCode = `{
  "manifest_version": 3,
  "name": "Clockie McClockface - FreshFood Cloud IDE Bridge",
  "version": "2.4.1",
  "description": "Bi-directional cloud drive sync bridge for https://ide.freshfood.rocks",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "https://ide.freshfood.rocks/*",
    "http://localhost:*/*",
    "https://api.pcloud.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://ide.freshfood.rocks/*", "http://localhost:*/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}`;

  const extensionContentCode = `// Clockie McClockface - Content Script (content.js)
console.log("[Clockie McClockface] Bridge content.js active");

// 1. Relay SAVE_CLOUD_FILE / SAVE_ALL_FILES from IDE page to Extension Service Worker
window.addEventListener("message", (event) => {
  if (event.data?.source === "FRESHFOOD_MONARCH_IDE") {
    const action = event.data.action || event.data.type;
    console.log("[Content Script] Received from IDE:", action, event.data);

    chrome.runtime.sendMessage(event.data, (response) => {
      if (response) {
        window.postMessage(response, "*");
      }
    });
  }
});

// 2. Listen on BroadcastChannel for IDE events
if (typeof BroadcastChannel !== "undefined") {
  const bc = new BroadcastChannel("CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL");
  bc.onmessage = (event) => {
    if (event.data?.source === "FRESHFOOD_MONARCH_IDE") {
      chrome.runtime.sendMessage(event.data);
    }
  };
}

// 3. Relay confirmation back from Extension Service Worker to IDE page
chrome.runtime.onMessage.addListener((message) => {
  window.postMessage(message, "*");
});

// Handshake broadcast on tab load
window.postMessage({
  source: "CLOCKIE_MCCLOCKFACE_EXT",
  type: "PONG_HANDSHAKE",
  payload: {
    extensionName: "Clockie McClockface Extension",
    version: "2.4.1",
    cloudProvider: "pCloud",
    status: "ready"
  }
}, "*");
`;

  const extensionBackgroundCode = `// Clockie McClockface - Service Worker (background.js)
// Handles pCloud REST API persistence for SAVE_CLOUD_FILE

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message.type || message.action;

  if (type === "SAVE_CLOUD_FILE") {
    const { fileId, path, content, cloudProvider } = message.payload || message;
    console.log("[Background Worker] Saving to pCloud API:", path, content);

    // Call pCloud /uploadfile REST endpoint or Sync storage
    saveTopCloudDrive(path, content)
      .then(() => {
        // Send success message back to web app
        const reply = {
          source: "CLOCKIE_MCCLOCKFACE_EXT",
          type: "SAVE_CLOUD_FILE_SUCCESS",
          fileId: fileId,
          path: path,
          timestamp: Date.now()
        };

        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, reply);
        }
        sendResponse(reply);
      })
      .catch((err) => {
        const errorReply = {
          source: "CLOCKIE_MCCLOCKFACE_EXT",
          type: "SAVE_CLOUD_FILE_ERROR",
          fileId: fileId,
          error: err.message
        };
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, errorReply);
        }
        sendResponse(errorReply);
      });

    return true; // Keep response channel open for async fetch
  }
});

async function saveTopCloudDrive(filePath, fileContent) {
  // Example pCloud API upload endpoint using access token
  const token = await chrome.storage.local.get("pcloud_access_token");
  if (!token.pcloud_access_token) {
    console.warn("No pCloud access token found in extension storage, saving to extension sync storage");
    return chrome.storage.sync.set({ [filePath]: fileContent });
  }

  const formData = new FormData();
  formData.append("filename", filePath);
  formData.append("file", new Blob([fileContent], { type: "text/plain" }));

  const res = await fetch("https://api.pcloud.com/uploadfile", {
    method: "POST",
    headers: { Authorization: \`Bearer \${token.pcloud_access_token}\` },
    body: formData
  });

  return res.json();
}
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-[#18181b] border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden select-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Clockie McClockface Extension Bridge</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-zinc-800 border border-zinc-700 text-zinc-300 font-normal">
                  ide.freshfood.rocks
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Bi-directional cloud drive sync protocol for pCloud, Google Drive, & Dropbox.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Simulation Banner */}
        <div className="px-6 py-3 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              extensionStatus === 'connected'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                extensionStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`} />
              <span>
                {extensionStatus === 'connected'
                  ? '🟢 Connected to Clockie McClockface Extension'
                  : '🟡 Standalone Mode'}
              </span>
            </div>

            {handshakeInfo && (
              <span className="text-xs text-zinc-400 font-mono hidden sm:inline">
                Provider: <strong className="text-emerald-400">{handshakeInfo.provider}</strong> | Latency: {handshakeInfo.latencyMs}ms
              </span>
            )}
          </div>

          {/* Quick Simulation Toggles */}
          <div className="flex items-center gap-2">
            {extensionStatus === 'connected' ? (
              <button
                onClick={() => onSimulateHandshake(false)}
                className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
              >
                Switch to Standalone
              </button>
            ) : (
              <button
                onClick={() => onSimulateHandshake(true, 'pCloud')}
                className="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-black font-semibold transition"
              >
                Simulate Extension Connect
              </button>
            )}

            <button
              onClick={onSendPing}
              className="px-2.5 py-1 text-xs rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition flex items-center gap-1"
              title="Broadcast PING_HANDSHAKE"
            >
              <RotateCw className="w-3 h-3 text-emerald-400" />
              <span>Ping</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-zinc-800 bg-[#141416] text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('console')}
            className={`px-4 py-2 border-b-2 font-medium transition shrink-0 ${
              activeTab === 'console'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Live Bridge Console & Presets ({messagesLog.length})
          </button>
          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-4 py-2 border-b-2 font-medium transition shrink-0 ${
              activeTab === 'manifest'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            manifest.json
          </button>
          <button
            onClick={() => setActiveTab('contentScript')}
            className={`px-4 py-2 border-b-2 font-medium transition shrink-0 ${
              activeTab === 'contentScript'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            content.js (Bridge Relay)
          </button>
          <button
            onClick={() => setActiveTab('backgroundScript')}
            className={`px-4 py-2 border-b-2 font-medium transition shrink-0 ${
              activeTab === 'backgroundScript'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            background.js (pCloud API Persistence)
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0f0f11]">
          {activeTab === 'console' && (
            <div className="space-y-5">
              {/* Cloud Drive Test Payloads */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    <span>Simulate Cloud Drive Folder Payloads (LOAD_FILES_PAYLOAD)</span>
                  </h4>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Tests tree hydration from remote storage
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => onSimulateLoadPreset('pcloud')}
                    className="p-3 rounded-lg border border-zinc-800 hover:border-emerald-500/50 bg-zinc-950/60 hover:bg-zinc-850 text-left transition group"
                  >
                    <div className="text-xs font-semibold text-white group-hover:text-emerald-400 flex items-center justify-between">
                      <span>pCloud Vault</span>
                      <span className="text-[10px] text-emerald-400 font-mono">pCloud</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      Full TypeScript & Python suite with Markdown & SVG assets
                    </div>
                  </button>

                  <button
                    onClick={() => onSimulateLoadPreset('gdrive')}
                    className="p-3 rounded-lg border border-zinc-800 hover:border-blue-500/50 bg-zinc-950/60 hover:bg-zinc-850 text-left transition group"
                  >
                    <div className="text-xs font-semibold text-white group-hover:text-blue-400 flex items-center justify-between">
                      <span>Google Drive</span>
                      <span className="text-[10px] text-blue-400 font-mono">GDrive</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      ETL Data pipeline scripts and remote configuration
                    </div>
                  </button>

                  <button
                    onClick={() => onSimulateLoadPreset('dropbox')}
                    className="p-3 rounded-lg border border-zinc-800 hover:border-indigo-500/50 bg-zinc-950/60 hover:bg-zinc-850 text-left transition group"
                  >
                    <div className="text-xs font-semibold text-white group-hover:text-indigo-400 flex items-center justify-between">
                      <span>Dropbox</span>
                      <span className="text-[10px] text-indigo-400 font-mono">Dropbox</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      Multi-region sync configuration and client module
                    </div>
                  </button>
                </div>
              </div>

              {/* Message Log */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Bridge Protocol Event Stream</span>
                  </div>
                  <button
                    onClick={onClearLogs}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Stream</span>
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 max-h-[260px] overflow-y-auto font-mono text-xs space-y-2">
                  {messagesLog.length === 0 ? (
                    <div className="text-zinc-600 text-center py-6 italic text-[11px]">
                      No bridge messages recorded yet. Ping or save a file to see network events.
                    </div>
                  ) : (
                    messagesLog.map(msg => (
                      <div
                        key={msg.id}
                        className="p-2 rounded bg-zinc-900/80 border border-zinc-800/80 text-[11px] select-text"
                      >
                        <div className="flex items-center justify-between text-zinc-400 pb-1 mb-1 border-b border-zinc-800/60">
                          <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] ${
                            msg.direction === 'incoming'
                              ? 'bg-blue-950 text-blue-400 border border-blue-500/30'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {msg.direction}
                          </span>
                          <span className="font-semibold text-white">{msg.type}</span>
                          <span className="text-zinc-500 text-[10px]">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <pre className="text-zinc-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(msg.payload, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manifest' && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400 font-mono">manifest.json</span>
                <button
                  onClick={() => handleCopy(extensionManifestCode, 'manifest')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition"
                >
                  {copiedFile === 'manifest' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs overflow-x-auto select-text leading-relaxed">
                <code>{extensionManifestCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'contentScript' && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400 font-mono">content.js</span>
                <button
                  onClick={() => handleCopy(extensionContentCode, 'content')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition"
                >
                  {copiedFile === 'content' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs overflow-x-auto select-text leading-relaxed">
                <code>{extensionContentCode}</code>
              </pre>
            </div>
          )}

          {activeTab === 'backgroundScript' && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400 font-mono">background.js (pCloud API Persistence)</span>
                <button
                  onClick={() => handleCopy(extensionBackgroundCode, 'background')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition"
                >
                  {copiedFile === 'background' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs overflow-x-auto select-text leading-relaxed">
                <code>{extensionBackgroundCode}</code>
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Handshake Protocol:</span>
            <span className="text-emerald-400 font-mono font-semibold">PING_HANDSHAKE / LOAD_FILES_PAYLOAD / SAVE_CLOUD_FILE</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-black font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
