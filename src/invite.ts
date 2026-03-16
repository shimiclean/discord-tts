import { PermissionFlagsBits } from 'discord.js';

const REQUIRED_PERMISSIONS =
  PermissionFlagsBits.ViewChannel |
  PermissionFlagsBits.Connect |
  PermissionFlagsBits.Speak;

export function generateInviteUrl (clientId: string): string {
  if (!clientId.trim()) {
    throw new Error('クライアントIDが必要です');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: REQUIRED_PERMISSIONS.toString(),
    scope: 'bot'
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

if (require.main === module) {
  const clientId = process.argv[2];
  if (!clientId) {
    console.error('使い方: npx ts-node src/invite.ts <クライアントID>');
    process.exit(1);
  }
  console.log(generateInviteUrl(clientId));
}
