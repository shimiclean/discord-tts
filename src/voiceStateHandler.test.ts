import { handleVoiceStateUpdate, VoiceStateHandlerDeps } from './voiceStateHandler';

describe('handleVoiceStateUpdate', () => {
  let deps: VoiceStateHandlerDeps;
  let enqueueTts: jest.Mock;
  let joinChannel: jest.Mock;
  let recordMember: jest.Mock;

  beforeEach(() => {
    enqueueTts = jest.fn();
    joinChannel = jest.fn();
    recordMember = jest.fn();
    deps = {
      botUserId: 'bot123',
      defaultTtsModel: 'default-model',
      enqueueTts,
      joinChannel,
      recordMember,
      connections: {
        has: jest.fn().mockReturnValue(true),
        remove: jest.fn()
      },
      channelFilter: {
        isAllowed: jest.fn().mockReturnValue(true)
      },
      lastSpeakerTracker: {
        clear: jest.fn()
      },
      speakerConfig: {
        resolve: jest.fn().mockReturnValue({})
      },
      dictionary: {
        apply: (t: string) => t
      }
    };
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createState (opts: {
    channelId?: string | null;
    channelName?: string;
    channelType?: number;
    guildId?: string;
    guildName?: string;
    streaming?: boolean;
    selfVideo?: boolean;
    memberBot?: boolean;
    memberId?: string;
    memberNickname?: string | null;
    memberDisplayName?: string;
    members?: Array<{ id: string; bot: boolean; displayName: string }>;
  }) {
    const members = opts.members ?? [];
    const membersMap = new Map(members.map((m) => [m.id, { id: m.id, user: { bot: m.bot }, displayName: m.displayName }]));
    return {
      channelId: opts.channelId ?? null,
      channel: opts.channelId
        ? {
            id: opts.channelId,
            name: opts.channelName ?? 'テストチャンネル',
            type: opts.channelType ?? 2,
            members: membersMap
          }
        : null,
      guild: {
        id: opts.guildId ?? 'guild1',
        name: opts.guildName ?? 'テストギルド',
        voiceAdapterCreator: {}
      },
      member: {
        user: { bot: opts.memberBot ?? false },
        id: opts.memberId ?? 'user1',
        nickname: opts.memberNickname ?? null,
        displayName: opts.memberDisplayName ?? 'テストユーザー'
      },
      streaming: opts.streaming ?? false,
      selfVideo: opts.selfVideo ?? false
    } as any;
  }

  describe('Botユーザーの場合', () => {
    it('何もしない', () => {
      const oldState = createState({ channelId: 'ch1', memberBot: true });
      const newState = createState({ channelId: 'ch1', memberBot: true });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(enqueueTts).not.toHaveBeenCalled();
    });
  });

  describe('チャンネル変更なし（状態変化のみ）', () => {
    it('Botが接続していないギルドでは何もしない', () => {
      (deps.connections.has as jest.Mock).mockReturnValue(false);
      const oldState = createState({ channelId: 'ch1', streaming: false });
      const newState = createState({ channelId: 'ch1', streaming: true });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(enqueueTts).not.toHaveBeenCalled();
    });

    describe('配信状態の変化', () => {
      it('配信開始で読み上げる', () => {
        (deps.speakerConfig.resolve as jest.Mock).mockReturnValue({ model: 'test-model' });
        const oldState = createState({ channelId: 'ch1', streaming: false });
        const newState = createState({ channelId: 'ch1', streaming: true });
        handleVoiceStateUpdate(oldState, newState, deps);
        expect(enqueueTts).toHaveBeenCalledWith(
          'guild1',
          'テストユーザーがライブ配信を開始しました',
          { model: 'test-model' }
        );
      });

      it('配信終了で読み上げる', () => {
        const oldState = createState({ channelId: 'ch1', streaming: true });
        const newState = createState({ channelId: 'ch1', streaming: false });
        handleVoiceStateUpdate(oldState, newState, deps);
        expect(enqueueTts).toHaveBeenCalledWith(
          'guild1',
          expect.stringContaining('ライブ配信を終了しました'),
          expect.anything()
        );
      });

      it('zundamonモデルで配信開始', () => {
        (deps.speakerConfig.resolve as jest.Mock).mockReturnValue({ model: 'zundamon' });
        const oldState = createState({ channelId: 'ch1', streaming: false });
        const newState = createState({ channelId: 'ch1', streaming: true });
        handleVoiceStateUpdate(oldState, newState, deps);
        expect(enqueueTts).toHaveBeenCalledWith(
          'guild1',
          'テストユーザーがライブ配信を開始したのだ',
          { model: 'zundamon' }
        );
      });
    });

    describe('カメラ状態の変化', () => {
      it('カメラONで読み上げる', () => {
        const oldState = createState({ channelId: 'ch1', selfVideo: false });
        const newState = createState({ channelId: 'ch1', selfVideo: true });
        handleVoiceStateUpdate(oldState, newState, deps);
        expect(enqueueTts).toHaveBeenCalledWith(
          'guild1',
          expect.stringContaining('カメラをつけました'),
          expect.anything()
        );
      });

      it('カメラOFFで読み上げる', () => {
        const oldState = createState({ channelId: 'ch1', selfVideo: true });
        const newState = createState({ channelId: 'ch1', selfVideo: false });
        handleVoiceStateUpdate(oldState, newState, deps);
        expect(enqueueTts).toHaveBeenCalledWith(
          'guild1',
          expect.stringContaining('カメラを切りました'),
          expect.anything()
        );
      });
    });

    it('配信とカメラの両方が変化した場合は両方読み上げる', () => {
      const oldState = createState({ channelId: 'ch1', streaming: false, selfVideo: false });
      const newState = createState({ channelId: 'ch1', streaming: true, selfVideo: true });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(enqueueTts).toHaveBeenCalledTimes(2);
    });

    it('変化なしの場合は何もしない', () => {
      const oldState = createState({ channelId: 'ch1', streaming: false, selfVideo: false });
      const newState = createState({ channelId: 'ch1', streaming: false, selfVideo: false });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(enqueueTts).not.toHaveBeenCalled();
    });
  });

  describe('チャンネルからの退出', () => {
    it('Bot以外全員退出したらBotも退出する', () => {
      const oldState = createState({
        channelId: 'ch1',
        members: [{ id: 'bot123', bot: true, displayName: 'Bot' }]
      });
      const newState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(deps.connections.remove).toHaveBeenCalledWith('guild1');
      expect(deps.lastSpeakerTracker.clear).toHaveBeenCalledWith('guild1');
      // Botも退出する場合は退出メッセージを読み上げない
      expect(enqueueTts).not.toHaveBeenCalled();
    });

    it('まだ他ユーザーがいる場合は退出メッセージを読み上げる', () => {
      const oldState = createState({
        channelId: 'ch1',
        members: [
          { id: 'bot123', bot: true, displayName: 'Bot' },
          { id: 'other', bot: false, displayName: 'Other' }
        ]
      });
      const newState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(deps.connections.remove).not.toHaveBeenCalled();
      expect(enqueueTts).toHaveBeenCalledWith(
        'guild1',
        expect.stringContaining('退出しました'),
        expect.anything()
      );
    });

    it('GuildVoice以外のチャンネルは無視する', () => {
      const oldState = createState({ channelId: 'ch1', channelType: 13 }); // StageVoice
      const newState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(deps.connections.remove).not.toHaveBeenCalled();
      expect(enqueueTts).not.toHaveBeenCalled();
    });
  });

  describe('チャンネルへの参加', () => {
    it('Botが未接続の場合にチャンネルに参加する', () => {
      (deps.connections.has as jest.Mock).mockReturnValue(false);
      const newState = createState({
        channelId: 'ch1',
        members: [{ id: 'user1', bot: false, displayName: 'テストユーザー' }]
      });
      const oldState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(joinChannel).toHaveBeenCalledWith(newState);
    });

    it('参加メッセージを読み上げる', () => {
      // oldState.channelがnullなので退出判定のhas呼び出しはない
      (deps.connections.has as jest.Mock)
        .mockReturnValueOnce(false) // 参加判定時
        .mockReturnValueOnce(true); // 参加メッセージ送信判定時
      const newState = createState({
        channelId: 'ch1',
        members: [{ id: 'user1', bot: false, displayName: 'テストユーザー' }]
      });
      const oldState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(enqueueTts).toHaveBeenCalledWith(
        'guild1',
        expect.stringContaining('参加しました'),
        expect.anything()
      );
    });

    it('チャンネルフィルタで拒否された場合は参加しない', () => {
      (deps.connections.has as jest.Mock).mockReturnValue(false);
      (deps.channelFilter.isAllowed as jest.Mock).mockReturnValue(false);
      const newState = createState({
        channelId: 'ch1',
        members: [{ id: 'user1', bot: false, displayName: 'テストユーザー' }]
      });
      const oldState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(joinChannel).not.toHaveBeenCalled();
    });

    it('GuildVoice以外のチャンネルは無視する', () => {
      (deps.connections.has as jest.Mock).mockReturnValue(false);
      const newState = createState({ channelId: 'ch1', channelType: 13 });
      const oldState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(joinChannel).not.toHaveBeenCalled();
    });

    it('Botが既に接続中の場合は参加しない', () => {
      (deps.connections.has as jest.Mock).mockReturnValue(true);
      const newState = createState({ channelId: 'ch1' });
      const oldState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(joinChannel).not.toHaveBeenCalled();
    });

    it('参加時にメンバーを記録する', () => {
      (deps.connections.has as jest.Mock)
        .mockReturnValueOnce(false) // 参加判定
        .mockReturnValueOnce(true); // メンバー記録判定
      const newState = createState({
        channelId: 'ch1',
        memberId: 'user1',
        memberDisplayName: 'テストユーザー',
        guildId: 'guild1',
        guildName: 'テストギルド'
      });
      const oldState = createState({ channelId: null });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(recordMember).toHaveBeenCalledWith('guild1', 'テストギルド', 'user1', 'テストユーザー');
    });
  });

  describe('チャンネル移動', () => {
    it('旧チャンネルの退出処理を先に行い、その後に新チャンネルへの参加判定を行う', () => {
      const callOrder: string[] = [];
      (deps.connections.remove as jest.Mock).mockImplementation(() => callOrder.push('remove'));
      joinChannel.mockImplementation(() => callOrder.push('join'));

      // 旧チャンネル: Botのみ残る（Bot退出条件を満たす）
      const oldState = createState({
        channelId: 'ch1',
        members: [{ id: 'bot123', bot: true, displayName: 'Bot' }]
      });
      // 新チャンネル: ユーザーがいる（Bot参加条件を満たす）
      // shouldBotLeaveがtrueを返すので退出ブロックではconnections.hasは呼ばれない
      (deps.connections.has as jest.Mock)
        .mockReturnValueOnce(false) // 参加判定: 退出後なので未接続
        .mockReturnValueOnce(true); // 参加メッセージ判定
      const newState = createState({
        channelId: 'ch2',
        members: [{ id: 'user1', bot: false, displayName: 'テストユーザー' }]
      });
      handleVoiceStateUpdate(oldState, newState, deps);
      expect(callOrder).toEqual(['remove', 'join']);
    });
  });
});
