/**
 * Extension Bridge Inspector & Protocol v1.3 (H2_CLOUD_BRIDGE) Reference Modal.
 * Zero-URL session binding via per-tab sessionStorage and unified H2_CONNECT_REQ/RES,
 * showing launchedScope, drives (including hidden sidebar drives), accessMode,
 * all v1.3 capabilities, and refusal reasonCodes gracefully.
 *
 * Official Documentation:
 * - React: https://react.dev/reference/react
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 */

import React, { useState } from 'react';
import {
  X,
  Radio,
  Trash2,
  Terminal,
  ShieldCheck,
  FileCode,
  Plug,
  HardDrive,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { ExtensionStatus, ExtensionHandshakeInfo } from '../types/ide';
import { H2_SESSION_STORAGE_KEY } from '../utils/h2BridgeClient';

interface ExtensionBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  connectionError: string | null;
  connectionReasonCode: string | null;
  messagesLog: any[];
  onConnectBridge: () => void;
  onStopBridge: () => void;
  onClearLogs: () => void;
}

export const ExtensionBridgeModal: React.FC<ExtensionBridgeModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  extensionStatus,
  handshakeInfo,
  connectionError,
  connectionReasonCode,
  messagesLog,
  onConnectBridge,
  onStopBridge,
  onClearLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'protocol'>('status');

  if (!isOpen) return null;

  const capabilityEntries: Array<{ key: keyof NonNullable<ExtensionHandshakeInfo['capabilities']>; label: string }> = [
    { key: 'lazyTree', label: 'Lazy Tree' },
    { key: 'lazyRead', label: 'Lazy Read' },
    { key: 'listFolder', label: 'List Folder' },
    { key: 'workspaceTreeDepth', label: 'Tree Depth' },
    { key: 'multiDrive', label: 'Multi-Drive' },
    { key: 'driveRootSwitch', label: 'Drive Root Switch' },
    { key: 'save', label: 'Save Files' },
    { key: 'createFiles', label: 'Create Files' },
    { key: 'createFolders', label: 'Create Folders' },
    { key: 'deleteFiles', label: 'Delete Files' },
    { key: 'deleteFolders', label: 'Delete Folders' },
    { key: 'trashByDefault', label: 'Trash by Default' },
  ];

  const protocolMessages = [
    { type: 'Type 0: H2_BRIDGE_READY', direction: 'Extension -> Web App', desc: 'Emitted at document_start & DOMContentLoaded when bridge listeners are ready.' },
    { type: 'Type 1a/1b: H2_CONNECT_REQ / H2_CONNECT_RES', direction: 'Unified Startup', desc: 'Connects with previousSessionId from sessionStorage; returns sessionMode ("launched" | "direct"), launchedScope, accessMode, and drives.' },
    { type: 'Type 2a: H2_WORKSPACE_TREE_REQ / H2_WORKSPACE_TREE', direction: 'Bidirectional', desc: 'Requests depth-limited metadata trees with optional provider and driveRoot: true/false.' },
    { type: 'Type 2b/2c: H2_LIST_FOLDER_REQ / H2_LIST_FOLDER_RES', direction: 'Bidirectional', desc: 'Lazily expands folders with childrenLoaded: false (supports driveRoot switching).' },
    { type: 'Type 3/4: H2_READ_FILE_REQ / H2_READ_FILE_RES', direction: 'Concurrent Safe', desc: 'Lazily reads utf-8 or base64 file content (supports concurrent Promise.all calls).' },
    { type: 'Type 5/6: H2_SAVE_FILE_REQ / H2_SAVE_FILE_RES', direction: 'Readwrite Only', desc: 'Saves edits or creates files/subdirectories via relativePath, provider, and driveRoot.' },
    { type: 'Type 7/8: H2_DELETE_FILE_REQ / H2_DELETE_FILE_RES', direction: 'Readwrite Only', desc: 'Deletes or trashes individual files or folders.' },
    { type: 'Type 9a/9b: H2_DISCONNECT_REQ / H2_DISCONNECT_RES', direction: 'Bidirectional', desc: 'Tears down active session cleanly and clears sessionStorage.' },
  ];

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
                  H2_CLOUD_BRIDGE v1.3
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Zero-URL per-tab sessionStorage binding with unified H2_CONNECT_REQ startup over window.postMessage.
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
                  ? `Connected (${handshakeInfo?.sessionMode || 'direct'})`
                  : extensionStatus === 'connecting'
                  ? 'Connecting...'
                  : 'Disconnected'}
              </span>
            </div>

            {handshakeInfo?.accessMode === 'readonly' && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-red-950/70 text-red-300 border border-red-500/40">
                <Lock className="w-3 h-3" />
                Read-Only
              </span>
            )}

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
            {(extensionStatus === 'connected' || extensionStatus === 'connecting') && (
              <button
                onClick={onStopBridge}
                className="px-2.5 py-1 text-xs rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-700/60 transition"
              >
                Disconnect
              </button>
            )}

            <button
              onClick={onConnectBridge}
              className="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition flex items-center gap-1"
              title="Send H2_CONNECT_REQ (Protocol v1.3)"
            >
              <Plug className="w-3 h-3" />
              <span>Connect (H2_CONNECT_REQ)</span>
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
            Session, Drives & Stream ({messagesLog.length})
          </button>
          <button
            onClick={() => setActiveTab('protocol')}
            className={`px-4 py-2 border-b-2 font-medium transition ${
              activeTab === 'protocol'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Protocol v1.3 Specification
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0f0f11]">
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Connection refusal / authorization notice */}
              {connectionError && (
                <div className="p-4 rounded-xl border border-red-500/40 bg-red-950/30 flex items-start gap-3 text-xs text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-white">
                      Extension Connection Notice
                      {connectionReasonCode ? ` (${connectionReasonCode})` : ''}
                    </div>
                    <p className="text-red-200/90">{connectionError}</p>
                    {connectionReasonCode === 'ORIGIN_NOT_AUTHORIZED' && (
                      <p className="text-zinc-300 text-[11px]">
                        Authorize <code className="font-mono text-blue-300">{window.location.origin}</code> in the extension settings or launch directly from the File Manager.
                      </p>
                    )}
                    {connectionReasonCode === 'UNSUPPORTED_VERSION' && (
                      <p className="text-zinc-300 text-[11px]">
                        This web app requires H2_CLOUD_BRIDGE v1.3. Update your Clockie H2 extension to v1.3+.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Zero-URL Session Binding Summary */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-semibold text-zinc-200">Zero-URL Session Storage</div>
                  <div className="text-zinc-400 font-mono text-[11px] mt-0.5">
                    sessionStorage["{H2_SESSION_STORAGE_KEY}"] = {sessionId || 'null'}
                  </div>
                </div>
                {handshakeInfo?.launchedScope && (
                  <div className="text-right font-mono text-[11px] text-blue-300">
                    launchedScope: {handshakeInfo.launchedScope.provider}:{handshakeInfo.launchedScope.rootName} ({handshakeInfo.launchedScope.launchedItemType})
                  </div>
                )}
              </div>

              {/* Drives & Capabilities */}
              {handshakeInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2">
                    <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Capabilities ({handshakeInfo.accessMode || 'readwrite'})</span>
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

                  <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 space-y-2 text-xs font-mono text-zinc-300">
                    <h4 className="font-sans font-semibold text-zinc-200 flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-blue-400" />
                      <span>Connected Drives & Workspace</span>
                    </h4>
                    <div>Root: <span className="text-white">{handshakeInfo.rootName || '-'}</span></div>
                    <div>
                      Session Mode: <span className="text-blue-300">{handshakeInfo.sessionMode || 'direct'}</span>
                      {' | '}
                      Version: <span className="text-emerald-300">{handshakeInfo.version}</span>
                    </div>
                    {handshakeInfo.drives && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {Object.entries(handshakeInfo.drives).map(([drive, status]) => (
                          <span
                            key={drive}
                            className={`px-2 py-0.5 rounded text-[10.5px] border ${
                              status.connected
                                ? status.visible
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                                  : 'bg-blue-950/60 text-blue-300 border-blue-500/30'
                                : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                            }`}
                          >
                            {drive}: {status.connected ? (status.visible ? 'connected' : 'hidden-in-sidebar') : 'offline'}
                          </span>
                        ))}
                      </div>
                    )}
                    {handshakeInfo.stats && (
                      <div className="pt-1 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-emerald-400" />
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

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 max-h-[260px] overflow-y-auto font-mono text-xs space-y-2">
                  {messagesLog.length === 0 ? (
                    <div className="text-zinc-500 text-center py-6 italic text-[11px]">
                      No bridge messages recorded yet. Click Connect (H2_CONNECT_REQ) to test the extension bridge.
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
                <div className="font-semibold text-white">Zero-URL Session & Envelope Rules (v1.3)</div>
                <p>
                  URLs stay 100% clean (no <code className="text-red-300 font-mono">#h2Session</code> or{' '}
                  <code className="text-red-300 font-mono">?h2Session</code>). The active sessionId lives only in{' '}
                  <code className="text-emerald-300 font-mono">window.sessionStorage["{H2_SESSION_STORAGE_KEY}"]</code>.
                </p>
                <p>
                  Replies are accepted only when <code className="text-blue-300 font-mono">event.source === window</code>,{' '}
                  <code className="text-blue-300 font-mono">protocol === "H2_CLOUD_BRIDGE"</code>, and{' '}
                  <code className="text-blue-300 font-mono">__h2FromExtension === true</code>.
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
            <span className="text-emerald-400 font-semibold">H2_CLOUD_BRIDGE v1.3</span>
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
