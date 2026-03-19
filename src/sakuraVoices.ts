import * as fs from 'fs';

export interface SakuraCharacter {
  name: string;
  modelId: string;
}

export interface SakuraStyle {
  name: string;
  voiceId: string;
}

export interface SakuraVoices {
  getCharacters(): SakuraCharacter[];
  getStyles(modelId: string): SakuraStyle[];
  isValidCombination(modelId: string, voiceId: string): boolean;
}

export function loadSakuraVoices (csvPath: string): SakuraVoices {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1); // ヘッダーをスキップ

  const characterMap = new Map<string, { name: string; styles: SakuraStyle[] }>();

  for (const line of lines) {
    const [charName, modelId, styleName, voiceId] = line.split(',');
    if (!characterMap.has(modelId)) {
      characterMap.set(modelId, { name: charName, styles: [] });
    }
    characterMap.get(modelId)!.styles.push({ name: styleName, voiceId });
  }

  return {
    getCharacters () {
      return [...characterMap.entries()].map(([modelId, { name }]) => ({ name, modelId }));
    },
    getStyles (modelId: string) {
      return characterMap.get(modelId)?.styles ?? [];
    },
    isValidCombination (modelId: string, voiceId: string) {
      const styles = characterMap.get(modelId)?.styles;
      if (!styles) {
        return false;
      }
      return styles.some((s) => s.voiceId === voiceId);
    }
  };
}
