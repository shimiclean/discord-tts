import { LastSpeakerTracker, SAME_SPEAKER_THRESHOLD_MS } from './lastSpeakerTracker';

describe('LastSpeakerTracker', () => {
  const THRESHOLD = SAME_SPEAKER_THRESHOLD_MS;

  let tracker: LastSpeakerTracker;

  beforeEach(() => {
    tracker = new LastSpeakerTracker(THRESHOLD);
  });

  describe('shouldSkipName', () => {
    it('最初の発言では名前を省略しない', () => {
      const result = tracker.shouldSkipName('guild1', 'user1', 1000);
      expect(result).toBe(false);
    });

    it('同一人物が閾値以内に連続発言したら名前を省略する', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      const result = tracker.shouldSkipName('guild1', 'user1', 5000);
      expect(result).toBe(true);
    });

    it('同一人物でも閾値を超えたら名前を省略しない', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      const result = tracker.shouldSkipName('guild1', 'user1', 12000);
      expect(result).toBe(false);
    });

    it('異なる人物の発言では名前を省略しない', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      const result = tracker.shouldSkipName('guild1', 'user2', 2000);
      expect(result).toBe(false);
    });

    it('異なるギルドは独立して追跡する', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      const result = tracker.shouldSkipName('guild2', 'user1', 2000);
      expect(result).toBe(false);
    });

    it('発言のたびに時刻が更新される', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      tracker.shouldSkipName('guild1', 'user1', 5000);
      // 5000から10秒以内（14000）なので省略する
      const result = tracker.shouldSkipName('guild1', 'user1', 14000);
      expect(result).toBe(true);
    });

    it('別人の発言後に元の人が閾値以内に発言しても省略しない', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      tracker.shouldSkipName('guild1', 'user2', 2000);
      const result = tracker.shouldSkipName('guild1', 'user1', 3000);
      expect(result).toBe(false);
    });
  });

  describe('境界値', () => {
    it('ちょうど閾値と同じ時間差では名前を省略する', () => {
      tracker.shouldSkipName('guild1', 'user1', 0);
      const result = tracker.shouldSkipName('guild1', 'user1', THRESHOLD);
      expect(result).toBe(true);
    });

    it('閾値を1ミリ秒超えたら名前を省略しない', () => {
      tracker.shouldSkipName('guild1', 'user1', 0);
      const result = tracker.shouldSkipName('guild1', 'user1', THRESHOLD + 1);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('ギルドの追跡情報を削除する', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      tracker.clear('guild1');
      const result = tracker.shouldSkipName('guild1', 'user1', 2000);
      expect(result).toBe(false);
    });

    it('他のギルドの追跡情報には影響しない', () => {
      tracker.shouldSkipName('guild1', 'user1', 1000);
      tracker.shouldSkipName('guild2', 'user1', 1000);
      tracker.clear('guild1');
      const result = tracker.shouldSkipName('guild2', 'user1', 2000);
      expect(result).toBe(true);
    });
  });
});
