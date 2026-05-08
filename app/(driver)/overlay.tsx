import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useDriverSettings } from '@/src/settings/DriverSettingsContext';

export default function ScreenOverlay() {
  const router = useRouter();
  const { settings, update } = useDriverSettings();

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Screen overlay</ThemedText>

      <ThemedText style={styles.body}>
        Screen overlay allows you to see new orders on top of other apps, even when your Driver app is minimized. A floating app icon that will appear on the home screen can quickly switch you to the Driver app.
      </ThemedText>

      <View style={styles.row}>
        <ThemedText style={styles.label}>Enable screen overlay</ThemedText>
        <Switch
          value={settings.overlayEnabled}
          onValueChange={(v) => update({ overlayEnabled: v })}
          trackColor={{ false: '#cfcfcf', true: '#19A64B' }}
          thumbColor={settings.overlayEnabled ? '#fff' : '#fff'}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingTop: 24 },
  backArrow: { fontSize: 28, width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', textAlign: 'center', textAlignVertical: 'center', lineHeight: 38 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: 16, paddingBottom: 16 },
  body: { fontSize: 16, lineHeight: 24, paddingHorizontal: 16, color: '#333', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 16, fontWeight: '700' },
});
