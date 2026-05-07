import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const MODES = [
  { label: 'Use device settings', value: 'system' },
  { label: 'Light mode', value: 'light' },
  { label: 'Dark mode', value: 'dark' },
];

export default function AppAppearance() {
  const router = useRouter();
  const [selected, setSelected] = useState('light');

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>App appearance</ThemedText>

      {MODES.map((m) => (
        <Pressable key={m.value} style={styles.item} onPress={() => setSelected(m.value)}>
          <ThemedText style={styles.label}>{m.label}</ThemedText>
          {selected === m.value && <ThemedText style={styles.check}>✓</ThemedText>}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingTop: 24 },
  backArrow: { fontSize: 28, width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', textAlign: 'center', textAlignVertical: 'center', lineHeight: 38 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: 16, paddingBottom: 16 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { fontSize: 16, fontWeight: '600', color: '#8BC34A' },
  check: { fontSize: 20, color: '#19A64B', fontWeight: '900' },
});
