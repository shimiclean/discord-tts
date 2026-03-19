import {
  VoiceConnection,
  VoiceConnectionStatus,
  AudioPlayer,
  entersState
} from '@discordjs/voice';

interface ConnectionEntry {
  connection: VoiceConnection;
  player: AudioPlayer;
}

export class ConnectionManager {
  private entries = new Map<string, ConnectionEntry>();

  register (guildId: string, connection: VoiceConnection, player: AudioPlayer): void {
    const existing = this.entries.get(guildId);
    if (existing) {
      existing.connection.destroy();
    }
    this.entries.set(guildId, { connection, player });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // 再接続を試みる（5秒以内に Connecting か Ready になることを期待）
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch {
        // 再接続に失敗した場合、接続を破棄する
        this.remove(guildId);
      }
    });
  }

  getPlayer (guildId: string): AudioPlayer | undefined {
    return this.entries.get(guildId)?.player;
  }

  has (guildId: string): boolean {
    return this.entries.has(guildId);
  }

  remove (guildId: string): void {
    const entry = this.entries.get(guildId);
    if (entry) {
      entry.player.stop();
      entry.connection.destroy();
      this.entries.delete(guildId);
    }
  }

  destroyAll (): void {
    for (const [, entry] of this.entries) {
      entry.player.stop();
      entry.connection.destroy();
    }
    this.entries.clear();
  }
}
