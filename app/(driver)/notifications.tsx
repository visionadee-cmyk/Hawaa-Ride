import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useDriverSettings } from '@/src/settings/DriverSettingsContext';
import { playRingtone, type Ringtone } from '@/src/settings/sound';

const RINGTONES: { label: string; value: Ringtone; icon: string }[] = [
  { label: 'Beep', value: 'beep', icon: '🔔' },
  { label: 'Chime', value: 'chime', icon: '🎵' },
  { label: 'Pulse', value: 'pulse', icon: '💓' },
  { label: 'Bell', value: 'bell', icon: '🛎️' },
];

export default function NotificationsSettings() {
  const router = useRouter();
  const { settings, update } = useDriverSettings();

  const selectRingtone = (tone: Ringtone) => {
    update({ ringtone: tone });
    if (settings.soundEnabled) {
      playRingtone(tone, settings.notificationVolume);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Notifications</ThemedText>

      <View style={styles.section}>
        <View style={styles.row}>
          <ThemedText style={styles.label}>Sound alerts</ThemedText>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(v) => update({ soundEnabled: v })}
            trackColor={{ false: '#cfcfcf', true: '#19A64B' }}
          />
        </View>
        <ThemedText style={styles.hint}>Play ringtone when new ride request arrives</ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <ThemedText style={styles.label}>Vibration</ThemedText>
          <Switch
            value={settings.vibrationEnabled}
            onValueChange={(v) => update({ vibrationEnabled: v })}
            trackColor={{ false: '#cfcfcf', true: '#19A64B' }}
          />
        </View>
        <ThemedText style={styles.hint}>Vibrate phone when new ride request arrives</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Ringtone</ThemedText>
        {RINGTONES.map((r) => (
          <Pressable key={r.value} style={styles.toneRow} onPress={() => selectRingtone(r.value)}>
            <ThemedText style={styles.toneIcon}>{r.icon}</ThemedText>
            <ThemedText style={styles.toneLabel}>{r.label}</ThemedText>
            {settings.ringtone === r.value && (
              <ThemedText style={styles.check}>✓</ThemedText>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingTop: 24 },
  backArrow: { fontSize: 28, width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', textAlign: 'center', textAlignVertical: 'center', lineHeight: 38 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: 16, paddingBottom: 16 },
  section: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 16, fontWeight: '700', color: '#111' },
  hint: { fontSize: 13, color: '#888', marginTop: 4 },
  toneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  toneIcon: { fontSize: 20, width: 36 },
  toneLabel: { fontSize: 16, flex: 1, color: '#333' },
  check: { fontSize: 18, color: '#19A64B', fontWeight: '900' },
});
