import type { Monaco } from '@monaco-editor/react';

export function registerMonarchThemesAndLanguages(monaco: Monaco) {
  // 1. FreshFood Dark Theme
  monaco.editor.defineTheme('freshfood-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: '10b981', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'e2e8f0' },
      { token: 'string', foreground: 'fcd34d' },
      { token: 'number', foreground: 'f472b6' },
      { token: 'type', foreground: '38bdf8' },
      { token: 'delimiter', foreground: '94a3b8' },
      { token: 'tag', foreground: '34d399' },
      { token: 'attribute.name', foreground: '818cf8' },
      { token: 'attribute.value', foreground: 'fde047' },
      { token: 'function', foreground: '60a5fa', fontStyle: 'bold' },
      { token: 'variable', foreground: 'e0e7ff' }
    ],
    colors: {
      'editor.background': '#18181b', // zinc-900
      'editor.foreground': '#e4e4e7',
      'editor.lineHighlightBackground': '#27272a50',
      'editorCursor.foreground': '#34d399',
      'editorWhitespace.foreground': '#3f3f46',
      'editorIndentGuide.background1': '#27272a',
      'editorIndentGuide.activeBackground1': '#10b981',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#34d399',
      'editor.selectionBackground': '#10b98130',
      'editor.inactiveSelectionBackground': '#27272a80',
      'editorGutter.background': '#18181b'
    }
  });

  // 2. High Contrast Cyber Monarch Theme
  monaco.editor.defineTheme('freshfood-cyber', {
    base: 'hc-black',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '00ffaa', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff007f', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'ffffff' },
      { token: 'string', foreground: '00f0ff' },
      { token: 'number', foreground: 'ffe600' },
      { token: 'type', foreground: 'bd00ff', fontStyle: 'bold' },
      { token: 'function', foreground: '00ffff' },
      { token: 'delimiter', foreground: 'ffffff' }
    ],
    colors: {
      'editor.background': '#090a0f',
      'editor.foreground': '#ffffff',
      'editor.lineHighlightBackground': '#181b2a',
      'editorCursor.foreground': '#00f0ff',
      'editorLineNumber.foreground': '#404560',
      'editorLineNumber.activeForeground': '#00f0ff',
      'editor.selectionBackground': '#ff007f40',
      'editorGutter.background': '#090a0f'
    }
  });

  // 3. FreshFood Clean Light Theme
  monaco.editor.defineTheme('freshfood-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: '059669', fontStyle: 'bold' },
      { token: 'string', foreground: 'd97706' },
      { token: 'number', foreground: '7c3aed' },
      { token: 'type', foreground: '0284c7' },
      { token: 'function', foreground: '2563eb' }
    ],
    colors: {
      'editor.background': '#f8fafc',
      'editor.foreground': '#0f172a',
      'editor.lineHighlightBackground': '#f1f5f9',
      'editorCursor.foreground': '#059669',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#059669',
      'editor.selectionBackground': '#10b98125'
    }
  });

  // Register custom Monarch DSL language: "freshfood-dsl"
  if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'freshfood-dsl')) {
    monaco.languages.register({ id: 'freshfood-dsl' });
    monaco.languages.setMonarchTokensProvider('freshfood-dsl', {
      defaultToken: 'invalid',
      keywords: [
        'workspace', 'pipeline', 'stream', 'freshness', 'cloud_drive',
        'sync', 'harvest', 'sensor', 'trigger', 'dispatch', 'metric'
      ],
      typeKeywords: ['int', 'float', 'string', 'boolean', 'timestamp', 'geo_point'],
      operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||'],
      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      tokenizer: {
        root: [
          [/[a-z_$][\w$]*/, {
            cases: {
              '@typeKeywords': 'type',
              '@keywords': 'keyword',
              '@default': 'identifier'
            }
          }],
          [/[A-Z][\w\$]*/, 'type.identifier'],
          { include: '@whitespace' },
          [/[{}()\[\]]/, '@brackets'],
          [/@symbols/, {
            cases: {
              '@operators': 'operator',
              '@default': ''
            }
          }],
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/0[xX][0-9a-fA-F]+/, 'number.hex'],
          [/\d+/, 'number'],
          [/[;,.]/, 'delimiter'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }]
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        whitespace: [
          [/[ \t\r\n]+/, 'white'],
          [/\/\/.*$/, 'comment'],
          [/\/\*/, 'comment', '@comment']
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ]
      }
    });
  }
}
