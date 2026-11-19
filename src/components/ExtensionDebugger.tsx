/**
 * Extension Bridge Debugger Drawer for Clockie H2 Bridge Protocol v1.3 (H2_CLOUD_BRIDGE).
 * Displays live outgoing/incoming message packets, requestId correlation, per-tab sessionStorage ID,
 * sessionMode (launched/direct), launchedScope, driveRoot, accessMode, connected drives,
 * negotiated capabilities, and window.postMessage target diagnostics.
 *
 * Official Documentation:
 * - Window.postMessage: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * - Window.sessionStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage
 */

import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  Copy,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  Info,
  Bug,
  Globe,
  Plug,
} from 'lucide-react';
import { BridgeMessage, ExtensionStatus, ExtensionHandshakeInfo } from '../types/ide';
import { H2_SESSION_STORAGE_KEY } from '../utils/h2BridgeClient';

interface ExtensionDebuggerProps {
  isOpen: boolean;
  sessionId: string | null;
  messagesLog: BridgeMessage[];
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  connectionError: string | null;
  connectionReasonCode: string | null;
  onClose: () => void;
  onClearLogs: () => void;
  onConnectBridge: () => void;
}

export const ExtensionDebugger: React.FC<ExtensionDebuggerProps> = ({
  isOpen,
  sessionId,
  messagesLog,
  extensionStatus,
  handshakeInfo,
  connectionError,
  connectionReasonCode,
  onClose,
  onClearLogs,
  onConnectBridge,
}) => {
  const [filter, setFilter] = useState<'all' | 'outgoing' | 'incoming' | 'fileOps' | 'errors'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLogCopied, setIsLogCopied] = useState(false);
  const [showTargetDetails, setShowTargetDetails] = useState(true);
  const [height, setHeight] = useState(340);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ide.freshfood.rocks/';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ide.freshfood.rocks';
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'ide.freshfood.rocks';
  const currentPort =
    typeof window !== 'undefined'
      ? window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
      : '443';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(160, Math.min(window.innerHeight * 0.88, startHeight + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyMessage = (msg: BridgeMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(msg, null, 2));
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllLogs = () => {
    const debugReport = {
      timestamp: new Date().toISOString(),
      protocol: 'H2_CLOUD_BRIDGE',
      protocolVersion: '1.3',
      storageKey: H2_SESSION_STORAGE_KEY,
      sessionId,
      extensionStatus,
      connectionError,
      connectionReasonCode,
      handshakeInfo,
      environment: {
        url: currentUrl,
        origin: currentOrigin,
        host: currentHost,
        port: currentPort,
      },
      messagesCount: messagesLog.length,
      messages: messagesLog,
    };
    navigator.clipboard.writeText(JSON.stringify(debugReport, null, 2));
    setIsLogCopied(true);
    setTimeout(() => setIsLogCopied(false), 2000);
  };

  const filteredMessages = messagesLog.filter(msg => {
    if (filter === 'outgoing') return msg.direction === 'outgoing';
    if (filter === 'incoming') return msg.direction === 'incoming';
    if (filter === 'fileOps') {
      return (
        msg.type.includes('READ_FILE') ||
        msg.type.includes('SAVE_FILE') ||
        msg.type.includes('DELETE_FILE') ||
        msg.type.includes('TREE') ||
        msg.type.includes('LIST_FOLDER')
      );
    }
    if (filter === 'errors') {
      return (
        msg.type.includes('ERROR') ||
        msg.type.includes('FAILED') ||
        msg.type.includes('REFUSED') ||
        msg.status === 'error' ||
        msg.status === 'timeout'
      );
    }
    return true;
  });

  return (
    <div
      className="bg-slate-50 dark:bg-[#121214] border-t-2 border-emerald-500/80 flex flex-col font-mono text-xs select-auto shadow-2xl z-40 relative"
      style={{ height: `${height}px` }}
    >
      {/* Resizable Top Border Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-2 w-full bg-emerald-500/40 dark:bg-emerald-500/50 hover:bg-emerald-500 dark:hover:bg-emerald-400 cursor-ns-resize transition-colors flex items-center justify-center shrink-0 group"
        title="Drag up or down to resize Extension Bridge Debugger"
      >
        <div className="w-14 h-1 bg-emerald-700/70 dark:bg-emerald-300/80 rounded-full group-hover:bg-white transition-colors" />
      </div>

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-[#1a1a1e] border-b border-slate-200 dark:border-zinc-800 select-auto gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
            <Bug className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-xs tracking-tight">
            Extension Bridge Debugger (v1.3)
          </span>

          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
              extensionStatus === 'connected'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 dark:border-emerald-500/50'
                : extensionStatus === 'connecting'
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-500/40 dark:border-blue-500/50'
                : connectionReasonCode
                ? 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-500/40 dark:border-red-500/50'
                : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                extensionStatus === 'connected'
                  ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                  : extensionStatus === 'connecting'
                  ? 'bg-blue-500 dark:bg-blue-400 animate-pulse'
                  : connectionReasonCode
                  ? 'bg-red-500 dark:bg-red-400'
                  : 'bg-slate-400 dark:bg-zinc-500'
              }`}
            />
            <span>
              {extensionStatus === 'connected'
                ? `${handshakeInfo?.sessionMode || 'connected'} • ${handshakeInfo?.accessMode || 'readwrite'} (${handshakeInfo?.provider || 'extension'})`
                : extensionStatus === 'connecting'
                ? 'Connecting...'
                : connectionReasonCode || 'Standalone'}
            </span>
          </div>

          <button
            onClick={() => setShowTargetDetails(!showTargetDetails)}
            className={`px-2 py-0.5 rounded text-[10px] border transition flex items-center gap-1 ${
              showTargetDetails
                ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs'
                : 'bg-slate-200/70 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-300 dark:border-zinc-800'
            }`}
          >
            <Globe className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Session & Target Specs</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-900/90 rounded border border-slate-200 dark:border-zinc-800 p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'all' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({messagesLog.length})
          </button>
          <button
            onClick={() => setFilter('outgoing')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'outgoing' ? 'bg-blue-600 text-white font-bold' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Outgoing ↗
          </button>
          <button
            onClick={() => setFilter('incoming')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'incoming' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Incoming ↙
          </button>
          <button
            onClick={() => setFilter('fileOps')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'fileOps' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tree / File Ops
          </button>
          <button
            onClick={() => setFilter('errors')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'errors' ? 'bg-red-600 text-white font-bold' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Errors
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onConnectBridge}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10.5px] transition"
            title="Send H2_CONNECT_REQ (Protocol v1.3)"
          >
            <Plug className="w-3 h-3" />
            <span>Connect (H2_CONNECT_REQ)</span>
          </button>

          <button
            onClick={handleCopyAllLogs}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 text-[10.5px] transition"
            title="Copy full JSON debug log"
          >
            {isLogCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Log</span>
              </>
            )}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded transition"
            title="Clear debug stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded transition"
            title="Close debug panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Target Destination & H2 Session Bar */}
      {showTargetDetails && (
        <div className="bg-slate-100/80 dark:bg-[#161619] border-b border-slate-200 dark:border-zinc-800 p-2.5 px-3 text-[11px] space-y-1.5 shrink-0">
          {connectionError && (
            <div className="p-2 rounded bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-200 text-[10.5px]">
              {connectionReasonCode ? `[${connectionReasonCode}] ` : ''}
              {connectionError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-[10.5px]">
            <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-slate-500 dark:text-zinc-500 text-[9.5px]">Protocol & Mode:</div>
              <div className="text-emerald-700 dark:text-emerald-300 font-semibold">
                H2_CLOUD_BRIDGE v1.3 ({handshakeInfo?.sessionMode || 'unconnected'})
              </div>
            </div>

            <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-slate-500 dark:text-zinc-500 text-[9.5px]">
                sessionStorage ({H2_SESSION_STORAGE_KEY}):
              </div>
              <div className="text-slate-900 dark:text-white truncate font-semibold" title={sessionId || 'None active'}>
                {sessionId || 'No active session'}
              </div>
            </div>

            <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-slate-500 dark:text-zinc-500 text-[9.5px]">Origin & Access Mode:</div>
              <div className="text-blue-700 dark:text-blue-300 truncate font-semibold">
                {currentOrigin} ({handshakeInfo?.accessMode || 'readwrite'})
              </div>
            </div>

            <div className="p-1.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div className="text-slate-500 dark:text-zinc-500 text-[9.5px]">Scope & Drive Root:</div>
              <div className="text-emerald-700 dark:text-emerald-300 truncate font-semibold">
                {handshakeInfo?.launchedScope
                  ? `${handshakeInfo.launchedScope.provider}:${handshakeInfo.launchedScope.rootName} (driveRoot: ${handshakeInfo.driveRootActive ? 'true' : 'false'})`
                  : `provider: ${handshakeInfo?.provider || 'none'}`}
              </div>
            </div>
          </div>

          {handshakeInfo?.drives && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-zinc-400 pt-1">
              <span>Drives:</span>
              {Object.entries(handshakeInfo.drives).map(([drive, st]) => (
                <span
                  key={drive}
                  className={`px-1.5 py-0.2 rounded border ${
                    st.connected
                      ? st.visible
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-500/30'
                      : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  {drive}: {st.connected ? (st.visible ? 'connected' : 'connected (hidden)') : 'offline'}
                </span>
              ))}
            </div>
          )}

          {handshakeInfo?.capabilities && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-zinc-400">
              <span>Capabilities:</span>
              {Object.entries(handshakeInfo.capabilities).map(([cap, enabled]) => (
                <span
                  key={cap}
                  className={`px-1.5 py-0.2 rounded border ${
                    enabled
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-500 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  {cap}: {enabled ? 'true' : 'false'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Debug Stream List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white dark:bg-[#0b0b0d]">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-zinc-500 text-xs italic space-y-2">
            <div>No H2_CLOUD_BRIDGE communication logged yet.</div>
            <div className="text-[11px] text-slate-400 dark:text-zinc-600 font-mono">
              Click Connect (H2_CONNECT_REQ) to start a v1.3 session over window.postMessage.
            </div>
          </div>
        ) : (
          filteredMessages.map(msg => {
            const isExpanded = Boolean(expandedIds[msg.id]);
            const isOutgoing = msg.direction === 'outgoing';
            const isError =
              msg.type.includes('ERROR') ||
              msg.type.includes('FAILED') ||
              msg.type.includes('REFUSED') ||
              msg.type.includes('TIMEOUT') ||
              msg.status === 'error' ||
              msg.status === 'timeout';
            const isFileOp =
              msg.type.includes('READ_FILE') ||
              msg.type.includes('SAVE_FILE') ||
              msg.type.includes('DELETE_FILE') ||
              msg.type.includes('TREE') ||
              msg.type.includes('LIST_FOLDER');
            const info = msg.dispatchInfo;

            return (
              <div
                key={msg.id}
                onClick={() => toggleExpand(msg.id)}
                className={`rounded border transition cursor-pointer text-[11px] ${
                  isError
                    ? 'bg-red-50/80 dark:bg-red-950/20 border-red-300 dark:border-red-500/40 hover:border-red-500 dark:hover:border-red-400'
                    : isFileOp
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-400/60'
                    : 'bg-slate-50 dark:bg-zinc-900/50 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 select-auto">
                  <div className="flex items-center gap-2 truncate">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-slate-500 dark:text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-500 dark:text-zinc-400 shrink-0" />
                    )}

                    <span className="text-slate-500 dark:text-zinc-400 font-mono text-[10px] shrink-0">
                      {msg.formattedTime}
                    </span>

                    <span
                      className={`px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-1 shrink-0 ${
                        isOutgoing
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                          : msg.direction === 'incoming'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30'
                      }`}
                    >
                      {isOutgoing ? (
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      ) : msg.direction === 'incoming' ? (
                        <ArrowDownLeft className="w-2.5 h-2.5" />
                      ) : (
                        <Info className="w-2.5 h-2.5" />
                      )}
                      <span>
                        {isOutgoing ? 'Out' : msg.direction === 'incoming' ? 'In' : 'Event'}
                      </span>
                    </span>

                    <span
                      className={`font-semibold font-mono truncate ${
                        isError
                          ? 'text-red-700 dark:text-red-400'
                          : isFileOp
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {msg.type}
                    </span>

                    {msg.requestId && (
                      <span className="text-slate-500 dark:text-zinc-500 font-mono text-[10px] truncate hidden sm:inline">
                        [{msg.requestId}]
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {msg.roundtripMs !== undefined && (
                      <span className="text-slate-500 dark:text-zinc-500 text-[10px] font-mono">
                        {msg.roundtripMs}ms
                      </span>
                    )}

                    <span
                      className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                        msg.status === 'received'
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : msg.status === 'error' || msg.status === 'timeout'
                          ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                          : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30'
                      }`}
                    >
                      {msg.status || 'sent'}
                    </span>

                    <button
                      onClick={e => handleCopyMessage(msg, e)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
                      title="Copy message JSON"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 bg-slate-100 dark:bg-black/80 border-t border-slate-200 dark:border-zinc-800/80 font-mono text-[10.5px] space-y-3">
                    {info && (
                      <div className="p-2.5 rounded bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1">
                        <div className="text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1.5 mb-1">
                          <Globe className="w-3 h-3" />
                          <span>Dispatch Target & Session Details:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-700 dark:text-zinc-300">
                          <div>
                            Target URL: <span className="text-emerald-700 dark:text-emerald-300 font-bold">{info.url}</span>
                          </div>
                          <div>
                            Target Origin: <span className="text-slate-900 dark:text-white font-bold">{info.origin}</span>
                          </div>
                          <div>
                            postMessage Target:{' '}
                            <span className="text-blue-700 dark:text-blue-300 font-bold">{info.postMessageTarget}</span>
                          </div>
                          <div>
                            Session ID:{' '}
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                              {msg.sessionId || info.sessionId || 'none'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-slate-600 dark:text-zinc-400 text-[10px] mb-1 font-bold tracking-wider">
                        Message Envelope:
                      </div>
                      <pre className="p-2.5 rounded bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-emerald-700 dark:text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        <code>{JSON.stringify(msg.payload, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1 bg-slate-100 dark:bg-[#18181c] border-t border-slate-200 dark:border-zinc-800/80 flex items-center justify-between text-[10.5px] text-slate-600 dark:text-zinc-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Transport:</span>
          <span className="text-emerald-700 dark:text-emerald-400">window.postMessage(envelope, window.location.origin)</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            Active Origin: <strong className="text-slate-900 dark:text-zinc-200">{currentOrigin}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
