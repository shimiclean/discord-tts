import { ConnectionManager } from './connectionManager';
import { createAudioPlayer } from '@discordjs/voice';

const mockDestroy = jest.fn();
const mockOn = jest.fn();
const mockGetVoiceConnection = jest.fn();

jest.mock('@discordjs/voice', () => ({
  getVoiceConnection: (...args: unknown[]) => mockGetVoiceConnection(...args),
  createAudioPlayer: jest.fn(() => ({
    stop: jest.fn()
  })),
  VoiceConnectionStatus: {
    Disconnected: 'disconnected',
    Signalling: 'signalling',
    Connecting: 'connecting',
    Ready: 'ready',
    Destroyed: 'destroyed'
  },
  entersState: jest.fn().mockRejectedValue(new Error('timeout'))
}));

function createMockConnection (guildId: string) {
  const connection = {
    destroy: mockDestroy,
    on: mockOn,
    rejoinAttempts: 0,
    state: { status: 'ready' },
    guildId
  };
  return connection;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ConnectionManager();
  });

  describe('register', () => {
    it('接続とプレイヤーを登録できる', () => {
      const connection = createMockConnection('guild1') as any;
      const player = createAudioPlayer() as any;

      manager.register('guild1', connection, player);

      expect(manager.getPlayer('guild1')).toBe(player);
    });

    it('同じギルドIDで上書き登録できる', () => {
      const connection1 = createMockConnection('guild1') as any;
      const player1 = createAudioPlayer() as any;
      const connection2 = createMockConnection('guild1') as any;
      const player2 = createAudioPlayer() as any;

      manager.register('guild1', connection1, player1);
      manager.register('guild1', connection2, player2);

      expect(manager.getPlayer('guild1')).toBe(player2);
    });

    it('上書き登録時に旧接続を破棄する', () => {
      const connection1 = createMockConnection('guild1') as any;
      const player1 = createAudioPlayer() as any;
      const connection2 = createMockConnection('guild1') as any;
      const player2 = createAudioPlayer() as any;

      manager.register('guild1', connection1, player1);
      manager.register('guild1', connection2, player2);

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPlayer', () => {
    it('未登録のギルドIDの場合、undefinedを返す', () => {
      expect(manager.getPlayer('unknown')).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('接続を破棄しエントリを削除する', () => {
      const connection = createMockConnection('guild1') as any;
      const player = createAudioPlayer() as any;

      manager.register('guild1', connection, player);
      manager.remove('guild1');

      expect(mockDestroy).toHaveBeenCalled();
      expect(manager.getPlayer('guild1')).toBeUndefined();
    });

    it('プレイヤーを停止する', () => {
      const connection = createMockConnection('guild1') as any;
      const player = createAudioPlayer() as any;

      manager.register('guild1', connection, player);
      manager.remove('guild1');

      expect(player.stop).toHaveBeenCalled();
    });

    it('未登録のギルドIDを削除しても例外を投げない', () => {
      expect(() => manager.remove('unknown')).not.toThrow();
    });
  });

  describe('destroyAll', () => {
    it('全ての接続を破棄する', () => {
      const connection1 = createMockConnection('guild1') as any;
      const player1 = createAudioPlayer() as any;
      const connection2 = createMockConnection('guild2') as any;
      const player2 = createAudioPlayer() as any;

      manager.register('guild1', connection1, player1);
      manager.register('guild2', connection2, player2);

      manager.destroyAll();

      expect(mockDestroy).toHaveBeenCalledTimes(2);
      expect(manager.getPlayer('guild1')).toBeUndefined();
      expect(manager.getPlayer('guild2')).toBeUndefined();
    });

    it('全てのプレイヤーを停止する', () => {
      const connection1 = createMockConnection('guild1') as any;
      const player1 = createAudioPlayer() as any;
      const connection2 = createMockConnection('guild2') as any;
      const player2 = createAudioPlayer() as any;

      manager.register('guild1', connection1, player1);
      manager.register('guild2', connection2, player2);

      manager.destroyAll();

      expect(player1.stop).toHaveBeenCalled();
      expect(player2.stop).toHaveBeenCalled();
    });

    it('登録がない場合でも例外を投げない', () => {
      expect(() => manager.destroyAll()).not.toThrow();
    });
  });

  describe('has', () => {
    it('登録済みのギルドIDに対してtrueを返す', () => {
      const connection = createMockConnection('guild1') as any;
      const player = createAudioPlayer() as any;

      manager.register('guild1', connection, player);

      expect(manager.has('guild1')).toBe(true);
    });

    it('未登録のギルドIDに対してfalseを返す', () => {
      expect(manager.has('unknown')).toBe(false);
    });
  });
});
