import { Interaction } from 'discord.js';
import { AudioPlayer } from '@discordjs/voice';
import { TtsVoiceConfig } from '../speakerConfig';
import { SakuraVoices, loadSakuraVoices } from '../sakuraVoices';
import { buildDictionaryCommand, executeDictionaryCommand } from './dictionaryCommand';
import { buildSkipCommand, executeSkipCommand } from './skipCommand';
import { buildQueueSizeCommand, buildQueueClearCommand, executeQueueSizeCommand, executeQueueClearCommand } from './queueCommand';
import { buildVoiceCommand, executeVoiceCommand, handleVoiceAutocomplete } from './voiceCommand';
import { buildVoiceResetCommand, executeVoiceResetCommand } from './voiceResetCommand';
import * as path from 'path';

export interface CommandHandlers {
  getPlayer: (guildId: string) => AudioPlayer | undefined;
  getQueueSize: (guildId: string) => number;
  clearQueue: (guildId: string) => number;
  saveDictionaryEntry: (guildId: string, from: string, to: string) => void | Promise<void>;
  removeDictionaryEntry: (guildId: string, from: string) => void | Promise<void>;
  saveVoiceSetting: (guildId: string, userId: string, voice: TtsVoiceConfig, guildName: string, userName: string) => void | Promise<void>;
  removeVoiceSetting: (guildId: string, userId: string) => void | Promise<void>;
}

export function createCommandRegistry (ttsBaseUrl: string, handlers: CommandHandlers) {
  const isSakuraAi = ttsBaseUrl.includes('api.ai.sakura.ad.jp');
  const sakuraVoices: SakuraVoices | null = isSakuraAi
    ? loadSakuraVoices(path.join(__dirname, '..', '..', 'data', 'sakura-voices.csv'))
    : null;

  const dictionaryCommand = buildDictionaryCommand();
  const skipCommand = buildSkipCommand();
  const queueSizeCommand = buildQueueSizeCommand();
  const queueClearCommand = buildQueueClearCommand();
  const voiceCommand = sakuraVoices ? buildVoiceCommand(sakuraVoices) : null;
  const voiceResetCommand = isSakuraAi ? buildVoiceResetCommand() : null;

  const commandBody = [
    dictionaryCommand.toJSON(),
    skipCommand.toJSON(),
    queueSizeCommand.toJSON(),
    queueClearCommand.toJSON(),
    ...(voiceCommand && voiceResetCommand
      ? [voiceCommand.toJSON(), voiceResetCommand.toJSON()]
      : [])
  ];

  async function handleInteraction (interaction: Interaction): Promise<void> {
    if (interaction.isAutocomplete() && voiceCommand && sakuraVoices && interaction.commandName === voiceCommand.name) {
      await handleVoiceAutocomplete(interaction, sakuraVoices);
      return;
    }
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === dictionaryCommand.name) {
        await executeDictionaryCommand(interaction, handlers.saveDictionaryEntry, handlers.removeDictionaryEntry);
      } else if (voiceCommand && sakuraVoices && interaction.commandName === voiceCommand.name) {
        await executeVoiceCommand(interaction, sakuraVoices, handlers.saveVoiceSetting);
      } else if (interaction.commandName === skipCommand.name) {
        await executeSkipCommand(interaction, handlers.getPlayer);
      } else if (interaction.commandName === queueSizeCommand.name) {
        await executeQueueSizeCommand(interaction, handlers.getQueueSize);
      } else if (interaction.commandName === queueClearCommand.name) {
        await executeQueueClearCommand(interaction, handlers.clearQueue);
      } else if (voiceResetCommand && interaction.commandName === voiceResetCommand.name) {
        await executeVoiceResetCommand(interaction, handlers.removeVoiceSetting);
      }
    }
  }

  return { commandBody, handleInteraction };
}
