import { formatTtsMessage, formatJoinMessage, formatLeaveMessage, formatStreamStartMessage, formatStreamEndMessage, formatCameraOnMessage, formatCameraOffMessage, formatImageSummary, formatImageSummaryReply } from './ttsFormatter';
import { Dictionary } from './dictionary';

describe('formatTtsMessage', () => {
  const defaultUser = {
    nickname: 'テスト太郎',
    displayName: '表示名'
  };

  describe('ユーザー名の付加', () => {
    it('サーバーニックネームを優先して付加する', () => {
      const result = formatTtsMessage('こんにちは', defaultUser);
      expect(result).toBe('テスト太郎、こんにちは');
    });

    it('ニックネームがない場合は表示名を使う', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: null,
        displayName: '表示名'
      });
      expect(result).toBe('表示名、こんにちは');
    });

    it('skipNameがtrueの場合はユーザー名を省略する', () => {
      const result = formatTtsMessage('こんにちは', defaultUser, undefined, undefined, true);
      expect(result).toBe('こんにちは');
    });

    it('skipNameがtrueでも本文が空なら空文字を返す', () => {
      const result = formatTtsMessage('', defaultUser, undefined, undefined, true);
      expect(result).toBe('');
    });

    it('skipNameがtrueでも画像添付は読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 1, video: 0 }, true);
      expect(result).toBe('画像');
    });

    it('skipNameがfalseの場合は通常通りユーザー名を付加する', () => {
      const result = formatTtsMessage('こんにちは', defaultUser, undefined, undefined, false);
      expect(result).toBe('テスト太郎、こんにちは');
    });
  });

  describe('ユーザー名のサニタイズ', () => {
    it('ユーザー名からカスタム絵文字を削除する', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: '太郎<:smile:123>',
        displayName: '表示名'
      });
      expect(result).toBe('太郎、こんにちは');
    });

    it('ユーザー名からUnicode絵文字を削除する', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: '🎮ゲーマー太郎🔥',
        displayName: '表示名'
      });
      expect(result).toBe('ゲーマー太郎、こんにちは');
    });

    it('ユーザー名からURLを削除する', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: '太郎 https://example.com',
        displayName: '表示名'
      });
      expect(result).toBe('太郎、こんにちは');
    });

    it('ユーザー名からメンションを削除する', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: '太郎 <@123>',
        displayName: '表示名'
      });
      expect(result).toBe('太郎、こんにちは');
    });

    it('ニックネームがサニタイズ後に空になった場合は表示名を使う', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: '😀🎉',
        displayName: '表示名'
      });
      expect(result).toBe('表示名、こんにちは');
    });

    it('ニックネームも表示名もサニタイズ後に空になった場合は本文のみ', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: '😀',
        displayName: '🎉'
      });
      expect(result).toBe('こんにちは');
    });

    it('表示名もサニタイズする', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: null,
        displayName: '🔥太郎🔥'
      });
      expect(result).toBe('太郎、こんにちは');
    });
  });

  describe('コードブロックの置換', () => {
    it('コードブロックを「コード省略」に置換する', () => {
      const result = formatTtsMessage('見て\n```\nconst x = 1;\n```\nどう？', defaultUser);
      expect(result).toBe('テスト太郎、見て コード省略 どう？');
    });

    it('言語指定付きコードブロックを「コード省略」に置換する', () => {
      const result = formatTtsMessage('```ts\nconst x = 1;\n```', defaultUser);
      expect(result).toBe('テスト太郎、コード省略');
    });

    it('複数のコードブロックをそれぞれ「コード省略」に置換する', () => {
      const result = formatTtsMessage('```\na\n```\nと\n```\nb\n```', defaultUser);
      expect(result).toBe('テスト太郎、コード省略 と コード省略');
    });

    it('閉じられていないコードブロックも「コード省略」に置換する', () => {
      const result = formatTtsMessage('```\nconst x = 1;', defaultUser);
      expect(result).toBe('テスト太郎、コード省略');
    });

    it('インラインコードはそのまま読み上げる', () => {
      const result = formatTtsMessage('変数`foo`を使って', defaultUser);
      expect(result).toBe('テスト太郎、変数fooを使って');
    });

    it('インラインコード内の空白を保持する', () => {
      const result = formatTtsMessage('`a b`です', defaultUser);
      expect(result).toBe('テスト太郎、a bです');
    });
  });

  describe('引用の置換', () => {
    it('引用行を「引用省略」に置換する', () => {
      const result = formatTtsMessage('> これは引用です', defaultUser);
      expect(result).toBe('テスト太郎、引用省略');
    });

    it('複数行の引用を1つの「引用省略」に置換する', () => {
      const result = formatTtsMessage('> 行1\n> 行2\n> 行3', defaultUser);
      expect(result).toBe('テスト太郎、引用省略');
    });

    it('引用の前後にテキストがある場合はそれを残す', () => {
      const result = formatTtsMessage('前文\n> 引用\n後文', defaultUser);
      expect(result).toBe('テスト太郎、前文 引用省略 後文');
    });

    it('複数ブロック引用（>>>）を「引用省略」に置換する', () => {
      const result = formatTtsMessage('>>> これは\n複数行の\n引用です', defaultUser);
      expect(result).toBe('テスト太郎、引用省略');
    });

    it('複数ブロック引用の前にテキストがある場合はそれを残す', () => {
      const result = formatTtsMessage('前文\n>>> 引用\n続き', defaultUser);
      expect(result).toBe('テスト太郎、前文 引用省略');
    });
  });

  describe('カスタム絵文字の削除', () => {
    it('カスタム絵文字を削除する', () => {
      const result = formatTtsMessage('やあ <:smile:123456> 元気？', defaultUser);
      expect(result).toBe('テスト太郎、やあ 元気？');
    });

    it('アニメーション絵文字を削除する', () => {
      const result = formatTtsMessage('すごい <a:dance:789012>', defaultUser);
      expect(result).toBe('テスト太郎、すごい');
    });
  });

  describe('Unicode 絵文字の削除', () => {
    it('基本的な Unicode 絵文字を削除する', () => {
      const result = formatTtsMessage('おはよう😀🎉', defaultUser);
      expect(result).toBe('テスト太郎、おはよう');
    });

    it('肌色修飾子付きの絵文字を削除する', () => {
      const result = formatTtsMessage('いいね👍🏽', defaultUser);
      expect(result).toBe('テスト太郎、いいね');
    });

    it('ZWJ シーケンスの絵文字を削除する', () => {
      const result = formatTtsMessage('家族👨‍👩‍👧‍👦です', defaultUser);
      expect(result).toBe('テスト太郎、家族です');
    });

    it('VS16付きのテキスト絵文字を削除する', () => {
      // ☺（テキスト表示）+ VS16（\uFE0F）で絵文字化される
      const result = formatTtsMessage('いいね☺\uFE0Fだね', defaultUser);
      expect(result).toBe('テスト太郎、いいねだね');
    });

    it('数字キーキャップ絵文字を削除する', () => {
      // 1️⃣ = "1" + VS16 + combining enclosing keycap
      const result = formatTtsMessage('番号1\uFE0F\u20E3です', defaultUser);
      expect(result).toBe('テスト太郎、番号です');
    });
  });

  describe('メンションの削除', () => {
    it('ユーザーメンションを削除する', () => {
      const result = formatTtsMessage('おい <@123456789> 見て', defaultUser);
      expect(result).toBe('テスト太郎、おい 見て');
    });

    it('ニックネーム形式のユーザーメンションを削除する', () => {
      const result = formatTtsMessage('おい <@!123456789> 見て', defaultUser);
      expect(result).toBe('テスト太郎、おい 見て');
    });

    it('ロールメンションを削除する', () => {
      const result = formatTtsMessage('<@&999999> に連絡', defaultUser);
      expect(result).toBe('テスト太郎、に連絡');
    });

    it('チャンネルメンションを削除する', () => {
      const result = formatTtsMessage('<#111222333> を見て', defaultUser);
      expect(result).toBe('テスト太郎、を見て');
    });

    it('複数種類のメンションを同時に削除する', () => {
      const result = formatTtsMessage('<@123> と <@&456> は <#789> へ', defaultUser);
      expect(result).toBe('テスト太郎、と は へ');
    });
  });

  describe('URL の置換', () => {
    it('https URL を「URL」に置換する', () => {
      const result = formatTtsMessage('これ https://example.com/path?q=1 見て', defaultUser);
      expect(result).toBe('テスト太郎、これ URL 見て');
    });

    it('http URL を「URL」に置換する', () => {
      const result = formatTtsMessage('http://example.com を開いて', defaultUser);
      expect(result).toBe('テスト太郎、URL を開いて');
    });

    it('複数の URL を個別に置換する', () => {
      const result = formatTtsMessage('https://a.com と https://b.com', defaultUser);
      expect(result).toBe('テスト太郎、URL と URL');
    });

    it('スキームなしの裸ドメインは置換しない', () => {
      const result = formatTtsMessage('example.com にアクセス', defaultUser);
      expect(result).toBe('テスト太郎、example.com にアクセス');
    });

    it('URL末尾の閉じ括弧を巻き込まない', () => {
      const result = formatTtsMessage('(https://example.com)を見て', defaultUser);
      expect(result).toBe('テスト太郎、(URL)を見て');
    });

    it('URL末尾の句読点を巻き込まない', () => {
      const result = formatTtsMessage('https://example.com。次の話題', defaultUser);
      expect(result).toBe('テスト太郎、URL。次の話題');
    });

    it('URL末尾の読点を巻き込まない', () => {
      const result = formatTtsMessage('https://example.com、これ見て', defaultUser);
      expect(result).toBe('テスト太郎、URL、これ見て');
    });

    it('パーセントエンコードを含むURLを正しく置換する', () => {
      const result = formatTtsMessage('https://example.com/path%20name?q=%E3%81%82 見て', defaultUser);
      expect(result).toBe('テスト太郎、URL 見て');
    });

    it('フラグメントを含むURLを正しく置換する', () => {
      const result = formatTtsMessage('https://example.com/page#section 見て', defaultUser);
      expect(result).toBe('テスト太郎、URL 見て');
    });

    it('ポート番号を含むURLを正しく置換する', () => {
      const result = formatTtsMessage('https://example.com:8080/path 見て', defaultUser);
      expect(result).toBe('テスト太郎、URL 見て');
    });

    it('ユーザー情報を含むURLを正しく置換する', () => {
      const result = formatTtsMessage('https://user@example.com/path 見て', defaultUser);
      expect(result).toBe('テスト太郎、URL 見て');
    });

    it('サブデリミタを含むURLを正しく置換する', () => {
      const result = formatTtsMessage('https://example.com/path?a=1&b=2;c=3 見て', defaultUser);
      expect(result).toBe('テスト太郎、URL 見て');
    });

    it('チルダやアンダースコアを含むURLを正しく置換する', () => {
      const result = formatTtsMessage('https://example.com/~user/path_name 見て', defaultUser);
      expect(result).toBe('テスト太郎、URL 見て');
    });
  });

  describe('文字数制限', () => {
    it('本文が150文字以下の場合はそのまま', () => {
      const text = 'あ'.repeat(150);
      const result = formatTtsMessage(text, defaultUser);
      expect(result).toBe(`テスト太郎、${'あ'.repeat(150)}`);
    });

    it('本文が150文字を超える場合は切り取って「以下略」をつける', () => {
      const text = 'あ'.repeat(151);
      const result = formatTtsMessage(text, defaultUser);
      expect(result).toBe(`テスト太郎、${'あ'.repeat(150)}以下略`);
    });

    it('文字数カウントは全ての事前処理の後に行う', () => {
      // 絵文字やURLを含む長文で、処理後に150文字以内に収まるケース
      const padding = 'あ'.repeat(140);
      const text = `${padding}😀😀😀😀😀https://example.com`;
      const result = formatTtsMessage(text, defaultUser);
      // 処理後: padding(140) + "URL"(3) = 143文字 → 150以下なので切り取りなし
      expect(result).toBe(`テスト太郎、${padding}URL`);
    });
  });

  describe('空白の正規化', () => {
    it('連続する空白を1つにまとめる', () => {
      const result = formatTtsMessage('あ  い   う', defaultUser);
      expect(result).toBe('テスト太郎、あ い う');
    });

    it('削除処理で生じた連続空白も正規化する', () => {
      const result = formatTtsMessage('あ <@123> い', defaultUser);
      expect(result).toBe('テスト太郎、あ い');
    });

    it('前後の空白を除去する', () => {
      const result = formatTtsMessage('  こんにちは  ', defaultUser);
      expect(result).toBe('テスト太郎、こんにちは');
    });
  });

  describe('境界値', () => {
    it('本文が空文字の場合は空文字を返す', () => {
      const result = formatTtsMessage('', defaultUser);
      expect(result).toBe('');
    });

    it('処理後に本文が空になる場合は空文字を返す', () => {
      const result = formatTtsMessage('😀<@123>', defaultUser);
      expect(result).toBe('');
    });

    it('本文が空でも画像1枚の場合は「画像」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 1, video: 0 });
      expect(result).toBe('テスト太郎、画像');
    });

    it('処理後に本文が空でも画像1枚の場合は「画像」と読み上げる', () => {
      const result = formatTtsMessage('😀', defaultUser, undefined, { image: 1, video: 0 });
      expect(result).toBe('テスト太郎、画像');
    });

    it('画像2枚の場合は「画像2枚」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 2, video: 0 });
      expect(result).toBe('テスト太郎、画像2枚');
    });

    it('本文が空でも動画1本の場合は「動画」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 0, video: 1 });
      expect(result).toBe('テスト太郎、動画');
    });

    it('動画3本の場合は「動画3本」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 0, video: 3 });
      expect(result).toBe('テスト太郎、動画3本');
    });

    it('画像2枚・動画1本の場合は「画像2枚・動画1本」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 2, video: 1 });
      expect(result).toBe('テスト太郎、画像2枚・動画1本');
    });

    it('画像1枚・動画2本の場合は「画像1枚・動画2本」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 1, video: 2 });
      expect(result).toBe('テスト太郎、画像1枚・動画2本');
    });

    it('画像3枚・動画2本の場合は「画像3枚・動画2本」と読み上げる', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 3, video: 2 });
      expect(result).toBe('テスト太郎、画像3枚・動画2本');
    });

    it('本文があり画像もある場合は本文のみ読み上げる', () => {
      const result = formatTtsMessage('見てこれ', defaultUser, undefined, { image: 1, video: 0 });
      expect(result).toBe('テスト太郎、見てこれ');
    });

    it('本文があり動画もある場合は本文のみ読み上げる', () => {
      const result = formatTtsMessage('見てこれ', defaultUser, undefined, { image: 0, video: 1 });
      expect(result).toBe('テスト太郎、見てこれ');
    });

    it('添付なしで本文が空の場合はスキップ', () => {
      const result = formatTtsMessage('', defaultUser);
      expect(result).toBe('');
    });

    it('画像0枚・動画0本で本文が空の場合はスキップ', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 0, video: 0 });
      expect(result).toBe('');
    });

    it('本文が空で画像1枚の場合は「画像」を返す', () => {
      const result = formatTtsMessage('', defaultUser, undefined, { image: 1, video: 0 });
      expect(result).toBe('テスト太郎、画像');
    });

    it('本文がちょうど150文字の場合は「以下略」をつけない', () => {
      const text = 'あ'.repeat(150);
      const result = formatTtsMessage(text, defaultUser);
      expect(result).not.toContain('以下略');
    });

    it('本文が151文字の場合は「以下略」をつける', () => {
      const text = 'あ'.repeat(151);
      const result = formatTtsMessage(text, defaultUser);
      expect(result).toContain('以下略');
      // ユーザー名部分を除いた本文が150文字 + 以下略
      const body = result.replace('テスト太郎、', '').replace('以下略', '');
      expect(body.length).toBe(150);
    });
  });
});

describe('formatJoinMessage', () => {
  it('ニックネームがある場合はニックネームを使う', () => {
    const result = formatJoinMessage({ nickname: 'テスト太郎', displayName: '表示名' });
    expect(result).toBe('テスト太郎が参加しました');
  });

  it('ニックネームがない場合は表示名を使う', () => {
    const result = formatJoinMessage({ nickname: null, displayName: '表示名' });
    expect(result).toBe('表示名が参加しました');
  });

  it('ユーザー名から絵文字を削除する', () => {
    const result = formatJoinMessage({ nickname: '🎮太郎', displayName: '表示名' });
    expect(result).toBe('太郎が参加しました');
  });

  it('ニックネームがサニタイズ後に空なら表示名を使う', () => {
    const result = formatJoinMessage({ nickname: '😀', displayName: '表示名' });
    expect(result).toBe('表示名が参加しました');
  });

  it('モデルがzundamonの場合は「参加したのだ」になる', () => {
    const result = formatJoinMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'zundamon');
    expect(result).toBe('テスト太郎が参加したのだ');
  });

  it('モデルがzundamon以外の場合は「参加しました」のまま', () => {
    const result = formatJoinMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'alloy');
    expect(result).toBe('テスト太郎が参加しました');
  });
});

describe('formatLeaveMessage', () => {
  it('ニックネームがある場合はニックネームを使う', () => {
    const result = formatLeaveMessage({ nickname: 'テスト太郎', displayName: '表示名' });
    expect(result).toBe('テスト太郎が退出しました');
  });

  it('ニックネームがない場合は表示名を使う', () => {
    const result = formatLeaveMessage({ nickname: null, displayName: '表示名' });
    expect(result).toBe('表示名が退出しました');
  });

  it('ユーザー名から絵文字を削除する', () => {
    const result = formatLeaveMessage({ nickname: '🔥太郎🔥', displayName: '表示名' });
    expect(result).toBe('太郎が退出しました');
  });

  it('モデルがzundamonの場合は「退出したのだ」になる', () => {
    const result = formatLeaveMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'zundamon');
    expect(result).toBe('テスト太郎が退出したのだ');
  });

  it('モデルがzundamon以外の場合は「退出しました」のまま', () => {
    const result = formatLeaveMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'alloy');
    expect(result).toBe('テスト太郎が退出しました');
  });
});

describe('formatStreamStartMessage', () => {
  it('ニックネームがある場合はニックネームを使う', () => {
    const result = formatStreamStartMessage({ nickname: 'テスト太郎', displayName: '表示名' });
    expect(result).toBe('テスト太郎がライブ配信を開始しました');
  });

  it('ニックネームがない場合は表示名を使う', () => {
    const result = formatStreamStartMessage({ nickname: null, displayName: '表示名' });
    expect(result).toBe('表示名がライブ配信を開始しました');
  });

  it('ユーザー名から絵文字を削除する', () => {
    const result = formatStreamStartMessage({ nickname: '🎮太郎', displayName: '表示名' });
    expect(result).toBe('太郎がライブ配信を開始しました');
  });

  it('ニックネームがサニタイズ後に空なら表示名を使う', () => {
    const result = formatStreamStartMessage({ nickname: '😀', displayName: '表示名' });
    expect(result).toBe('表示名がライブ配信を開始しました');
  });

  it('モデルがzundamonの場合は「ライブ配信を開始したのだ」になる', () => {
    const result = formatStreamStartMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'zundamon');
    expect(result).toBe('テスト太郎がライブ配信を開始したのだ');
  });

  it('モデルがzundamon以外の場合は「ライブ配信を開始しました」のまま', () => {
    const result = formatStreamStartMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'alloy');
    expect(result).toBe('テスト太郎がライブ配信を開始しました');
  });
});

describe('formatStreamEndMessage', () => {
  it('ニックネームがある場合はニックネームを使う', () => {
    const result = formatStreamEndMessage({ nickname: 'テスト太郎', displayName: '表示名' });
    expect(result).toBe('テスト太郎がライブ配信を終了しました');
  });

  it('ニックネームがない場合は表示名を使う', () => {
    const result = formatStreamEndMessage({ nickname: null, displayName: '表示名' });
    expect(result).toBe('表示名がライブ配信を終了しました');
  });

  it('モデルがzundamonの場合は「ライブ配信を終了したのだ」になる', () => {
    const result = formatStreamEndMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'zundamon');
    expect(result).toBe('テスト太郎がライブ配信を終了したのだ');
  });

  it('モデルがzundamon以外の場合は「ライブ配信を終了しました」のまま', () => {
    const result = formatStreamEndMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'alloy');
    expect(result).toBe('テスト太郎がライブ配信を終了しました');
  });
});

describe('formatCameraOnMessage', () => {
  it('ニックネームがある場合はニックネームを使う', () => {
    const result = formatCameraOnMessage({ nickname: 'テスト太郎', displayName: '表示名' });
    expect(result).toBe('テスト太郎がカメラをつけました');
  });

  it('ニックネームがない場合は表示名を使う', () => {
    const result = formatCameraOnMessage({ nickname: null, displayName: '表示名' });
    expect(result).toBe('表示名がカメラをつけました');
  });

  it('モデルがzundamonの場合は「カメラをつけたのだ」になる', () => {
    const result = formatCameraOnMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'zundamon');
    expect(result).toBe('テスト太郎がカメラをつけたのだ');
  });

  it('モデルがzundamon以外の場合は「カメラをつけました」のまま', () => {
    const result = formatCameraOnMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'alloy');
    expect(result).toBe('テスト太郎がカメラをつけました');
  });
});

describe('formatCameraOffMessage', () => {
  it('ニックネームがある場合はニックネームを使う', () => {
    const result = formatCameraOffMessage({ nickname: 'テスト太郎', displayName: '表示名' });
    expect(result).toBe('テスト太郎がカメラを切りました');
  });

  it('ニックネームがない場合は表示名を使う', () => {
    const result = formatCameraOffMessage({ nickname: null, displayName: '表示名' });
    expect(result).toBe('表示名がカメラを切りました');
  });

  it('モデルがzundamonの場合は「カメラを切ったのだ」になる', () => {
    const result = formatCameraOffMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'zundamon');
    expect(result).toBe('テスト太郎がカメラを切ったのだ');
  });

  it('モデルがzundamon以外の場合は「カメラを切りました」のまま', () => {
    const result = formatCameraOffMessage({ nickname: 'テスト太郎', displayName: '表示名' }, 'alloy');
    expect(result).toBe('テスト太郎がカメラを切りました');
  });
});

describe('formatImageSummary', () => {
  it('概要テキストを「概要：{概要}」の形式で返す', () => {
    const result = formatImageSummary('猫が寝ている');
    expect(result).toBe('概要：猫が寝ている');
  });

  it('概要が150文字を超える場合は切り取って「以下略」をつける', () => {
    const summary = 'あ'.repeat(200);
    const result = formatImageSummary(summary);
    // "概要：" (3文字) + summary → body全体で文字数制限
    expect(result).toBe('概要：' + 'あ'.repeat(147) + '以下略');
  });

  it('概要がちょうど150文字の場合は「以下略」をつけない', () => {
    const summary = 'あ'.repeat(147);
    const result = formatImageSummary(summary);
    expect(result).toBe('概要：' + 'あ'.repeat(147));
  });
});

describe('formatImageSummaryReply', () => {
  it('概要テキストを「概要：{概要}」の形式で返す', () => {
    const result = formatImageSummaryReply('猫が寝ている');
    expect(result).toBe('概要：猫が寝ている');
  });

  it('500文字を超える場合は500文字で切り捨てる', () => {
    const summary = 'あ'.repeat(600);
    const result = formatImageSummaryReply(summary);
    expect(result).toBe('概要：' + 'あ'.repeat(497));
    expect(result.length).toBe(500);
  });

  it('ちょうど500文字の場合は切り捨てない', () => {
    const summary = 'あ'.repeat(497);
    const result = formatImageSummaryReply(summary);
    expect(result).toBe('概要：' + 'あ'.repeat(497));
    expect(result.length).toBe(500);
  });

  it('500文字未満の場合はそのまま返す', () => {
    const summary = 'あ'.repeat(100);
    const result = formatImageSummaryReply(summary);
    expect(result).toBe('概要：' + 'あ'.repeat(100));
  });
});

describe('辞書置換', () => {
  const dict: Dictionary = {
    apply: (text) => text.replaceAll('w', '草').replaceAll('Discord', 'ディスコード')
  };

  const defaultUser = {
    nickname: 'テスト太郎',
    displayName: '表示名'
  };

  describe('formatTtsMessage', () => {
    it('本文に辞書置換を適用する', () => {
      const result = formatTtsMessage('それはw', defaultUser, dict);
      expect(result).toBe('テスト太郎、それは草');
    });

    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatTtsMessage('こんにちは', {
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, dict);
      expect(result).toBe('ディスコード太郎、こんにちは');
    });

    it('辞書が未指定の場合は置換しない', () => {
      const result = formatTtsMessage('それはw', defaultUser);
      expect(result).toBe('テスト太郎、それはw');
    });

    it('辞書置換はサニタイズ後に適用される', () => {
      const emojiDict: Dictionary = {
        apply: (text) => text.replaceAll('絵文字後', '置換済み')
      };
      const result = formatTtsMessage('😀絵文字後', defaultUser, emojiDict);
      expect(result).toBe('テスト太郎、置換済み');
    });

    it('辞書置換は文字数制限前に適用される', () => {
      const expandDict: Dictionary = {
        apply: (text) => text.replaceAll('X', 'あ'.repeat(200))
      };
      const result = formatTtsMessage('X', defaultUser, expandDict);
      expect(result).toBe(`テスト太郎、${'あ'.repeat(150)}以下略`);
    });
  });

  describe('formatJoinMessage', () => {
    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatJoinMessage({
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, undefined, dict);
      expect(result).toBe('ディスコード太郎が参加しました');
    });

    it('定型文には辞書置換を適用しない', () => {
      const suffixDict: Dictionary = {
        apply: (text) => text.replaceAll('参加', '不参加')
      };
      const result = formatJoinMessage(defaultUser, undefined, suffixDict);
      expect(result).toBe('テスト太郎が参加しました');
    });
  });

  describe('formatLeaveMessage', () => {
    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatLeaveMessage({
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, undefined, dict);
      expect(result).toBe('ディスコード太郎が退出しました');
    });

    it('定型文には辞書置換を適用しない', () => {
      const suffixDict: Dictionary = {
        apply: (text) => text.replaceAll('退出', '残留')
      };
      const result = formatLeaveMessage(defaultUser, undefined, suffixDict);
      expect(result).toBe('テスト太郎が退出しました');
    });
  });

  describe('formatStreamStartMessage', () => {
    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatStreamStartMessage({
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, undefined, dict);
      expect(result).toBe('ディスコード太郎がライブ配信を開始しました');
    });

    it('定型文には辞書置換を適用しない', () => {
      const suffixDict: Dictionary = {
        apply: (text) => text.replaceAll('開始', '終了')
      };
      const result = formatStreamStartMessage(defaultUser, undefined, suffixDict);
      expect(result).toBe('テスト太郎がライブ配信を開始しました');
    });
  });

  describe('formatStreamEndMessage', () => {
    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatStreamEndMessage({
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, undefined, dict);
      expect(result).toBe('ディスコード太郎がライブ配信を終了しました');
    });

    it('定型文には辞書置換を適用しない', () => {
      const suffixDict: Dictionary = {
        apply: (text) => text.replaceAll('終了', '開始')
      };
      const result = formatStreamEndMessage(defaultUser, undefined, suffixDict);
      expect(result).toBe('テスト太郎がライブ配信を終了しました');
    });
  });

  describe('formatCameraOnMessage', () => {
    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatCameraOnMessage({
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, undefined, dict);
      expect(result).toBe('ディスコード太郎がカメラをつけました');
    });

    it('定型文には辞書置換を適用しない', () => {
      const suffixDict: Dictionary = {
        apply: (text) => text.replaceAll('つけ', '切り')
      };
      const result = formatCameraOnMessage(defaultUser, undefined, suffixDict);
      expect(result).toBe('テスト太郎がカメラをつけました');
    });
  });

  describe('formatCameraOffMessage', () => {
    it('ユーザー名に辞書置換を適用する', () => {
      const result = formatCameraOffMessage({
        nickname: 'Discord太郎',
        displayName: '表示名'
      }, undefined, dict);
      expect(result).toBe('ディスコード太郎がカメラを切りました');
    });

    it('定型文には辞書置換を適用しない', () => {
      const suffixDict: Dictionary = {
        apply: (text) => text.replaceAll('切り', 'つけ')
      };
      const result = formatCameraOffMessage(defaultUser, undefined, suffixDict);
      expect(result).toBe('テスト太郎がカメラを切りました');
    });
  });
});
