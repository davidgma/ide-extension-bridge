import React from 'react';
import { Terminal, X, Trash2, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { RunResult } from '../utils/codeRunner';

interface OutputConsoleProps {
  isOpen: boolean;
  activeFile: string;
  result: RunResult | null;
  isRunning: boolean;
  onClose: () => void;
  onClear: () => void;
  onRunAgain: () => void;
}

export const OutputConsole: React.FC<OutputConsoleProps> = ({
  isOpen,
  activeFile,
  result,
  isRunning,
  onClose,
  onClear,
  onRunAgain,
}) => {
  if (!isOpen) return null;

  return (
    <div className="h-44 bg-slate-50 dark:bg-[#141416] border-t border-slate-200 dark:border-zinc-800 flex flex-col font-mono text-xs select-text">
      {/* Console Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 select-auto">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-slate-800 dark:text-zinc-200 text-[11px]">Output Terminal</span>
          <span className="text-slate-500 dark:text-zinc-500 text-[10px]">({activeFile})</span>
          {result && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
              result.success
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
            }`}>
              {result.success ? 'Passed' : 'Error'} ({result.executionTimeMs}ms)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onRunAgain}
            disabled={isRunning}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] transition disabled:opacity-50"
            title="Re-run active code"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>Run</span>
          </button>
          <button
            onClick={onClear}
            className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded transition"
            title="Clear output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded transition"
            title="Close console"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Output Content */}
      <div className="flex-1 p-3 overflow-y-auto space-y-1 bg-white dark:bg-[#0f0f11] text-[11.5px] leading-relaxed">
        {isRunning ? (
          <div className="text-blue-600 dark:text-blue-400">Executing {activeFile}...</div>
        ) : !result ? (
          <div className="text-slate-500 dark:text-zinc-500 italic">No output yet. Click 'Run Code' above to execute this file.</div>
        ) : (
          result.logs.map((log, idx) => (
            <div
              key={idx}
              className={`${
                log.includes('[ERROR]') || log.includes('Error')
                  ? 'text-red-600 dark:text-red-400'
                  : log.includes('[WARN]')
                  ? 'text-blue-700 dark:text-blue-300'
                  : log.startsWith('✓')
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-slate-700 dark:text-zinc-300'
              }`}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
