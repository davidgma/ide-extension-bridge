/**
 * File system utilities, language/MIME inference, hierarchical tree builder, and default demo workspace.
 *
 * Official Documentation:
 * - Monaco Editor Languages: https://microsoft.github.io/monaco-editor/
 * - MDN Common MIME Types: https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types/Common_types
 */

import { CloudFile, FileTreeNode } from '../types/ide';

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
}

export function inferMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'ts':
      return 'text/typescript';
    case 'tsx':
      return 'text/typescript-jsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'text/javascript';
    case 'jsx':
      return 'text/jsx';
    case 'json':
      return 'application/json';
    case 'html':
    case 'htm':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'scss':
    case 'sass':
    case 'less':
      return 'text/x-scss';
    case 'py':
    case 'python':
      return 'text/x-python';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'sql':
      return 'application/sql';
    case 'yaml':
    case 'yml':
      return 'text/yaml';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'text/x-shellscript';
    case 'xml':
      return 'application/xml';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    default:
      return 'text/plain';
  }
}

export function getMonacoLanguage(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
    case 'less':
      return 'scss';
    case 'py':
    case 'python':
      return 'python';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'cpp';
    case 'java':
      return 'java';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell';
    case 'xml':
      return 'xml';
    case 'svg':
      return 'xml';
    case 'dockerfile':
      return 'dockerfile';
    case 'graphql':
    case 'gql':
      return 'graphql';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'ini':
    case 'conf':
      return 'ini';
    default:
      return 'plaintext';
  }
}

export function isImageFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp', 'bmp', 'ico'].includes(ext);
}

export function isVideoFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
}

export function isMarkdownFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ['md', 'markdown'].includes(ext);
}

export function buildFileTree(files: CloudFile[]): FileTreeNode[] {
  const rootMap: Record<string, any> = {};

  // Sort files by path for deterministic tree assembly
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const cleanPath = file.path.replace(/^\/+|\/+$/g, '');
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let currentMap = rootMap;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      const isDirNode = !isLast || Boolean(file.isDirectory);

      if (!currentMap[part]) {
        currentMap[part] = {
          id: isDirNode ? `dir-${currentPath}` : file.id,
          name: part,
          path: currentPath,
          isDirectory: isDirNode,
          children: isDirNode ? [] : undefined,
          file: isDirNode ? (isLast ? file : undefined) : file,
          _childrenMap: isDirNode ? {} : undefined,
        };
      } else if (isLast && file.isDirectory && !currentMap[part].file) {
        currentMap[part].file = file;
      }

      if (isDirNode) {
        if (!currentMap[part]._childrenMap) {
          currentMap[part]._childrenMap = {};
        }
        currentMap = currentMap[part]._childrenMap;
      }
    }
  }

  function finalizeNodes(nodeMap: Record<string, any>): FileTreeNode[] {
    const list = Object.values(nodeMap);
    list.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return list.map(node => {
      const result: FileTreeNode = {
        id: node.id,
        name: node.name,
        path: node.path,
        isDirectory: node.isDirectory,
        file: node.file,
      };
      if (node.isDirectory) {
        result.children = node._childrenMap ? finalizeNodes(node._childrenMap) : [];
      }
      return result;
    });
  }

  return finalizeNodes(rootMap);
}

// Default standalone workspace shown when opened without an h2Session launch parameter
export const INITIAL_CLOUD_FILES: CloudFile[] = [
  {
    id: 'file-readme',
    name: 'README.md',
    path: 'README.md',
    cloudProvider: 'Standalone',
    mimeType: 'text/markdown',
    contentLoaded: true,
    lastModified: '2026-11-18 07:20',
    content: `# FreshFood Rocks - Monarch IDE & Cloud Studio

Welcome to **Monarch IDE & Cloud Studio**, deployed at [ide.freshfood.rocks](https://ide.freshfood.rocks).

This single-page cloud engineering environment connects to Chrome extensions implementing the **Clockie H2 Bridge Protocol v1.2 (\`H2_CLOUD_BRIDGE\`)**, supporting both launched workspaces and direct multi-drive sessions.

---

### Key Capabilities
- **Monaco & Monarch Engine**: Rich syntax highlighting, custom token lexers, multi-theme engine, and minimap.
- **H2 Bridge Protocol v1.2 (\`H2_CLOUD_BRIDGE\`)**:
  - **Launched Mode** (\`#h2Session=<sessionId>\`): Automatic \`H2_HANDSHAKE_REQ\` and \`H2_WORKSPACE_TREE\`.
  - **Direct Mode**: Origin-verified \`H2_CONNECT_REQ\` with multi-drive access (\`pcloud\`, \`gdrive\`, \`dropbox\`, \`local\`) and \`accessMode\` (\`readwrite\` / \`readonly\`).
  - **Lazy Depth & Concurrent Reads**: Incremental folder expansion (\`H2_LIST_FOLDER_REQ\`) and parallel file streaming (\`H2_READ_FILE_REQ\`).
- **Multi-File Workspace**: Interactive tree hierarchy including empty folders, nested file creation, workspace search, and live Markdown/media viewing.
- **Automated CI/CD**: GitHub Actions workflow (\`.github/workflows/deploy.yml\`) deploying to \`ide.freshfood.rocks\`.

---

### Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| \`Ctrl + S\` / \`Cmd + S\` | Save current file via \`H2_SAVE_FILE_REQ\` |
| \`Ctrl + P\` / \`Cmd + P\` | Quick Open File Switcher |
| \`Ctrl + Shift + F\` | Global Workspace Search |
| \`Ctrl + B\` | Toggle File Explorer Sidebar |
`
  },
  {
    id: 'file-engine-ts',
    name: 'freshfood-engine.ts',
    path: 'src/api/freshfood-engine.ts',
    cloudProvider: 'Standalone',
    mimeType: 'text/typescript',
    contentLoaded: true,
    lastModified: '2026-11-18 07:15',
    content: `/**
 * FreshFood Rocks - Monarch Cloud Stream Engine
 * Handles real-time telemetry, cache validation, and data pipelines.
 */

export interface FoodItem {
  id: string;
  name: string;
  category: 'produce' | 'dairy' | 'bakery' | 'beverages';
  freshnessScore: number; // 0 - 100
  harvestDate: string;
  origin: string;
  isOrganic: boolean;
}

export class FreshFoodCloudEngine {
  private provider: string;
  private endpoint: string;

  constructor(provider = 'cloud', endpoint = 'https://ide.freshfood.rocks/api/v1') {
    this.provider = provider;
    this.endpoint = endpoint;
  }

  public evaluateFreshness(item: FoodItem, ambientTempCelsius: number): number {
    const elapsedDays = (Date.now() - new Date(item.harvestDate).getTime()) / (1000 * 60 * 60 * 24);
    const degradationFactor = ambientTempCelsius > 20 ? 1.4 : 0.85;
    const computedScore = Math.max(0, item.freshnessScore - (elapsedDays * 2.5 * degradationFactor));
    
    return Math.round(computedScore * 10) / 10;
  }

  public async syncWithCloud(items: FoodItem[]): Promise<{ success: boolean; syncedCount: number }> {
    console.log(\`[FreshFoodEngine] Syncing \${items.length} records via \${this.provider}...\`);
    return {
      success: true,
      syncedCount: items.length
    };
  }
}
`
  },
  {
    id: 'file-config-json',
    name: 'settings.json',
    path: 'config/settings.json',
    cloudProvider: 'Standalone',
    mimeType: 'application/json',
    contentLoaded: true,
    lastModified: '2026-11-18 07:10',
    content: `{
  "workspace": "FreshFood Rocks Studio",
  "domain": "ide.freshfood.rocks",
  "editor": {
    "tabSize": 2,
    "minimap": true,
    "wordWrap": "on",
    "fontFamily": "Fira Code, Consolas, monospace",
    "fontSize": 14,
    "cursorBlinking": "smooth"
  },
  "extensionBridge": {
    "protocol": "H2_CLOUD_BRIDGE",
    "protocolVersion": "1.2",
    "supportedVersions": ["1.2", "1.1"]
  }
}
`
  },
  {
    id: 'file-python',
    name: 'predict.py',
    path: 'models/predict.py',
    cloudProvider: 'Standalone',
    mimeType: 'text/x-python',
    contentLoaded: true,
    lastModified: '2026-11-17 04:05',
    content: `"""
FreshFood Rocks - Freshness Index AI Regression Model
Predicts shelf-life duration based on spectral and sensor telemetry.
"""

import math
from dataclasses import dataclass

@dataclass
class TelemetryReading:
    batch_id: str
    ethylene_ppm: float
    humidity_percent: float
    temperature_celsius: float

def compute_shelf_life_days(reading: TelemetryReading) -> float:
    base_shelf_life = 14.0
    temp_penalty = max(0.0, (reading.temperature_celsius - 4.0) * 0.85)
    ethylene_acceleration = math.log1p(reading.ethylene_ppm * 3.2)
    humidity_correction = 1.0 - abs(reading.humidity_percent - 85.0) * 0.015

    estimated_days = (base_shelf_life - temp_penalty - ethylene_acceleration) * humidity_correction
    return round(max(0.5, estimated_days), 2)

if __name__ == "__main__":
    test_reading = TelemetryReading(
        batch_id="BATCH-2026-ORANGE-09",
        ethylene_ppm=0.15,
        humidity_percent=88.5,
        temperature_celsius=6.2
    )
    predicted = compute_shelf_life_days(test_reading)
    print(f"Predicted Remaining Shelf Life: {predicted} days")
`
  },
  {
    id: 'file-logo-svg',
    name: 'freshfood-logo.svg',
    path: 'assets/freshfood-logo.svg',
    cloudProvider: 'Standalone',
    mimeType: 'image/svg+xml',
    contentLoaded: true,
    lastModified: '2026-11-17 04:00',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 120" width="100%" height="100%">
  <defs>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="monarchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>
  </defs>

  <rect width="400" height="120" rx="16" fill="#18181b" stroke="#27272a" stroke-width="2"/>

  <g transform="translate(24, 24)">
    <circle cx="36" cy="36" r="34" fill="#064e3b" opacity="0.6"/>
    <path d="M 36 12 C 54 12, 60 30, 60 48 C 60 60, 48 60, 36 60 C 24 60, 12 60, 12 48 C 12 30, 18 12, 36 12 Z" fill="url(#leafGrad)"/>
    <path d="M 36 18 L 36 54" stroke="#ecfdf5" stroke-width="3" stroke-linecap="round"/>
    <path d="M 36 30 L 46 22" stroke="#ecfdf5" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 36 40 L 26 32" stroke="#ecfdf5" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <text x="115" y="52" font-family="Inter, sans-serif" font-weight="800" font-size="28" fill="#ffffff" letter-spacing="-0.5">
    FreshFood<tspan fill="#34d399">.rocks</tspan>
  </text>
  <text x="116" y="78" font-family="Fira Code, monospace" font-weight="600" font-size="13" fill="url(#monarchGrad)" letter-spacing="1.5">
    Monarch Cloud Studio IDE
  </text>
  
  <rect x="116" y="90" width="8" height="8" rx="4" fill="#10b981"/>
  <text x="130" y="98" font-family="Inter, sans-serif" font-size="10" fill="#9ca3af">
    ide.freshfood.rocks
  </text>
</svg>
`
  }
];
