import * as fs from 'fs';
import { parse } from 'yaml';

export interface Dictionary {
  apply(text: string): string;
}

export interface ReloadableDictionary extends Dictionary {
  close(): void;
}

const NO_OP: Dictionary = { apply: (text) => text };

function parseRules (filePath: string): Array<[string, string]> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = parse(content);

  if (data == null) {
    return null;
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('dictionary.yml はキーと値のペアで構成される必要があります');
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

function applyRules (text: string, rules: Array<[string, string]>): string {
  let result = text;
  for (const [from, to] of rules) {
    result = result.replaceAll(from, to);
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

export function createReloadableDictionary (filePath: string, pollInterval: number = 5000): ReloadableDictionary {
  let rules: Array<[string, string]> = [];
  const initialRules = parseRules(filePath);
  if (initialRules) {
    rules = initialRules;
  }

  let watching = true;

  function reload () {
    try {
      const newRules = parseRules(filePath);
      rules = newRules ?? [];
      console.log(`辞書を再読み込みしました (${rules.length} ルール)`);
    } catch (e) {
      console.error('辞書の再読み込みに失敗しました。前のルールを維持します:', e instanceof Error ? e.message : e);
    }
  }

  fs.watchFile(filePath, { interval: pollInterval }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      reload();
    }
  });

  return {
    apply (text: string): string {
      if (rules.length === 0) return text;
      return applyRules(text, rules);
    },
    close () {
      if (watching) {
        fs.unwatchFile(filePath);
        watching = false;
      }
    }
  };
}
