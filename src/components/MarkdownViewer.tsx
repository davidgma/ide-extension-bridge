import React from 'react';
import { Eye, FileCode, CheckCircle2, Copy, Check } from 'lucide-react';

interface MarkdownViewerProps {
  content: string;
  filename: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, filename }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Render markdown lines cleanly
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];
    let codeBlockIndex = 0;
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1).filter(r => !r.every(c => /^[-:| ]+$/.test(c)));
        elements.push(
          <div key={key} className="my-4 overflow-x-auto border border-zinc-700/60 rounded-lg">
            <table className="min-w-full divide-y divide-zinc-700/60 text-left text-xs">
              <thead className="bg-zinc-800/80 text-zinc-200">
                <tr>
                  {headerRow.map((col, i) => (
                    <th key={i} className="px-3 py-2 font-semibold border-r border-zinc-700/40 last:border-r-0">
                      {col.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-900/60">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-800/40 transition-colors">
                    {row.map((col, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-zinc-300 font-mono border-r border-zinc-800/60 last:border-r-0">
                        {renderInline(col.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    const renderInline = (inlineText: string) => {
      // Bold
      let parts: React.ReactNode[] = [inlineText];

      // Handle bold **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      // Handle inline code `code`
      const inlineCodeRegex = /`([^`]+)`/g;
      // Handle link [text](url)
      const linkRegex = /\[(.*?)\]\((.*?)\)/g;

      // Quick inline formatting
      return (
        <span dangerouslySetInnerHTML={{
          __html: inlineText
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="text-zinc-300 italic">$1</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 text-emerald-400 px-1.5 py-0.5 rounded text-[11px] font-mono border border-zinc-700/50">$1</code>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-emerald-400 hover:underline inline-flex items-center gap-1">$1</a>')
        }} />
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          if (inTable) flushTable(`table-${i}`);
          inCodeBlock = true;
          codeBlockLang = line.replace('```', '').trim();
          codeBlockLines = [];
        } else {
          inCodeBlock = false;
          const currentCode = codeBlockLines.join('\n');
          const blockIdx = codeBlockIndex++;
          elements.push(
            <div key={`code-${i}`} className="my-4 rounded-lg overflow-hidden border border-zinc-800 bg-[#121214]">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800/80 text-xs text-zinc-400">
                <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                  {codeBlockLang || 'code'}
                </span>
                <button
                  onClick={() => handleCopyCode(currentCode, blockIdx)}
                  className="flex items-center gap-1 text-[11px] hover:text-white px-2 py-0.5 rounded hover:bg-zinc-800 transition"
                >
                  {copiedIndex === blockIdx ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
                <code>{currentCode}</code>
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Tables
      if (line.startsWith('|') && line.endsWith('|')) {
        inTable = true;
        const cols = line.split('|').slice(1, -1);
        tableRows.push(cols);
        continue;
      } else if (inTable) {
        flushTable(`table-${i}`);
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-2xl font-bold text-white mt-6 mb-3 pb-2 border-b border-zinc-800 flex items-center gap-2">
            {line.replace('# ', '')}
          </h1>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-xl font-bold text-emerald-400 mt-5 mb-2.5 pb-1 border-b border-zinc-800/60">
            {line.replace('## ', '')}
          </h2>
        );
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-base font-semibold text-zinc-100 mt-4 mb-2 flex items-center gap-1.5">
            {line.replace('### ', '')}
          </h3>
        );
      } else if (line.startsWith('#### ')) {
        elements.push(
          <h4 key={i} className="text-sm font-semibold text-zinc-300 mt-3 mb-1">
            {line.replace('#### ', '')}
          </h4>
        );
      } else if (line.startsWith('---') || line.startsWith('***')) {
        elements.push(<hr key={i} className="my-6 border-zinc-800" />);
      } else if (line.startsWith('> ')) {
        elements.push(
          <blockquote key={i} className="border-l-4 border-emerald-500 pl-3 py-1 my-2 text-zinc-400 italic bg-emerald-950/10 rounded-r">
            {renderInline(line.replace('> ', ''))}
          </blockquote>
        );
      } else if (line.startsWith('- [ ] ') || line.startsWith('* [ ] ')) {
        elements.push(
          <div key={i} className="flex items-center gap-2 my-1 text-xs text-zinc-300">
            <input type="checkbox" disabled className="rounded border-zinc-700 bg-zinc-800 text-emerald-500" />
            <span>{renderInline(line.substring(6))}</span>
          </div>
        );
      } else if (line.startsWith('- [x] ') || line.startsWith('* [x] ')) {
        elements.push(
          <div key={i} className="flex items-center gap-2 my-1 text-xs text-zinc-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="line-through text-zinc-500">{renderInline(line.substring(6))}</span>
          </div>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={i} className="text-xs text-zinc-300 ml-4 list-disc my-1 leading-relaxed">
            {renderInline(line.substring(2))}
          </li>
        );
      } else if (/^\d+\.\s/.test(line)) {
        elements.push(
          <li key={i} className="text-xs text-zinc-300 ml-4 list-decimal my-1 leading-relaxed">
            {renderInline(line.replace(/^\d+\.\s/, ''))}
          </li>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(
          <p key={i} className="text-xs text-zinc-300 leading-relaxed my-1">
            {renderInline(line)}
          </p>
        );
      }
    }

    if (inTable) flushTable('table-end');

    return elements;
  };

  const renderedElements = React.useMemo(() => renderMarkdown(content), [content, copiedIndex]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#18181b] p-6 lg:p-8 select-text">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-800 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-zinc-200">Markdown Live Preview</span>
            <span className="px-2 py-0.5 rounded bg-zinc-800 font-mono text-[10px] text-zinc-400">
              {filename}
            </span>
          </div>
          <span className="text-[11px] text-emerald-400/90 font-mono">
            ide.freshfood.rocks
          </span>
        </div>
        <div className="prose prose-invert max-w-none">
          {renderedElements}
        </div>
      </div>
    </div>
  );
};
