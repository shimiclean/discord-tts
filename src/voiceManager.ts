import { VoiceChannel } from "discord.js";

export function shouldBotJoin(
  channel: VoiceChannel,
  botId: string
): boolean {
  const members = Array.from(channel.members.values());
  const hasHuman = members.some((m) => !m.user.bot);
  const botPresent = members.some((m) => m.id === botId);
  return hasHuman && !botPresent;
}

export function shouldBotLeave(
  channel: VoiceChannel,
  botId: string
): boolean {
  const members = Array.from(channel.members.values());
  const hasHuman = members.some((m) => !m.user.bot);
  return !hasHuman;
}
