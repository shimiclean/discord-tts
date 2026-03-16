import * as fs from 'fs';
import { parse } from 'yaml';

export interface Dictionary {
  apply(text: string): string;
}

const NO_OP: Dictionary = { apply: (text) => text };

export function loadDictionary (filePath: string): Dictionary {
  if (!fs.existsSync(filePath)) {
    return NO_OP;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = parse(content);

  if (data == null) {
    return NO_OP;
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

  return {
    apply (text: string): string {
      let result = text;
      for (const [from, to] of rules) {
        result = result.replaceAll(from, to);
      }
      return result;
    }
  };
}
