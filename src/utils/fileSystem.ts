import { CloudFile, FileTreeNode, CloudProvider } from '../types/ide';

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
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
  const rootNodes: Record<string, FileTreeNode> = {};

  // Sort files by path for consistency
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = rootNodes;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = i === parts.length - 1 && !file.isDirectory;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          id: isLeaf ? file.id : `dir-${currentPath}`,
          name: part,
          path: currentPath,
          isDirectory: !isLeaf,
          children: isLeaf ? undefined : [],
          file: isLeaf ? file : undefined,
        };
      }

      if (!isLeaf) {
        if (!currentLevel[part].children) {
          currentLevel[part].children = [];
        }
        // Build child map helper
        const childMap: Record<string, FileTreeNode> = {};
        for (const child of currentLevel[part].children!) {
          childMap[child.name] = child;
        }
        currentLevel = childMap;
      }
    }
  }

  // Recursive convert record back to array
  function convertToArray(nodeMap: Record<string, FileTreeNode>): FileTreeNode[] {
    const list = Object.values(nodeMap);
    // Sort directories first, then files alphabetically
    list.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const node of list) {
      if (node.children && node.children.length > 0) {
        // recursively sort children
        const recMap: Record<string, FileTreeNode> = {};
        node.children.forEach(c => { recMap[c.name] = c; });
        node.children = convertToArray(recMap);
      }
    }
    return list;
  }

  return convertToArray(rootNodes);
}

// Default initial workspace representing cloud drive synced project
export const INITIAL_CLOUD_FILES: CloudFile[] = [
  {
    id: 'file-readme',
    name: 'README.md',
    path: 'README.md',
    cloudProvider: 'pCloud',
    mimeType: 'text/markdown',
    lastModified: '2026-11-10 10:24',
    content: `# FreshFood Rocks - Monarch IDE & Cloud Studio 🚀

Welcome to **Monarch IDE & Cloud Studio**, deployed for [ide.freshfood.rocks](https://ide.freshfood.rocks).

This single-page cloud engineering environment is bridged directly to the **Clockie McClockface Chrome Extension**, enabling direct file streaming and bi-directional synchronization with **pCloud**, **Google Drive**, **Dropbox**, and **OneDrive**.

---

### 🌟 Key Capabilities
- **Monaco & Monarch Engine**: Rich syntax highlighting, custom token lexers, multi-theme engine, and minimap.
- **Chrome Extension Bridge**: High-speed handshake protocol with \`PING_HANDSHAKE\`, \`LOAD_FILES_PAYLOAD\`, and \`SAVE_CLOUD_FILE\`.
- **Cloud Persistence**: Instant \`Ctrl+S\` / \`Cmd+S\` updates synced directly back to your cloud drive without local filesystem dependencies.
- **Multi-File Workspace**: Interactive tree hierarchy, directory creation, search across files, and batch cloud saves.
- **Binary & Media Previews**: Live Markdown preview tab, SVG/PNG graphic viewer with checkerboard transparency & zoom, and HTML5 video inspection.
- **Automated CI/CD**: Built-in GitHub Actions workflow (\`.github/workflows/deploy.yml\`) deploying with \`CNAME: ide.freshfood.rocks\`.

---

### ⚡ Keyboard Shortcuts
| Shortcut | Action |
| :--- | :--- |
| \`Ctrl + S\` / \`Cmd + S\` | Save current file to Cloud Provider |
| \`Ctrl + P\` / \`Cmd + P\` | Quick Open File Switcher |
| \`Ctrl + Shift + F\` | Global Workspace Search |
| \`Ctrl + B\` | Toggle File Explorer Sidebar |

---

### 📂 Synced from pCloud Drive
- **Provider**: pCloud Secure Vault
- **Sync Status**: 🟢 Active Bi-Directional Bridge
- **Last Cloud Sync**: Today at 10:24 AM
`
  },
  {
    id: 'file-engine-ts',
    name: 'freshfood-engine.ts',
    path: 'src/api/freshfood-engine.ts',
    cloudProvider: 'pCloud',
    mimeType: 'application/typescript',
    lastModified: '2026-11-10 10:15',
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

  constructor(provider = 'pCloud', endpoint = 'https://ide.freshfood.rocks/api/v1') {
    this.provider = provider;
    this.endpoint = endpoint;
  }

  /**
   * Evaluates freshness index using temperature and harvest timestamps
   */
  public evaluateFreshness(item: FoodItem, ambientTempCelsius: number): number {
    const elapsedDays = (Date.now() - new Date(item.harvestDate).getTime()) / (1000 * 60 * 60 * 24);
    const degradationFactor = ambientTempCelsius > 20 ? 1.4 : 0.85;
    const computedScore = Math.max(0, item.freshnessScore - (elapsedDays * 2.5 * degradationFactor));
    
    return Math.round(computedScore * 10) / 10;
  }

  /**
   * Syncs catalog back to cloud drive storage
   */
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
    id: 'file-widget-tsx',
    name: 'MonarchWidget.tsx',
    path: 'src/components/MonarchWidget.tsx',
    cloudProvider: 'pCloud',
    mimeType: 'text/typescript-jsx',
    lastModified: '2026-11-10 09:50',
    content: `import React, { useState } from 'react';

export interface WidgetProps {
  title: string;
  initialCount?: number;
  onRefresh?: () => void;
}

export const MonarchWidget: React.FC<WidgetProps> = ({ title, initialCount = 42, onRefresh }) => {
  const [metric, setMetric] = useState(initialCount);

  return (
    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-300">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm tracking-wide">{title}</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
          Live Stream
        </span>
      </div>
      <p className="mt-2 text-2xl font-mono font-bold text-white">{metric}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setMetric(m => m + 1)}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-medium rounded transition"
        >
          Increment
        </button>
        <button
          onClick={onRefresh}
          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition"
        >
          Reset Telemetry
        </button>
      </div>
    </div>
  );
};
`
  },
  {
    id: 'file-styles-css',
    name: 'theme.css',
    path: 'src/styles/theme.css',
    cloudProvider: 'pCloud',
    mimeType: 'text/css',
    lastModified: '2026-11-10 09:30',
    content: `/* Monarch Theme Stylesheet */
:root {
  --primary-accent: #10b981;
  --cyber-cyan: #06b6d4;
  --fresh-amber: #f59e0b;
  --ide-bg: #1e1e1e;
  --sidebar-bg: #252526;
  --tab-active: #1e1e1e;
  --tab-inactive: #2d2d2d;
}

.monarch-editor-glass {
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.cloud-pill-pulse {
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}
`
  },
  {
    id: 'file-config-json',
    name: 'settings.json',
    path: 'config/settings.json',
    cloudProvider: 'pCloud',
    mimeType: 'application/json',
    lastModified: '2026-11-10 08:45',
    content: `{
  "workspace": "FreshFood Rocks Studio",
  "domain": "ide.freshfood.rocks",
  "cloudSync": {
    "provider": "pCloud",
    "autoSaveIntervalSec": 15,
    "versionRetention": 30,
    "encryptPayload": true
  },
  "editor": {
    "tabSize": 2,
    "minimap": true,
    "wordWrap": "on",
    "fontFamily": "Fira Code, Consolas, monospace",
    "fontSize": 14,
    "cursorBlinking": "smooth"
  },
  "extensionBridge": {
    "handshakeAction": "PING_HANDSHAKE",
    "targetExtension": "Clockie McClockface",
    "supportedProtocols": ["v1.0", "v2.0-stream"]
  }
}
`
  },
  {
    id: 'file-sql',
    name: 'schema.sql',
    path: 'database/schema.sql',
    cloudProvider: 'pCloud',
    mimeType: 'application/sql',
    lastModified: '2026-11-10 08:30',
    content: `-- FreshFood Relational Registry Schema
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    cert_organic BOOLEAN DEFAULT FALSE,
    country_code CHAR(2) NOT NULL,
    rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5.0)
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_id VARCHAR(64) PRIMARY KEY,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    product_sku VARCHAR(32) NOT NULL,
    quantity_kg DECIMAL(10,2) NOT NULL,
    storage_temp_celsius DECIMAL(4,1) NOT NULL,
    arrival_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'in_inspection'
);

CREATE INDEX idx_inventory_sku ON inventory_batches(product_sku);
CREATE INDEX idx_inventory_arrival ON inventory_batches(arrival_timestamp DESC);
`
  },
  {
    id: 'file-python',
    name: 'predict.py',
    path: 'models/predict.py',
    cloudProvider: 'pCloud',
    mimeType: 'text/x-python',
    lastModified: '2026-11-10 08:12',
    content: `"""
FreshFood Rocks - Freshness Index AI Regression Model
Predicts shelf-life duration based on spectral and sensor telemetry.
"""

import math
from dataclasses import dataclass
from typing import List, Tuple

@dataclass
class TelemetryReading:
    batch_id: str
    ethylene_ppm: float
    humidity_percent: float
    temperature_celsius: float

def compute_shelf_life_days(reading: TelemetryReading) -> float:
    # Empirical degradation curve
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
    id: 'file-deploy-sh',
    name: 'deploy.sh',
    path: 'scripts/deploy.sh',
    cloudProvider: 'pCloud',
    mimeType: 'text/x-shellscript',
    lastModified: '2026-11-10 07:45',
    content: `#!/usr/bin/env bash
# FreshFood Rocks - Monarch IDE Automated Build & CNAME Verification
set -euo pipefail

echo "==> Building Monarch IDE for FreshFood Rocks..."
npm run build

echo "==> Verifying CNAME configuration..."
CNAME_FILE="dist/CNAME"
EXPECTED_DOMAIN="ide.freshfood.rocks"

echo "$EXPECTED_DOMAIN" > "$CNAME_FILE"
echo "==> CNAME verified: $(cat $CNAME_FILE)"

echo "==> Ready for GitHub Pages deployment!"
`
  },
  {
    id: 'file-logo-svg',
    name: 'freshfood-logo.svg',
    path: 'assets/freshfood-logo.svg',
    cloudProvider: 'pCloud',
    mimeType: 'image/svg+xml',
    lastModified: '2026-11-10 07:30',
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

  <!-- Background Card -->
  <rect width="400" height="120" rx="16" fill="#18181b" stroke="#27272a" stroke-width="2"/>

  <!-- Leaf Emblem -->
  <g transform="translate(24, 24)">
    <circle cx="36" cy="36" r="34" fill="#064e3b" opacity="0.6"/>
    <!-- Organic Leaf Motif -->
    <path d="M 36 12 C 54 12, 60 30, 60 48 C 60 60, 48 60, 36 60 C 24 60, 12 60, 12 48 C 12 30, 18 12, 36 12 Z" fill="url(#leafGrad)"/>
    <path d="M 36 18 L 36 54" stroke="#ecfdf5" stroke-width="3" stroke-linecap="round"/>
    <path d="M 36 30 L 46 22" stroke="#ecfdf5" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M 36 40 L 26 32" stroke="#ecfdf5" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- Brand Typography -->
  <text x="115" y="52" font-family="Inter, sans-serif" font-weight="800" font-size="28" fill="#ffffff" letter-spacing="-0.5">
    FreshFood<tspan fill="#34d399">.rocks</tspan>
  </text>
  <text x="116" y="78" font-family="Fira Code, monospace" font-weight="600" font-size="13" fill="url(#monarchGrad)" letter-spacing="1.5">
    MONARCH CLOUD STUDIO IDE
  </text>
  
  <rect x="116" y="90" width="8" height="8" rx="4" fill="#10b981"/>
  <text x="130" y="98" font-family="Inter, sans-serif" font-size="10" fill="#9ca3af">
    ide.freshfood.rocks
  </text>
</svg>
`
  },
  {
    id: 'file-sample-video',
    name: 'welcome-tour.webm',
    path: 'media/welcome-tour.webm',
    cloudProvider: 'pCloud',
    mimeType: 'video/webm',
    isBinary: true,
    lastModified: '2026-11-10 07:15',
    content: '' // Handled by video viewer placeholder / stream
  }
];
