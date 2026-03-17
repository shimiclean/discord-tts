export const SAME_SPEAKER_THRESHOLD_MS = 10_000;

export class LastSpeakerTracker {
  private readonly threshold: number;
  private readonly lastSpeakers = new Map<string, { userId: string; timestamp: number }>();

  constructor (threshold: number) {
    this.threshold = threshold;
  }

  shouldSkipName (guildId: string, userId: string, now: number): boolean {
    const last = this.lastSpeakers.get(guildId);
    const skip = !!last && last.userId === userId && (now - last.timestamp) <= this.threshold;
    this.lastSpeakers.set(guildId, { userId, timestamp: now });
    return skip;
  }

  clear (guildId: string): void {
    this.lastSpeakers.delete(guildId);
  }
}
