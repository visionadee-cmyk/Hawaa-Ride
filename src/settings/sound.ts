import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type Ringtone = 'beep' | 'chime' | 'pulse' | 'bell' | 'alarm';

const WEB_FREQUENCIES: Record<Ringtone, number> = {
  beep: 880,
  chime: 1200,
  pulse: 600,
  bell: 500,
  alarm: 800,
};

async function playNativeBeep() {
  try {
    // Play alarm pattern - multiple vibrations with pauses
    const alarmPattern = async () => {
      for (let i = 0; i < 5; i++) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await new Promise(resolve => setTimeout(resolve, 300));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    };
    alarmPattern();
  } catch {
    // ignore
  }
}

export async function playRingtone(tone: Ringtone, volume = 1) {
  if (Platform.OS !== 'web') {
    await playNativeBeep();
    return;
  }

  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    const freq = WEB_FREQUENCIES[tone];
    o.type = tone === 'chime' || tone === 'bell' ? 'sine' : tone === 'pulse' ? 'square' : 'sine';
    o.frequency.value = freq;

    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();

    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.3 * volume, now + 0.05);

    if (tone === 'pulse') {
      // Pulse pattern: on-off-on
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      g.gain.setValueAtTime(0.0001, now + 0.25);
      g.gain.exponentialRampToValueAtTime(0.3 * volume, now + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      o.stop(now + 0.55);
    } else if (tone === 'alarm') {
      // Alarm pattern: repeating beep for ~3 seconds
      const alarmDuration = 3.0;
      for (let i = 0; i < 6; i++) {
        const t = now + i * 0.5;
        g.gain.setValueAtTime(0.3 * volume, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      }
      o.stop(now + alarmDuration);
    } else if (tone === 'bell') {
      // Bell with decay
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      o.stop(now + 1.05);
    } else if (tone === 'chime') {
      // Two-tone chime
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      o.frequency.setValueAtTime(freq, now);
      o.frequency.setValueAtTime(freq * 1.25, now + 0.2);
      o.stop(now + 0.45);
    } else {
      // beep: short chirp
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      o.stop(now + 0.3);
    }

    o.onended = () => {
      try { ctx.close(); } catch {}
    };
  } catch {
    // ignore
  }
}
