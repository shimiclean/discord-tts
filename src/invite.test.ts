import { generateInviteUrl } from './invite';

describe('generateInviteUrl', () => {
  it('クライアントIDを含むOAuth2 URLを生成する', () => {
    const url = generateInviteUrl('123456789');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://discord.com/api/oauth2/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('123456789');
    expect(parsed.searchParams.get('scope')).toBe('bot');
  });

  it('必要な権限ビットを含む', () => {
    const url = generateInviteUrl('123456789');
    const parsed = new URL(url);
    const permissions = BigInt(parsed.searchParams.get('permissions')!);

    // View Channels (1 << 10)
    expect(permissions & (1n << 10n)).not.toBe(0n);
    // Connect (1 << 20)
    expect(permissions & (1n << 20n)).not.toBe(0n);
    // Speak (1 << 21)
    expect(permissions & (1n << 21n)).not.toBe(0n);
  });

  it('不要な管理権限を含まない', () => {
    const url = generateInviteUrl('123456789');
    const parsed = new URL(url);
    const permissions = BigInt(parsed.searchParams.get('permissions')!);

    // Administrator (1 << 3)
    expect(permissions & (1n << 3n)).toBe(0n);
    // Manage Guild (1 << 5)
    expect(permissions & (1n << 5n)).toBe(0n);
    // Manage Channels (1 << 4)
    expect(permissions & (1n << 4n)).toBe(0n);
  });

  it('クライアントIDが空の場合にエラーを投げる', () => {
    expect(() => generateInviteUrl('')).toThrow();
  });

  it('クライアントIDが空白のみの場合にエラーを投げる', () => {
    expect(() => generateInviteUrl('  ')).toThrow();
  });
});
