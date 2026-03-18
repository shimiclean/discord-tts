import { loadYamlAsObject } from './yamlLoader';
import { createReloadableConfig } from './reloadableConfig';

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
      if (rules.length === 0) return text;
      return applyRules(text, rules);
    },
    reload () {
      reloadable.reload();
    }
  };
}
