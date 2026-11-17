/**
 * Extension Bridge Inspector & Protocol v1.1 (H2_CLOUD_BRIDGE) Reference Modal.
 * Displays real-time session diagnostics, negotiated capabilities, workspace stats,
 * live message logs, and protocol specification without any mock presets.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Lucide React Icons: https://lucide.dev/guide/packages/lucide-react
 */

import React, { useState } from 'react';
import {
  X,
  Radio,
  Trash2,
  Terminal,
  RotateCw,
  ShieldCheck,
  FileCode,
  Plug,
} from 'lucide-react';
import { ExtensionStatus, ExtensionHandshakeInfo, BridgeMessage } from '../types/ide';

interface ExtensionBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  messagesLog: BridgeMessage[];
  onStartBridge: (explicitSessionId?: string) => void;
  onStopBridge: () => void;
  onClearLogs: () => void;
}

export const ExtensionBridgeModal: React.FC<ExtensionBridgeModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  extensionStatus,
  handshakeInfo,
  messagesLog,
  onStartBridge,
  onStopBridge,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'protocol'>('status');
  const [manualSid, setManualSid] = useState('');

  if (!isOpen) return null;

  const capabilityEntries: Array<{ key: keyof NonNullable<ExtensionHandshakeInfo['capabilities']>; label: string }> = [
    { key: 'lazyRead', label: 'Lazy Read' },
    { key: 'save', label: 'Save Files' },
    { key: 'createFiles', label: 'Create Files' },
    { key: 'createFolders', label: 'Create Folders' },
    { key: 'deleteFiles', label: 'Delete Files' },
    { key: 'deleteFolders', label: 'Delete Folders' },
    { key: 'trashByDefault', label: 'Trash by Default' },
  ];

  const protocolMessages = [
    { type: 'Type 1a: H2_HANDSHAKE_REQ', direction: 'Web App -> Extension', desc: 'Initiates session handshake using h2Session from URL hash/search.' },
    { type: 'Type 1b: H2_HANDSHAKE_RES', direction: 'Extension -> Web App', desc: 'Returns provider, rootName, primaryRelativePath, and capabilities.' },
    { type: 'Type 2: H2_WORKSPACE_TREE', direction: 'Extension -> Web App', desc: 'Pushes workspace folder & file metadata only (no file contents).' },
    { type: 'Type 3: H2_WORKSPACE_TREE_ACK', direction: 'Web App -> Extension', desc: 'Confirms receipt of workspace folder and file counts.' },
    { type: 'Type 4/5: H2_READ_FILE_REQ / RES', direction: 'Bidirectional', desc: 'Lazily fetches utf-8 or base64 content when a file is opened.' },
    { type: 'Type 6/7: H2_SAVE_FILE_REQ / RES', direction: 'Bidirectional', desc: 'Saves edits or creates files/subdirectories via relativePath.' },
    { type: 'Type 8/9: H2_DELETE_FILE_REQ / RES', direction: 'Bidirectional', desc: 'Deletes or trashes individual files or folders.' },
  ];

  const handleReconnect = (e: React.FormEvent) => {
    e.preventDefault();
    const sid = manualSid.trim() || undefined;
    onStartBridge(sid);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-[#18181b] border border-zinc-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden select-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Extension Bridge Inspector</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-950/70 border border-blue-500/40 text-blue-300 font-normal">
                  H2_CLOUD_BRIDGE v1.1
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Handshake-only session bridge over window.postMessage for cloud workspaces.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            title="Close inspector"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-3 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                extensionStatus === 'connected'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : extensionStatus === 'connecting'
                  ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                  : 'bg-red-950/60 text-red-300 border-red-500/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  extensionStatus === 'connected'
                    ? 'bg-emerald-400'
                    : extensionStatus === 'connecting'
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
              <span>
                {extensionStatus === 'connected'
                  ? 'Connected to Extension'
                  : extensionStatus === 'connecting'
                  ? 'Performing Handshake...'
                  : 'Disconnected'}
              </span>
            </div>

            <span className="text-xs text-zinc-400 font-mono">
              Session: <strong className="text-zinc-200">{sessionId || 'none'}</strong>
            </span>

            {handshakeInfo && (
              <span className="text-xs text-zinc-400 font-mono">
                Provider: <strong className="text-emerald-400">{handshakeInfo.provider}</strong>
                {typeof handshakeInfo.latencyMs === 'number' && (
                  <span className="text-zinc-500"> | {handshakeInfo.latencyMs}ms</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {extensionStatus === 'connected' || extensionStatus === 'connecting' ? (
              <button
                onClick={onStopBridge}
                className="px-2.5 py-1 text-xs rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 transition"
              >
                Disconnect
              </button>
            ) : null}

            <button
              onClick={() => onStartBridge(manualSid.trim() || undefined)}
              className="px-2.5 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition flex items-center gap-1"
              title="Send H2_HANDSHAKE_REQ"
            >
              <RotateCw className="w-3 h-3" />
              <span>Handshake</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-zinc-800 bg-[#141416] text-xs">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 border-b-2 font-medium transition ${
              activeTab === 'status'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Session & Message Stream ({messagesLog.length})
          </button>
          <button
            onClick={() => setActiveTab('protocol')}
            className={`px-4 py-2 border-b-2 font-medium transition ${
              activeTab === 'protocol'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Protocol v1.1 Specification
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0f0f11]">
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Attach Session ID Form */}
              <form
                onSubmit={handleReconnect}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center gap-3"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-300 font-medium">
                  <Plug className="w-4 h-4 text-blue-400" />
                  <span>Attach Session ID:</span>
                </div>
                <input
                  type="text"
                  value={manualSid}
                  onChange={e => setManualSid(e.target.value)}
                  placeholder={sessionId || 'Paste h2Session ID from #h2Session=...'}
                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                >
                  Connect Session
                </button>
              </form>

              {/* Capabilities & Stats */}
              {handshakeInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Negotiated Capabilities</span>
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {capabilityEntries.map(({ key, label }) => {
                        const enabled = handshakeInfo.capabilities?.[key];
                        return (
                          <span
                            key={key}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                              enabled
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                            }`}
                          >
                            {label}: {enabled ? 'yes' : 'no'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-1.5 text-xs font-mono text-zinc-300">
                    <h4 className="font-sans font-semibold text-zinc-200 flex items-center gap-2 mb-2">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      <span>Workspace Metadata</span>
                    </h4>
                    <div>Root: <span className="text-white">{handshakeInfo.rootName || '-'}</span></div>
                    <div>Launched Type: <span className="text-blue-400">{handshakeInfo.launchedItemType || '-'}</span></div>
                    {handshakeInfo.stats && (
                      <div>
                        Items:{' '}
                        <span className="text-emerald-400">
                          {handshakeInfo.stats.totalFolders} folders, {handshakeInfo.stats.totalFiles} files
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Live Message Log */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Real-Time Bridge Message Log</span>
                  </div>
                  <button
                    onClick={onClearLogs}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Log</span>
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 max-h-[280px] overflow-y-auto font-mono text-xs space-y-2">
                  {messagesLog.length === 0 ? (
                    <div className="text-zinc-500 text-center py-6 italic text-[11px]">
                      No bridge messages recorded yet. Open this app with #h2Session=&lt;id&gt; or start a handshake.
                    </div>
                  ) : (
                    messagesLog.map(msg => (
                      <div
                        key={msg.id}
                        className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-[11px] select-text"
                      >
                        <div className="flex items-center justify-between text-zinc-400 pb-1 mb-1 border-b border-zinc-800/60">
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                              msg.direction === 'incoming'
                                ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                                : msg.direction === 'outgoing'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-950 text-red-300 border border-red-500/30'
                            }`}
                          >
                            {msg.direction}
                          </span>
                          <span className="font-semibold text-white">{msg.type}</span>
                          <span className="text-zinc-500 text-[10px]">{msg.formattedTime}</span>
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

          {activeTab === 'protocol' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20 text-xs text-zinc-300 space-y-1.5">
                <div className="font-semibold text-white">Envelope & Validation Rules (v1.1)</div>
                <p>
                  Launch URL format: <code className="text-emerald-300 font-mono">#h2Session=&lt;sessionId&gt;</code>
                </p>
                <p>
                  Replies are accepted only when <code className="text-blue-300 font-mono">event.source === window</code>,{' '}
                  <code className="text-blue-300 font-mono">protocol === "H2_CLOUD_BRIDGE"</code>,{' '}
                  <code className="text-blue-300 font-mono">__h2FromExtension === true</code>, and{' '}
                  <code className="text-blue-300 font-mono">sessionId</code> matches the active session.
                </p>
              </div>

              <div className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800 bg-zinc-900/40">
                {protocolMessages.map(item => (
                  <div key={item.type} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <div className="font-mono font-semibold text-emerald-400">{item.type}</div>
                      <div className="text-zinc-400 mt-0.5">{item.desc}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-700 text-blue-300 font-mono text-[11px] shrink-0 self-start sm:self-center">
                      {item.direction}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2 font-mono">
            <span>Protocol:</span>
            <span className="text-emerald-400 font-semibold">H2_CLOUD_BRIDGE v1.1</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
