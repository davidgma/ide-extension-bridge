import React, { useState } from 'react';
import { 
  Radio, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Check, 
  Copy, 
  Trash2, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Terminal, 
  ChevronRight, 
  ChevronDown,
  Info,
  Bug,
  HelpCircle,
  RotateCw,
  HardDrive,
  Globe,
  Radio as Antenna,
  Server,
  Layers,
  Key
} from 'lucide-react';
import { BridgeMessage, ExtensionStatus, ExtensionHandshakeInfo } from '../types/ide';

interface ExtensionDebuggerProps {
  isOpen: boolean;
  messagesLog: BridgeMessage[];
  extensionStatus: ExtensionStatus;
  handshakeInfo: ExtensionHandshakeInfo | null;
  onClose: () => void;
  onClearLogs: () => void;
  onTestSaveRequest: () => void;
  onPingExtension: () => void;
}

export const ExtensionDebugger: React.FC<ExtensionDebuggerProps> = ({
  isOpen,
  messagesLog,
  extensionStatus,
  handshakeInfo,
  onClose,
  onClearLogs,
  onTestSaveRequest,
  onPingExtension,
}) => {
  const [filter, setFilter] = useState<'all' | 'outgoing' | 'incoming' | 'saves' | 'errors'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLogCopied, setIsLogCopied] = useState(false);
  const [showTargetDetails, setShowTargetDetails] = useState(true);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [height, setHeight] = useState(360);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ide.freshfood.rocks/';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ide.freshfood.rocks';
  const currentHost = typeof window !== 'undefined' ? window.location.host : 'ide.freshfood.rocks';
  const currentPort = typeof window !== 'undefined' ? (window.location.port || (window.location.protocol === 'https:' ? '443' : '80')) : '443';
  const hasChromeRuntime = typeof window !== 'undefined' && Boolean((window as any).chrome?.runtime?.sendMessage);

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
      extensionStatus,
      handshakeInfo,
      environment: {
        url: currentUrl,
        origin: currentOrigin,
        host: currentHost,
        port: currentPort,
        hasChromeRuntime,
      },
      dispatchChannels: {
        postMessageTarget: `window.postMessage(envelope, '*')`,
        broadcastChannel: 'CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL',
        customEvents: ['SAVE_CLOUD_FILE', 'FRESHFOOD_MONARCH_SAVE'],
        localStorageKey: 'FRESHFOOD_SAVE_REQUEST',
      },
      messagesCount: messagesLog.length,
      messages: messagesLog,
    };
    navigator.clipboard.writeText(JSON.stringify(debugReport, null, 2));
    setIsLogCopied(true);
    setTimeout(() => setIsLogCopied(false), 2000);
  };

  // Filter messages
  const filteredMessages = messagesLog.filter(msg => {
    if (filter === 'outgoing') return msg.direction === 'outgoing';
    if (filter === 'incoming') return msg.direction === 'incoming';
    if (filter === 'saves') return msg.type.includes('SAVE');
    if (filter === 'errors') return msg.type.includes('ERROR') || msg.status === 'error' || msg.status === 'timeout';
    return true;
  });

  const lastSaveRequest = messagesLog.find(m => m.direction === 'outgoing' && m.type === 'SAVE_CLOUD_FILE');
  const lastSaveResponse = messagesLog.find(m => m.direction === 'incoming' && (m.type === 'SAVE_CLOUD_FILE_SUCCESS' || m.type === 'SAVE_CLOUD_FILE_ERROR'));

  const pendingSavesCount = messagesLog.filter(
    m => m.direction === 'outgoing' && m.type === 'SAVE_CLOUD_FILE' && m.status === 'sent'
  ).length;

  return (
    <div 
      className="bg-[#121214] border-t-2 border-emerald-500/80 flex flex-col font-mono text-xs select-auto shadow-2xl z-40 relative"
      style={{ height: `${height}px` }}
    >
      {/* Resizable Top Border Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-2 w-full bg-emerald-500/50 hover:bg-emerald-400 cursor-ns-resize transition-colors flex items-center justify-center shrink-0 group"
        title="Drag up or down to resize Extension Bridge Debugger"
      >
        <div className="w-14 h-1 bg-emerald-300/80 rounded-full group-hover:bg-white transition-colors" />
      </div>

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#1a1a1e] border-b border-zinc-800 select-auto gap-2 shrink-0">
        {/* Left Status & Title */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
            <Bug className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-white text-xs tracking-tight">Extension Bridge Debugger</span>

          {/* Status Badge */}
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            extensionStatus === 'connected'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
              : extensionStatus === 'connecting'
              ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
              : 'bg-zinc-900 text-zinc-400 border-zinc-700'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              extensionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`} />
            <span>
              {extensionStatus === 'connected'
                ? `Connected (${handshakeInfo?.provider || 'Extension'})`
                : extensionStatus === 'connecting'
                ? 'Connecting...'
                : 'Standalone'}
            </span>
          </div>

          {/* Target Toggle */}
          <button
            onClick={() => setShowTargetDetails(!showTargetDetails)}
            className={`px-2 py-0.5 rounded text-[10px] border transition flex items-center gap-1 ${
              showTargetDetails ? 'bg-zinc-800 text-emerald-300 border-emerald-500/40' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Target Specs</span>
          </button>

          {/* Troubleshooting Toggle */}
          <button
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className={`px-2 py-0.5 rounded text-[10px] border transition flex items-center gap-1 ${
              showTroubleshooting ? 'bg-amber-950/80 text-amber-300 border-amber-500/50' : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
          >
            <HelpCircle className="w-3 h-3 text-amber-400" />
            <span>Troubleshoot Mismatch</span>
          </button>

          {/* Pending Save Warning Badge */}
          {pendingSavesCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 text-[10px] animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>{pendingSavesCount} Unacknowledged Save{pendingSavesCount > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 bg-zinc-900/90 rounded border border-zinc-800 p-0.5">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'all' ? 'bg-emerald-600 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({messagesLog.length})
          </button>
          <button
            onClick={() => setFilter('outgoing')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'outgoing' ? 'bg-emerald-600 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Outgoing ↗
          </button>
          <button
            onClick={() => setFilter('incoming')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'incoming' ? 'bg-emerald-600 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Incoming ↙
          </button>
          <button
            onClick={() => setFilter('saves')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'saves' ? 'bg-emerald-600 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Saves 💾
          </button>
          <button
            onClick={() => setFilter('errors')}
            className={`px-2 py-0.5 rounded text-[10px] transition ${
              filter === 'errors' ? 'bg-emerald-600 text-black font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Errors ⚠️
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTestSaveRequest}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-semibold text-[10.5px] transition shadow"
            title="Dispatch a test SAVE_CLOUD_FILE payload to extension"
          >
            <Send className="w-3 h-3" />
            <span>Test Save Payload</span>
          </button>

          <button
            onClick={onPingExtension}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[10.5px] transition"
            title="Ping Extension"
          >
            <RotateCw className="w-3 h-3 text-emerald-400" />
            <span>Ping</span>
          </button>

          <button
            onClick={handleCopyAllLogs}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[10.5px] transition"
            title="Copy full JSON debug log with transport metadata"
          >
            {isLogCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied Full Report</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Debug Log</span>
              </>
            )}
          </button>

          <button
            onClick={onClearLogs}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 rounded transition"
            title="Clear debug stream"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition"
            title="Close debug panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Target Destination & Location Specification Bar */}
      {showTargetDetails && (
        <div className="bg-[#161619] border-b border-zinc-800 p-2.5 px-3 text-[11px] space-y-1.5 shrink-0">
          <div className="flex items-center justify-between font-bold text-emerald-400 text-[11.5px]">
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              <span>Bridge Target Destination & Environment Metadata</span>
            </div>
            <span className="text-zinc-500 font-normal text-[10.5px]">
              Use these exact values in your Chrome Extension manifest & content script
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[10.5px]">
            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-zinc-500 text-[9.5px]">Active Page URL:</div>
              <div className="text-emerald-300 truncate font-semibold" title={currentUrl}>{currentUrl}</div>
            </div>

            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-zinc-500 text-[9.5px]">Origin & Host:Port</div>
              <div className="text-white truncate font-semibold">
                {currentOrigin} <span className="text-zinc-400">(Port: {currentPort})</span>
              </div>
            </div>

            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-zinc-500 text-[9.5px]">postMessage Target Window:</div>
              <div className="text-blue-300 truncate font-semibold">window.postMessage(msg, '*')</div>
            </div>

            <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800">
              <div className="text-zinc-500 text-[9.5px]">Broadcast Channel Name:</div>
              <div className="text-purple-300 truncate font-semibold">CLOCKIE_MCCLOCKFACE_BRIDGE_CHANNEL</div>
            </div>
          </div>
        </div>
      )}

      {/* Troubleshooting Explanation Panel */}
      {showTroubleshooting && (
        <div className="bg-amber-950/30 border-b border-amber-500/40 p-3 text-[11px] text-amber-200 space-y-2 shrink-0">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Why is your Chrome Extension not receiving these messages? (3 Step Troubleshooting Checklist)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10.5px] leading-relaxed">
            <div className="p-2 rounded bg-black/50 border border-amber-500/30">
              <div className="font-bold text-white mb-1">1. Check manifest.json "matches"</div>
              <p className="text-zinc-300">
                Extension content scripts only inject on allowed domains. Your extension's <code className="text-amber-300 font-mono">manifest.json</code> content scripts must include:
              </p>
              <pre className="mt-1 p-1 bg-zinc-900 rounded text-emerald-400 font-mono text-[9.5px] overflow-x-auto">
                {`"matches": [\n  "${currentOrigin}/*",\n  "http://localhost:*/*"\n]`}
              </pre>
            </div>

            <div className="p-2 rounded bg-black/50 border border-amber-500/30">
              <div className="font-bold text-white mb-1">2. Check content.js Listener</div>
              <p className="text-zinc-300">
                Your <code className="text-amber-300 font-mono">content.js</code> must listen on <code className="text-emerald-400 font-mono">window</code> for messages with <code className="text-emerald-400 font-mono">source === "FRESHFOOD_MONARCH_IDE"</code>:
              </p>
              <pre className="mt-1 p-1 bg-zinc-900 rounded text-emerald-400 font-mono text-[9.5px] overflow-x-auto">
                {`window.addEventListener("message", (e) => {\n  if (e.data?.source === "FRESHFOOD_MONARCH_IDE") {\n    chrome.runtime.sendMessage(e.data);\n  }\n});`}
              </pre>
            </div>

            <div className="p-2 rounded bg-black/50 border border-amber-500/30">
              <div className="font-bold text-white mb-1">3. Check Extension Service Worker</div>
              <p className="text-zinc-300">
                In <code className="text-amber-300 font-mono">background.js</code>, listen for <code className="text-emerald-400 font-mono">chrome.runtime.onMessage</code> and reply with <code className="text-emerald-400 font-mono">SAVE_CLOUD_FILE_SUCCESS</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Tip Banner if Save is Unacknowledged */}
      {lastSaveRequest && !lastSaveResponse && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-3 py-1 text-[11px] text-amber-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Diagnostic Warning:</strong> Dispatched <code className="text-amber-300 font-bold">SAVE_CLOUD_FILE</code> at {lastSaveRequest.formattedTime} to <code className="text-emerald-300 font-bold">{currentOrigin}</code>, but no reply was received from extension.
            </span>
          </div>
          <button
            onClick={() => setShowTroubleshooting(true)}
            className="text-[10px] underline text-amber-300 hover:text-white font-mono shrink-0 ml-2"
          >
            Show Manifest Fix Instructions
          </button>
        </div>
      )}

      {/* Main Debug Stream List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#0b0b0d]">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs italic space-y-2">
            <div>No extension communication logged yet. Click 'Test Save Payload' or 'Save' to inspect network messages.</div>
            <div className="text-[11px] text-zinc-600 font-mono">
              Target Origin: {currentOrigin} | postMessage Window Target: window
            </div>
          </div>
        ) : (
          filteredMessages.map(msg => {
            const isExpanded = Boolean(expandedIds[msg.id]);
            const isOutgoing = msg.direction === 'outgoing';
            const isError = msg.type.includes('ERROR') || msg.status === 'error';
            const isSave = msg.type.includes('SAVE');
            const info = msg.dispatchInfo;

            return (
              <div
                key={msg.id}
                onClick={() => toggleExpand(msg.id)}
                className={`rounded border transition cursor-pointer text-[11px] ${
                  isError
                    ? 'bg-red-950/20 border-red-500/40 hover:border-red-400'
                    : isSave
                    ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-400/60'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Row Header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 select-auto">
                  <div className="flex items-center gap-2 truncate">
                    {/* Expand icon */}
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
                    )}

                    {/* Time */}
                    <span className="text-zinc-400 font-mono text-[10px] shrink-0">
                      {msg.formattedTime}
                    </span>

                    {/* Direction Badge */}
                    <span className={`px-1.5 py-0.2 rounded font-bold text-[9px] flex items-center gap-1 shrink-0 ${
                      isOutgoing
                        ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isOutgoing ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                      <span>{isOutgoing ? 'Out' : 'In'}</span>
                    </span>

                    {/* Channel Badge */}
                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[9px] font-mono shrink-0">
                      {msg.channel || 'postMessage'}
                    </span>

                    {/* Action / Message Type */}
                    <span className={`font-semibold font-mono truncate ${
                      isError ? 'text-red-400' : isSave ? 'text-emerald-300' : 'text-white'
                    }`}>
                      {msg.type}
                    </span>
                  </div>

                  {/* Right Status / Roundtrip */}
                  <div className="flex items-center gap-2 shrink-0">
                    {msg.roundtripMs !== undefined && (
                      <span className="text-zinc-500 text-[10px] font-mono">
                        {msg.roundtripMs}ms
                      </span>
                    )}

                    <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold ${
                      msg.status === 'acknowledged' || msg.status === 'received'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : msg.status === 'error' || msg.status === 'timeout'
                        ? 'bg-red-950 text-red-400 border border-red-500/30'
                        : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                    }`}>
                      {msg.status || 'sent'}
                    </span>

                    <button
                      onClick={e => handleCopyMessage(msg, e)}
                      className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition"
                      title="Copy message JSON"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Payload & Destination Inspector */}
                {isExpanded && (
                  <div className="p-3 bg-black/80 border-t border-zinc-800/80 font-mono text-[10.5px] space-y-3">
                    {/* Destination & Transport Specifications */}
                    {info && (
                      <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 space-y-1">
                        <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1.5 mb-1">
                          <Globe className="w-3 h-3" />
                          <span>Dispatch Target Location & Transport Details:</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-zinc-300">
                          <div>Target URL: <span className="text-emerald-300 font-bold">{info.url}</span></div>
                          <div>Target Origin: <span className="text-white font-bold">{info.origin}</span></div>
                          <div>Target Host & Port: <span className="text-white font-bold">{info.host} (Port: {info.port})</span></div>
                          <div>postMessage Target: <span className="text-blue-300 font-bold">{info.postMessageTarget}</span></div>
                          <div>BroadcastChannel: <span className="text-purple-300 font-bold">{info.broadcastChannelName}</span></div>
                          <div>Custom DOM Events: <span className="text-amber-300 font-bold">{info.customEventNames.join(', ')}</span></div>
                          <div>localStorage Key: <span className="text-teal-300 font-bold">{info.localStorageKey || 'N/A'}</span></div>
                          <div>Chrome Extension API in Context: <span className={info.chromeRuntimeAvailable ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>{info.chromeRuntimeAvailable ? 'Available' : 'No (Injected content script required)'}</span></div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-zinc-400 text-[10px] mb-1 font-bold tracking-wider">
                        Payload Details:
                      </div>
                      <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-850 text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        <code>{JSON.stringify(msg.payload, null, 2)}</code>
                      </pre>
                    </div>

                    {msg.response && (
                      <div>
                        <div className="text-zinc-400 text-[10px] mb-1 font-bold tracking-wider">
                          Extension Response:
                        </div>
                        <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-850 text-blue-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          <code>{JSON.stringify(msg.response, null, 2)}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Instructions Bar */}
      <div className="px-3 py-1 bg-[#18181c] border-t border-zinc-800/80 flex items-center justify-between text-[10.5px] text-zinc-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Active Channels:</span>
          <span className="text-emerald-400">window.postMessage</span>
          <span>•</span>
          <span className="text-emerald-400">BroadcastChannel</span>
          <span>•</span>
          <span className="text-emerald-400">CustomEvent</span>
          <span>•</span>
          <span className="text-emerald-400">localStorage</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Active Origin: <strong className="text-zinc-200">{currentOrigin}</strong></span>
        </div>
      </div>
    </div>
  );
};
