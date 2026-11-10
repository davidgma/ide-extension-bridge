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
  HardDrive
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

  if (!isOpen) return null;

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
    <div className="h-64 bg-[#121214] border-t-2 border-emerald-500/80 flex flex-col font-mono text-xs select-text shadow-2xl z-40">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#1a1a1e] border-b border-zinc-800 select-none gap-2">
        {/* Left Status & Title */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
            <Bug className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-white text-xs tracking-tight">EXTENSION BRIDGE DEBUGGER</span>

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
            title="Copy full JSON debug log"
          >
            {isLogCopied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
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

      {/* Diagnostics Tip Banner if Save is Unacknowledged */}
      {lastSaveRequest && !lastSaveResponse && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-3 py-1 text-[11px] text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              <strong>Diagnostic Notice:</strong> Sent <code className="text-amber-300 font-bold">SAVE_CLOUD_FILE</code> at {lastSaveRequest.formattedTime}, but no <code className="text-emerald-300 font-bold">SAVE_CLOUD_FILE_SUCCESS</code> was returned by the extension.
            </span>
          </div>
          <span className="text-[10px] text-amber-400/80 italic font-mono hidden md:inline">
            Verify content.js relays chrome.runtime.sendMessage to extension service worker
          </span>
        </div>
      )}

      {/* Main Debug Stream List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#0b0b0d]">
        {filteredMessages.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs italic">
            No extension communication logged yet. Click 'Test Save Payload' or 'Save' to inspect network messages.
          </div>
        ) : (
          filteredMessages.map(msg => {
            const isExpanded = Boolean(expandedIds[msg.id]);
            const isOutgoing = msg.direction === 'outgoing';
            const isError = msg.type.includes('ERROR') || msg.status === 'error';
            const isSave = msg.type.includes('SAVE');

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
                <div className="flex items-center justify-between px-2.5 py-1.5 select-none">
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
                    <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] flex items-center gap-1 shrink-0 ${
                      isOutgoing
                        ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isOutgoing ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                      <span>{isOutgoing ? 'OUT' : 'IN'}</span>
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

                    <span className={`px-1.5 py-0.2 rounded text-[9.5px] uppercase font-bold ${
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

                {/* Expanded Payload Inspector */}
                {isExpanded && (
                  <div className="p-3 bg-black/80 border-t border-zinc-800/80 font-mono text-[10.5px]">
                    <div className="text-zinc-400 text-[10px] mb-1 uppercase font-bold tracking-wider">
                      Payload Details:
                    </div>
                    <pre className="p-2.5 rounded bg-zinc-950 border border-zinc-850 text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      <code>{JSON.stringify(msg.payload, null, 2)}</code>
                    </pre>

                    {msg.response && (
                      <div className="mt-2">
                        <div className="text-zinc-400 text-[10px] mb-1 uppercase font-bold tracking-wider">
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
      <div className="px-3 py-1 bg-[#18181c] border-t border-zinc-800/80 flex items-center justify-between text-[10.5px] text-zinc-400">
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
          <span>Domain: <strong className="text-zinc-200">ide.freshfood.rocks</strong></span>
        </div>
      </div>
    </div>
  );
};
