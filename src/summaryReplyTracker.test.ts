import { SummaryReplyTracker, MAX_TRACKED_REPLIES } from './summaryReplyTracker';

describe('SummaryReplyTracker', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createReply (id: string) {
    return { id, delete: jest.fn().mockResolvedValue(undefined) } as any;
  }

  it('追跡中の元メッセージが削除されたらリプライを削除する', async () => {
    const tracker = new SummaryReplyTracker();
    const reply = createReply('reply1');
    tracker.track('guild1', 'msg1', reply);
    await tracker.handleDelete('guild1', 'msg1');
    expect(reply.delete).toHaveBeenCalledTimes(1);
  });

  it('未追跡の元メッセージが削除されても何もしない', async () => {
    const tracker = new SummaryReplyTracker();
    const reply = createReply('reply1');
    tracker.track('guild1', 'msg1', reply);
    await tracker.handleDelete('guild1', 'msg2');
    expect(reply.delete).not.toHaveBeenCalled();
  });

  it('未追跡のギルドの削除通知では何もしない', async () => {
    const tracker = new SummaryReplyTracker();
    const reply = createReply('reply1');
    tracker.track('guild1', 'msg1', reply);
    await tracker.handleDelete('guild2', 'msg1');
    expect(reply.delete).not.toHaveBeenCalled();
  });

  it('同じ元メッセージを再追跡した場合は最新のリプライだけを削除する', async () => {
    const tracker = new SummaryReplyTracker();
    const oldReply = createReply('reply1');
    const newReply = createReply('reply2');
    tracker.track('guild1', 'msg1', oldReply);
    tracker.track('guild1', 'msg1', newReply);
    await tracker.handleDelete('guild1', 'msg1');
    expect(oldReply.delete).not.toHaveBeenCalled();
    expect(newReply.delete).toHaveBeenCalledTimes(1);
  });

  it('同じ元メッセージの削除通知が二重に届いても一度しか削除しない', async () => {
    const tracker = new SummaryReplyTracker();
    const reply = createReply('reply1');
    tracker.track('guild1', 'msg1', reply);
    await tracker.handleDelete('guild1', 'msg1');
    await tracker.handleDelete('guild1', 'msg1');
    expect(reply.delete).toHaveBeenCalledTimes(1);
  });

  it('untrack したリプライは削除されない', async () => {
    const tracker = new SummaryReplyTracker();
    const reply = createReply('reply1');
    tracker.track('guild1', 'msg1', reply);
    tracker.untrack(reply);
    await tracker.handleDelete('guild1', 'msg1');
    expect(reply.delete).not.toHaveBeenCalled();
  });

  it('untrack は他のギルドの追跡に影響しない', async () => {
    const tracker = new SummaryReplyTracker();
    const reply1 = createReply('reply1');
    const reply2 = createReply('reply2');
    tracker.track('guild1', 'msg1', reply1);
    tracker.track('guild2', 'msg2', reply2);
    tracker.untrack(reply1);
    await tracker.handleDelete('guild2', 'msg2');
    expect(reply2.delete).toHaveBeenCalledTimes(1);
  });

  it('未追跡のリプライを untrack してもエラーにならない', () => {
    const tracker = new SummaryReplyTracker();
    expect(() => tracker.untrack(createReply('reply1'))).not.toThrow();
  });

  it('削除に失敗した場合はリトライし、最終的に警告ログのみ出す', async () => {
    const tracker = new SummaryReplyTracker();
    const reply = { id: 'reply1', delete: jest.fn().mockRejectedValue(new Error('削除失敗')) } as any;
    tracker.track('guild1', 'msg1', reply);
    await expect(tracker.handleDelete('guild1', 'msg1')).resolves.toBeUndefined();
    expect(reply.delete).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('削除エラー'));
  });

  describe('追跡数の上限', () => {
    function fillGuild (tracker: SummaryReplyTracker, guildId: string, count: number) {
      const replies = [];
      for (let i = 0; i < count; i++) {
        const reply = createReply(`${guildId}-reply${i}`);
        replies.push(reply);
        tracker.track(guildId, `${guildId}-msg${i}`, reply);
      }
      return replies;
    }

    it('上限ちょうどの件数はすべて保持する', async () => {
      const tracker = new SummaryReplyTracker();
      const replies = fillGuild(tracker, 'guild1', MAX_TRACKED_REPLIES);
      await tracker.handleDelete('guild1', 'guild1-msg0');
      expect(replies[0].delete).toHaveBeenCalledTimes(1);
    });

    it('上限を超えた場合は同一ギルドの最も古い追跡を破棄する', async () => {
      const tracker = new SummaryReplyTracker();
      const replies = fillGuild(tracker, 'guild1', MAX_TRACKED_REPLIES + 1);
      await tracker.handleDelete('guild1', 'guild1-msg0');
      expect(replies[0].delete).not.toHaveBeenCalled();
      await tracker.handleDelete('guild1', 'guild1-msg1');
      expect(replies[1].delete).toHaveBeenCalledTimes(1);
      await tracker.handleDelete('guild1', `guild1-msg${MAX_TRACKED_REPLIES}`);
      expect(replies[MAX_TRACKED_REPLIES].delete).toHaveBeenCalledTimes(1);
    });

    it('上限はギルドごとに独立している', async () => {
      const tracker = new SummaryReplyTracker();
      const guild2Replies = fillGuild(tracker, 'guild2', 1);
      fillGuild(tracker, 'guild1', MAX_TRACKED_REPLIES + 1);
      // guild1 が上限を超えても guild2 の追跡は押し出されない
      await tracker.handleDelete('guild2', 'guild2-msg0');
      expect(guild2Replies[0].delete).toHaveBeenCalledTimes(1);
    });
  });
});
