import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useDriverSettings } from '@/src/settings/DriverSettingsContext';

export default function BackgroundRestrictions() {
  const router = useRouter();
  const { update } = useDriverSettings();

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Background restrictions</ThemedText>

      <ThemedText style={styles.body}>
        If you want to receive order suggestions when the app is minimized, make sure your phone battery optimizations are off. Disabled optimizations will also improve the quality of GPS tracking during the trips.
      </ThemedText>

      <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
        <ThemedText style={styles.primaryBtnText}>OK</ThemedText>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => { update({ restrictionsSkipped: true }); router.back(); }}>
        <ThemedText style={styles.secondaryBtnText}>Skip and don&apos;t ask again</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingTop: 24 },
  backArrow: { fontSize: 28, width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', textAlign: 'center', textAlignVertical: 'center', lineHeight: 38 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: 16, paddingBottom: 16 },
  body: { fontSize: 16, lineHeight: 24, paddingHorizontal: 16, color: '#333' },
  primaryBtn: {
    margin: 16,
    marginTop: 32,
    backgroundColor: '#19A64B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  secondaryBtn: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { fontWeight: '700', fontSize: 16 },
});
