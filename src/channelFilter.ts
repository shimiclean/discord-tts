import { loadYamlAsObject } from './yamlLoader';

export interface ChannelFilter {
  isAllowed(guildId: string, channelId: string): boolean;
}

export function loadChannelFilter (filePath: string): ChannelFilter {
  const data = loadYamlAsObject(filePath, 'channels.yml はギルドIDをキーとするオブジェクトである必要があります');
  if (data == null) {
    return { isAllowed: () => true };
  }

  const allowMap = new Map<string, Set<string> | '*'>();

  for (const [guildId, channels] of Object.entries(data)) {
    if (!Array.isArray(channels)) {
      throw new Error(`ギルド "${guildId}" の値は配列である必要があります`);
    }

    for (const ch of channels) {
      if (typeof ch !== 'string') {
        throw new Error(`ギルド "${guildId}" のチャンネルIDは文字列である必要があります`);
      }
    }

    if (channels.includes('*')) {
      allowMap.set(guildId, '*');
    } else {
      allowMap.set(guildId, new Set(channels));
    }
  }

  return {
    isAllowed (guildId: string, channelId: string): boolean {
      if (!allowMap.has(guildId)) {
        return true;
      }
      const entry = allowMap.get(guildId)!;
      if (entry === '*') {
        return true;
      }
      return entry.has(channelId);
    }
  };
}
