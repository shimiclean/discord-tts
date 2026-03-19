import * as fs from 'fs';
import { parse } from 'yaml';
import { getConfigLock } from './configLock';

const HEADER = [
  '# ボイスチャンネルに参加したユーザーの記録',
  '# speakers.yml 作成時のID参照用'
].join('\n');

interface GuildEntry {
  name: string;
  users: Map<string, string>;
}

export class VoiceMemberLog {
  private readonly filePath: string;
  private readonly guilds: Map<string, GuildEntry>;

  constructor (filePath: string) {
    this.filePath = filePath;
    this.guilds = this.load();
  }

  record (guildId: string, guildName: string, userId: string, displayName: string): void {
    let guild = this.guilds.get(guildId);
    if (!guild) {
      guild = { name: guildName, users: new Map() };
      this.guilds.set(guildId, guild);
    }
    guild.name = guildName;
    guild.users.set(userId, displayName);
    const lock = getConfigLock(this.filePath);
    lock.withWriteLockSync(() => this.save());
  }

  private load (): Map<string, GuildEntry> {
    const guilds = new Map<string, GuildEntry>();

    if (!fs.existsSync(this.filePath)) {
      return guilds;
    }

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = parse(content);
      if (data == null || typeof data !== 'object' || Array.isArray(data)) {
        return guilds;
      }

      // コメントからギルド名を抽出
      const guildNames = new Map<string, string>();
      for (const line of content.split('\n')) {
        const match = line.match(/^"([^"]+)":\s*#\s*(.+)$/);
        if (match) {
          guildNames.set(match[1], match[2].trim());
        }
      }

      for (const [guildId, guildValue] of Object.entries(data)) {
        if (typeof guildValue !== 'object' || guildValue === null) {
          continue;
        }
        const gv = guildValue as Record<string, unknown>;
        const users = new Map<string, string>();
        if (gv.users && typeof gv.users === 'object' && !Array.isArray(gv.users)) {
          for (const [userId, name] of Object.entries(gv.users as Record<string, unknown>)) {
            if (typeof name === 'string') {
              users.set(userId, name);
            }
          }
        }
        guilds.set(guildId, {
          name: guildNames.get(guildId) ?? guildId,
          users
        });
      }
    } catch {
      // 読み込みエラーは無視して空で開始
    }

    return guilds;
  }

  private save (): void {
    const lines: string[] = [HEADER, ''];

    const guildEntries = Array.from(this.guilds.entries());
    for (let i = 0; i < guildEntries.length; i++) {
      const [guildId, guild] = guildEntries[i];
      lines.push(`"${guildId}": # ${guild.name}`);
      lines.push('  users:');
      for (const [userId, name] of guild.users) {
        lines.push(`    "${userId}": ${name}`);
      }
      if (i < guildEntries.length - 1) {
        lines.push('');
      }
    }

    lines.push('');
    fs.writeFileSync(this.filePath, lines.join('\n'), 'utf-8');
  }
}
