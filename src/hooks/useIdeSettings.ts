/**
 * Persisted IDE Settings & Light/Dark Theme Hook.
 * Stores user preferences in window.localStorage (completely separate from the
 * Clockie H2 v1.3 sessionId in per-tab window.sessionStorage) and synchronizes
 * the root HTML `.dark` class and `color-scheme` CSS property for full-IDE theming.
 *
 * Official Documentation:
 * - React Hooks (useState, useEffect, useCallback): https://react.dev/reference/react
 * - Window.localStorage API: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 * - Tailwind CSS Dark Mode: https://tailwindcss.com/docs/dark-mode
 */

import { useState, useEffect, useCallback } from 'react';
import { DirectStartupDriveMode, EditorTheme, IdeSettings, UiColorMode } from '../types/ide';

export const IDE_SETTINGS_STORAGE_KEY = 'monarch_ide_preferences_v1' as const;

const LIGHT_EDITOR_THEMES: ReadonlySet<EditorTheme> = new Set(['freshfood-light', 'vs']);
const VALID_EDITOR_THEMES: ReadonlySet<EditorTheme> = new Set([
  'freshfood-dark',
  'freshfood-cyber',
  'freshfood-light',
  'vs-dark',
  'vs',
  'hc-black',
]);

/** Returns today's local date formatted as yyyy-MM-dd (e.g. "2026-11-19"). */
export function getTodayIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Returns the current four-digit year string (e.g. "2026"). */
export function getCurrentYearString(date = new Date()): string {
  return String(date.getFullYear());
}

/** Builds the default preferences export filename for today's date. */
export function buildDatedPreferencesFilename(date = new Date()): string {
  return `ide-preferences-${getTodayIsoDate(date)}.json`;
}

/** Builds default IDE settings anchored to the current year and date. */
export function createDefaultIdeSettings(date = new Date()): IdeSettings {
  return {
    colorMode: 'dark',
    editorTheme: 'freshfood-dark',
    lastDarkEditorTheme: 'freshfood-dark',
    lastLightEditorTheme: 'freshfood-light',
    fontSize: 13.5,
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    sidebarWidth: 260,
    sidebarOpen: true,
    sidebarDefaultFoldersExpanded: false,
    preferencesExportProvider: 'pcloud',
    preferencesExportFolder: `${getCurrentYearString(date)}/downloads`,
    preferencesExportFilename: buildDatedPreferencesFilename(date),
    preferencesUseAutoDateFilename: true,
    preferencesLastImportProvider: '',
    preferencesLastImportFolder: '',
    preferencesLastImportFile: '',
    directStartupDriveMode: 'all',
    directStartupDrive: '',
    knownBridgeDrives: [],
  };
}

/** Checks whether an editor theme is light or dark. */
export function isLightEditorTheme(theme: EditorTheme): boolean {
  return LIGHT_EDITOR_THEMES.has(theme);
}

/**
 * Validates and normalizes an untrusted settings object (from localStorage or imported JSON)
 * against safe defaults so older or partial JSON files never break the IDE.
 */
export function normalizeIdeSettings(raw: unknown): IdeSettings {
  const defaults = createDefaultIdeSettings();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const input = raw as Partial<IdeSettings>;
  const colorMode: UiColorMode = input.colorMode === 'light' ? 'light' : 'dark';

  const lastDarkEditorTheme: EditorTheme =
    input.lastDarkEditorTheme &&
    VALID_EDITOR_THEMES.has(input.lastDarkEditorTheme) &&
    !isLightEditorTheme(input.lastDarkEditorTheme)
      ? input.lastDarkEditorTheme
      : defaults.lastDarkEditorTheme;

  const lastLightEditorTheme: EditorTheme =
    input.lastLightEditorTheme &&
    VALID_EDITOR_THEMES.has(input.lastLightEditorTheme) &&
    isLightEditorTheme(input.lastLightEditorTheme)
      ? input.lastLightEditorTheme
      : defaults.lastLightEditorTheme;

  const editorTheme: EditorTheme =
    input.editorTheme && VALID_EDITOR_THEMES.has(input.editorTheme)
      ? input.editorTheme
      : colorMode === 'light'
      ? lastLightEditorTheme
      : lastDarkEditorTheme;

  const useAutoDate =
    typeof input.preferencesUseAutoDateFilename === 'boolean'
      ? input.preferencesUseAutoDateFilename
      : defaults.preferencesUseAutoDateFilename;

  const rawExportFilename =
    typeof input.preferencesExportFilename === 'string' && input.preferencesExportFilename.trim()
      ? input.preferencesExportFilename.trim()
      : defaults.preferencesExportFilename;

  // Automatically refresh dated filenames to today's date when auto-date mode is active
  const exportFilename = useAutoDate ? buildDatedPreferencesFilename() : rawExportFilename;

  return {
    colorMode,
    editorTheme,
    lastDarkEditorTheme,
    lastLightEditorTheme,
    fontSize:
      typeof input.fontSize === 'number' && input.fontSize >= 10 && input.fontSize <= 28
        ? input.fontSize
        : defaults.fontSize,
    tabSize:
      typeof input.tabSize === 'number' && [2, 4, 8].includes(input.tabSize)
        ? input.tabSize
        : defaults.tabSize,
    wordWrap: typeof input.wordWrap === 'boolean' ? input.wordWrap : defaults.wordWrap,
    minimap: typeof input.minimap === 'boolean' ? input.minimap : defaults.minimap,
    sidebarWidth:
      typeof input.sidebarWidth === 'number' && input.sidebarWidth >= 180 && input.sidebarWidth <= 560
        ? input.sidebarWidth
        : defaults.sidebarWidth,
    sidebarOpen: typeof input.sidebarOpen === 'boolean' ? input.sidebarOpen : defaults.sidebarOpen,
    sidebarDefaultFoldersExpanded:
      typeof input.sidebarDefaultFoldersExpanded === 'boolean'
        ? input.sidebarDefaultFoldersExpanded
        : defaults.sidebarDefaultFoldersExpanded,
    preferencesExportProvider:
      typeof input.preferencesExportProvider === 'string' && input.preferencesExportProvider.trim()
        ? input.preferencesExportProvider.trim()
        : defaults.preferencesExportProvider,
    preferencesExportFolder:
      typeof input.preferencesExportFolder === 'string'
        ? input.preferencesExportFolder.trim().replace(/^\/+|\/+$/g, '')
        : defaults.preferencesExportFolder,
    preferencesExportFilename: exportFilename,
    preferencesUseAutoDateFilename: useAutoDate,
    preferencesLastImportProvider:
      typeof input.preferencesLastImportProvider === 'string'
        ? input.preferencesLastImportProvider.trim()
        : '',
    preferencesLastImportFolder:
      typeof input.preferencesLastImportFolder === 'string'
        ? input.preferencesLastImportFolder.trim().replace(/^\/+|\/+$/g, '')
        : '',
    preferencesLastImportFile:
      typeof input.preferencesLastImportFile === 'string'
        ? input.preferencesLastImportFile.trim()
        : '',
    directStartupDriveMode:
      input.directStartupDriveMode === 'single' || input.directStartupDriveMode === 'none'
        ? (input.directStartupDriveMode as DirectStartupDriveMode)
        : 'all',
    directStartupDrive:
      typeof input.directStartupDrive === 'string' ? input.directStartupDrive.trim() : '',
    knownBridgeDrives: Array.isArray(input.knownBridgeDrives)
      ? Array.from(
          new Set(
            input.knownBridgeDrives
              .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
              .map(d => d.trim())
          )
        )
      : [],
  };
}

function loadSettingsFromStorage(): IdeSettings {
  try {
    const raw = window.localStorage.getItem(IDE_SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultIdeSettings();
    const parsed = JSON.parse(raw);
    return normalizeIdeSettings(parsed);
  } catch {
    return createDefaultIdeSettings();
  }
}

export function useIdeSettings() {
  const [settings, setSettings] = useState<IdeSettings>(() => loadSettingsFromStorage());

  // Persist every settings change to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(IDE_SETTINGS_STORAGE_KEY, JSON.stringify(settings, null, 2));
    } catch {
      // Ignore storage quota or sandbox errors
    }
  }, [settings]);

  // Synchronize HTML `.dark` class and native browser `color-scheme` with settings.colorMode
  useEffect(() => {
    const root = document.documentElement;
    if (settings.colorMode === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [settings.colorMode]);

  /** Switches the entire IDE between light and dark modes while restoring the matching Monaco theme. */
  const setColorMode = useCallback((mode: UiColorMode) => {
    setSettings(prev => ({
      ...prev,
      colorMode: mode,
      editorTheme:
        mode === 'light'
          ? isLightEditorTheme(prev.editorTheme)
            ? prev.editorTheme
            : prev.lastLightEditorTheme
          : !isLightEditorTheme(prev.editorTheme)
          ? prev.editorTheme
          : prev.lastDarkEditorTheme,
    }));
  }, []);

  /** Toggles between light and dark IDE modes. */
  const toggleColorMode = useCallback(() => {
    setSettings(prev => {
      const nextMode: UiColorMode = prev.colorMode === 'dark' ? 'light' : 'dark';
      return {
        ...prev,
        colorMode: nextMode,
        editorTheme: nextMode === 'light' ? prev.lastLightEditorTheme : prev.lastDarkEditorTheme,
      };
    });
  }, []);

  /** Selects a Monaco editor theme and automatically switches the IDE shell to matching light/dark mode. */
  const setEditorTheme = useCallback((theme: EditorTheme) => {
    const light = isLightEditorTheme(theme);
    setSettings(prev => ({
      ...prev,
      colorMode: light ? 'light' : 'dark',
      editorTheme: theme,
      lastLightEditorTheme: light ? theme : prev.lastLightEditorTheme,
      lastDarkEditorTheme: !light ? theme : prev.lastDarkEditorTheme,
    }));
  }, []);

  /** Applies a partial settings update and persists it to localStorage. */
  const updateSettings = useCallback((patch: Partial<IdeSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  /** Restores all settings to factory defaults. */
  const resetSettings = useCallback(() => {
    setSettings(createDefaultIdeSettings());
  }, []);

  /**
   * Imports a parsed JSON preferences object, overwriting localStorage settings,
   * while giving the import/export location just used precedence if provided.
   */
  const importSettingsFromJson = useCallback(
    (
      rawJson: unknown,
      importLocationUsed?: { provider: string; folder: string; filename: string }
    ) => {
      const normalized = normalizeIdeSettings(rawJson);
      if (importLocationUsed) {
        normalized.preferencesLastImportProvider = importLocationUsed.provider;
        normalized.preferencesLastImportFolder = importLocationUsed.folder.replace(/^\/+|\/+$/g, '');
        normalized.preferencesLastImportFile = importLocationUsed.filename;
      }
      setSettings(normalized);
      return normalized;
    },
    []
  );

  return {
    settings,
    setColorMode,
    toggleColorMode,
    setEditorTheme,
    updateSettings,
    resetSettings,
    importSettingsFromJson,
  };
}
