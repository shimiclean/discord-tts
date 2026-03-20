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

const ASCII_CHAR_RE = /^[\x21-\x7E]$/;

function escapeRegExp (s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildReplacer (from: string): (text: string, to: string) => string {
  const startBoundary = ASCII_CHAR_RE.test(from[0]);
  const endBoundary = ASCII_CHAR_RE.test(from[from.length - 1]);
  if (!startBoundary && !endBoundary) {
    return (text, to) => text.replaceAll(from, to);
  }
  const pattern = `${startBoundary ? '\\b' : ''}${escapeRegExp(from)}${endBoundary ? '\\b' : ''}`;
  const re = new RegExp(pattern, 'g');
  return (text, to) => text.replace(re, to);
}

function applyRules (text: string, rules: Array<[string, string]>): string {
  let result = text;
  for (const [from, to] of rules) {
    const replacer = buildReplacer(from);
    result = replacer(result, to);
  }
  return result;
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
