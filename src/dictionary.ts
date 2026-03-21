import * as fs from 'fs';
import { stringify, parse } from 'yaml';
import { loadYamlAsObject } from './yamlLoader';
import { createReloadableConfig } from './reloadableConfig';
import { getConfigLock } from './configLock';

export interface Dictionary {
  apply(text: string): string;
}

export interface ReloadableDictionary extends Dictionary {
  reload(): void;
}

const NO_OP: Dictionary = { apply: (text) => text };

function parseRules (filePath: string): Array<[string, string]> | null {
  const data = loadYamlAsObject(filePath, 'dictionary.yml はキーと値のペアで構成される必要があります');
  if (data == null) {
    return null;
  }

  const rules: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'string') {
      throw new Error(`辞書キー "${key}" の値は文字列である必要があります`);
    }
    rules.push([key, value]);
  }

  return rules;
}

const WORD_CHAR_RE = /^\w$/;

function escapeRegExp (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPattern (from: string): string {
  const startBoundary = WORD_CHAR_RE.test(from[0]);
  const endBoundary = WORD_CHAR_RE.test(from[from.length - 1]);
  return `${startBoundary ? '\\b' : ''}${escapeRegExp(from)}${endBoundary ? '\\b' : ''}`;
}

function applyRules (text: string, rules: Array<[string, string]>): string {
  if (rules.length === 0) {
    return text;
  }

  // 最長一致のためキー長降順でソート（同じ長さなら定義順を維持）
  const sorted = [...rules].sort((a, b) => b[0].length - a[0].length);
  const ruleMap = new Map<string, string>(sorted);

  const patterns = sorted.map(([from]) => buildPattern(from));
  const combined = new RegExp(patterns.join('|'), 'g');
  return text.replace(combined, (match) => ruleMap.get(match) ?? match);
}

export function loadDictionary (filePath: string): Dictionary {
  const rules = parseRules(filePath);
  if (!rules) {
    return NO_OP;
  }

  return {
    apply (text: string): string {
      return applyRules(text, rules);
    }
  };
}

export function createReloadableDictionary (filePath: string): ReloadableDictionary {
  const reloadable = createReloadableConfig<Array<[string, string]>>({
    filePath,
    parser: parseRules,
    defaultValue: [],
    successLog: (rules) => `辞書を再読み込みしました (${rules.length} ルール)`,
    errorLog: '辞書の再読み込みに失敗しました。前のルールを維持します:'
  });

  return {
    apply (text: string): string {
      const rules = reloadable.getData();
      if (rules.length === 0) {
        return text;
      }
      return applyRules(text, rules);
    },
    reload () {
      reloadable.reload();
    }
  };
}

function readDictionaryData (filePath: string): Record<string, string> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ファイルが存在しないか読めない場合は空から始める
  }
  return {};
}

export async function saveDictionaryEntry (filePath: string, from: string, to: string): Promise<void> {
  const lock = getConfigLock(filePath);
  await lock.withWriteLock(() => {
    const data = readDictionaryData(filePath);
    data[from] = to;
    fs.writeFileSync(filePath, stringify(data), 'utf-8');
  });
}

export async function removeDictionaryEntry (filePath: string, from: string): Promise<void> {
  const lock = getConfigLock(filePath);
  await lock.withWriteLock(() => {
    const data = readDictionaryData(filePath);
    if (!(from in data)) {
      return;
    }
    delete data[from];
    fs.writeFileSync(filePath, stringify(data), 'utf-8');
  });
}

// ギルド辞書

type GuildRulesMap = Map<string, Array<[string, string]>>;

export interface ReloadableGuildDictionary {
  forGuild(guildId: string): Dictionary;
  reloadGlobal(): void;
  reloadGuild(): void;
}

function parseGuildRules (filePath: string): GuildRulesMap | null {
  const data = loadYamlAsObject(filePath, 'dictionary-guild.yml はギルドIDをキーとした構造である必要があります');
  if (data == null) {
    return null;
  }

  const map: GuildRulesMap = new Map();
  for (const [guildId, guildData] of Object.entries(data)) {
    if (guildData == null || typeof guildData !== 'object') {
      continue;
    }
    const rules: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(guildData as Record<string, unknown>)) {
      if (typeof value !== 'string') {
        throw new Error(`ギルド辞書キー "${guildId}.${key}" の値は文字列である必要があります`);
      }
      rules.push([key, value]);
    }
    if (rules.length > 0) {
      map.set(guildId, rules);
    }
  }
  return map;
}

function mergeRules (
  globalRules: Array<[string, string]>,
  guildRules: Array<[string, string]> | undefined
): Array<[string, string]> {
  if (!guildRules || guildRules.length === 0) {
    return globalRules;
  }
  if (globalRules.length === 0) {
    return guildRules;
  }

  // ギルドのキーセットを作成
  const guildKeys = new Set(guildRules.map(([key]) => key));
  // グローバルからギルドで上書きされていないものだけ取り出す
  const filteredGlobal = globalRules.filter(([key]) => !guildKeys.has(key));
  return [...guildRules, ...filteredGlobal];
}

export function createReloadableGuildDictionary (
  globalPath: string,
  guildPath: string
): ReloadableGuildDictionary {
  const globalReloadable = createReloadableConfig<Array<[string, string]>>({
    filePath: globalPath,
    parser: parseRules,
    defaultValue: [],
    successLog: (rules) => `グローバル辞書を再読み込みしました (${rules.length} ルール)`,
    errorLog: 'グローバル辞書の再読み込みに失敗しました。前のルールを維持します:'
  });

  const guildReloadable = createReloadableConfig<GuildRulesMap>({
    filePath: guildPath,
    parser: parseGuildRules,
    defaultValue: new Map(),
    successLog: (map) => `ギルド辞書を再読み込みしました (${map.size} ギルド)`,
    errorLog: 'ギルド辞書の再読み込みに失敗しました。前のルールを維持します:'
  });

  return {
    forGuild (guildId: string): Dictionary {
      const globalRules = globalReloadable.getData();
      const guildRules = guildReloadable.getData().get(guildId);
      const merged = mergeRules(globalRules, guildRules);
      if (merged.length === 0) {
        return NO_OP;
      }
      return {
        apply (text: string): string {
          return applyRules(text, merged);
        }
      };
    },
    reloadGlobal () {
      globalReloadable.reload();
    },
    reloadGuild () {
      guildReloadable.reload();
    }
  };
}

function readGuildDictionaryData (filePath: string): Record<string, Record<string, string>> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, Record<string, string>>;
    }
  } catch {
    // ファイルが存在しないか読めない場合は空から始める
  }
  return {};
}

export async function saveGuildDictionaryEntry (
  filePath: string, guildId: string, from: string, to: string
): Promise<void> {
  const lock = getConfigLock(filePath);
  await lock.withWriteLock(() => {
    const data = readGuildDictionaryData(filePath);
    if (!data[guildId]) {
      data[guildId] = {};
    }
    data[guildId][from] = to;
    fs.writeFileSync(filePath, stringify(data), 'utf-8');
  });
}

export async function removeGuildDictionaryEntry (
  filePath: string, guildId: string, from: string
): Promise<void> {
  const lock = getConfigLock(filePath);
  await lock.withWriteLock(() => {
    const data = readGuildDictionaryData(filePath);
    if (!data[guildId] || !(from in data[guildId])) {
      return;
    }
    delete data[guildId][from];
    if (Object.keys(data[guildId]).length === 0) {
      delete data[guildId];
    }
    fs.writeFileSync(filePath, stringify(data), 'utf-8');
  });
}
