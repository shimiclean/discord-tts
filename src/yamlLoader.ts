import * as fs from 'fs';
import { parse } from 'yaml';

export function loadYamlAsObject (filePath: string, errorMessage: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const data = parse(content);

  if (data == null) {
    return null;
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(errorMessage);
  }

  return data as Record<string, unknown>;
}
