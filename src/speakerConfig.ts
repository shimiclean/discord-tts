import * as fs from 'fs';
import { stringify, parse } from 'yaml';
import { loadYamlAsObject } from './yamlLoader';
import { createReloadableConfig } from './reloadableConfig';
import { getConfigLock } from './configLock';

export interface TtsVoiceConfig {
  model?: string;
  voice?: string;
}

interface UserConfig extends TtsVoiceConfig {
  userName?: string;
}

interface GuildConfig {
  guildName?: string;
  model?: string;
  voice?: string;
  users: Record<string, UserConfig>;
}

type SpeakerData = Map<string, GuildConfig>;

export interface SpeakerConfig {
  resolve(guildId: string, userId: string): TtsVoiceConfig;
}

export interface ReloadableSpeakerConfig extends SpeakerConfig {
  reload(): void;
}

const EMPTY: SpeakerData = new Map();

function validateUserEntry (guildKey: string, userKey: string, entry: unknown): UserConfig {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    throw new Error(`speakers.yml: ギルド "${guildKey}" のユーザー "${userKey}" はオブジェクトである必要があります`);
  }
  const obj = entry as Record<string, unknown>;
  const result: UserConfig = {};
  if ('user-name' in obj) {
    if (typeof obj['user-name'] !== 'string') {
      throw new Error(`speakers.yml: ギルド "${guildKey}" のユーザー "${userKey}" の user-name は文字列である必要があります`);
    }
    result.userName = obj['user-name'];
  }
  if ('model' in obj) {
    if (typeof obj.model !== 'string') {
      throw new Error(`speakers.yml: ギルド "${guildKey}" のユーザー "${userKey}" の model は文字列である必要があります`);
    }
    result.model = obj.model;
  }
  if ('voice' in obj) {
    if (typeof obj.voice !== 'string') {
      throw new Error(`speakers.yml: ギルド "${guildKey}" のユーザー "${userKey}" の voice は文字列である必要があります`);
    }
    result.voice = obj.voice;
  }
  return result;
}

function parseSpeakers (filePath: string): SpeakerData | null {
  const data = loadYamlAsObject(filePath, 'speakers.yml はギルドIDをキーとするオブジェクトである必要があります');
  if (data == null) {
    return null;
  }

  const result: SpeakerData = new Map();

  for (const [guildKey, guildValue] of Object.entries(data)) {
    if (typeof guildValue !== 'object' || guildValue === null || Array.isArray(guildValue)) {
      throw new Error(`speakers.yml: ギルド "${guildKey}" の値はオブジェクトである必要があります`);
    }

    const gv = guildValue as Record<string, unknown>;
    const guildConfig: GuildConfig = { users: {} };

    if ('guild-name' in gv) {
      if (typeof gv['guild-name'] !== 'string') {
        throw new Error(`speakers.yml: ギルド "${guildKey}" の guild-name は文字列である必要があります`);
      }
      guildConfig.guildName = gv['guild-name'];
    }

    if ('model' in gv) {
      if (typeof gv.model !== 'string') {
        throw new Error(`speakers.yml: ギルド "${guildKey}" の model は文字列である必要があります`);
      }
      guildConfig.model = gv.model;
    }

    if ('voice' in gv) {
      if (typeof gv.voice !== 'string') {
        throw new Error(`speakers.yml: ギルド "${guildKey}" の voice は文字列である必要があります`);
      }
      guildConfig.voice = gv.voice;
    }

    if ('users' in gv) {
      if (typeof gv.users !== 'object' || gv.users === null || Array.isArray(gv.users)) {
        throw new Error(`speakers.yml: ギルド "${guildKey}" の users はオブジェクトである必要があります`);
      }
      for (const [userKey, userValue] of Object.entries(gv.users as Record<string, unknown>)) {
        guildConfig.users[userKey] = validateUserEntry(guildKey, userKey, userValue);
      }
    }

    result.set(guildKey, guildConfig);
  }

  return result;
}

function resolveFromData (data: SpeakerData, guildId: string, userId: string): TtsVoiceConfig {
  const guild = data.get(guildId);
  if (!guild) {
    return {};
  }

  const result: TtsVoiceConfig = {};

  // ギルドレベルのデフォルト
  if (guild.model !== undefined) {
    result.model = guild.model;
  }
  if (guild.voice !== undefined) {
    result.voice = guild.voice;
  }

  // ユーザーレベルの上書き
  const userConfig = guild.users[userId];
  if (userConfig) {
    if (userConfig.model !== undefined) {
      result.model = userConfig.model;
    }
    if (userConfig.voice !== undefined) {
      result.voice = userConfig.voice;
    }
  }

  return result;
}

export function loadSpeakerConfig (filePath: string): SpeakerConfig {
  const data = parseSpeakers(filePath) ?? EMPTY;

  return {
    resolve (guildId: string, userId: string): TtsVoiceConfig {
      return resolveFromData(data, guildId, userId);
    }
  };
}

export async function saveUserVoiceSetting (
  filePath: string, guildId: string, userId: string, voice: TtsVoiceConfig,
  guildName?: string, userName?: string
): Promise<void> {
  const lock = getConfigLock(filePath);
  await lock.withWriteLock(() => {
    let data: Record<string, unknown> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // ファイルが存在しないか読めない場合は空から始める
    }

    let guild = (data[guildId] as Record<string, unknown>) ?? {};
    if (guildName) {
      const reordered: Record<string, unknown> = { 'guild-name': guildName };
      for (const [k, v] of Object.entries(guild)) {
        if (k !== 'guild-name') {
          reordered[k] = v;
        }
      }
      guild = reordered;
    }

    const users = (guild.users as Record<string, unknown>) ?? {};
    const userEntry: Record<string, unknown> = {};
    if (userName) {
      userEntry['user-name'] = userName;
    }
    if (voice.model !== undefined) {
      userEntry.model = voice.model;
    }
    if (voice.voice !== undefined) {
      userEntry.voice = voice.voice;
    }
    users[userId] = userEntry;
    guild.users = users;
    data[guildId] = guild;

    fs.writeFileSync(filePath, stringify(data), 'utf-8');
  });
}

export async function removeUserVoiceSetting (filePath: string, guildId: string, userId: string): Promise<void> {
  const lock = getConfigLock(filePath);
  await lock.withWriteLock(() => {
    let data: Record<string, unknown> = {};
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      return;
    }

    const guild = data[guildId] as Record<string, unknown> | undefined;
    if (!guild) {
      return;
    }
    const users = guild.users as Record<string, unknown> | undefined;
    if (!users || !(userId in users)) {
      return;
    }

    delete users[userId];
    fs.writeFileSync(filePath, stringify(data), 'utf-8');
  });
}

export function createReloadableSpeakerConfig (filePath: string): ReloadableSpeakerConfig {
  const reloadable = createReloadableConfig<SpeakerData>({
    filePath,
    parser: parseSpeakers,
    defaultValue: EMPTY,
    successLog: (data) => `話者設定を再読み込みしました (${data.size} ギルド)`,
    errorLog: '話者設定の再読み込みに失敗しました。前の設定を維持します:'
  });

  return {
    resolve (guildId: string, userId: string): TtsVoiceConfig {
      return resolveFromData(reloadable.getData(), guildId, userId);
    },
    reload () {
      reloadable.reload();
    }
  };
}
