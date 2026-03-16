import { Collection, VoiceChannel } from "discord.js";

export function findMatchingVoiceChannel(
  textChannelName: string,
  voiceChannels: Collection<string, VoiceChannel>
): VoiceChannel | undefined {
  return voiceChannels.find((vc) => vc.name === textChannelName);
}
