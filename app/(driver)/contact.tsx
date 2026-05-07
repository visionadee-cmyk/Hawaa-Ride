import { useRouter } from 'expo-router';
import { Linking } from 'react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const CONTACTS = [
  { label: 'Call us', icon: '📞', action: () => Linking.openURL('tel:+9601234567') },
  { label: 'Email us', icon: '✉️', action: () => Linking.openURL('mailto:support@hawaaride.com') },
  { label: 'Get legal information', icon: 'ℹ️', action: () => {} },
  { label: 'Facebook', icon: 'f', action: () => Linking.openURL('https://facebook.com') },
  { label: 'Instagram', icon: '📷', action: () => Linking.openURL('https://instagram.com') },
  { label: 'Twitter', icon: '𝕏', action: () => Linking.openURL('https://twitter.com') },
];

export default function GetInTouch() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Get in touch</ThemedText>

      {CONTACTS.map((c) => (
        <Pressable key={c.label} style={styles.item} onPress={c.action}>
          <ThemedText style={styles.icon}>{c.icon}</ThemedText>
          <ThemedText style={styles.label}>{c.label}</ThemedText>
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
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 12 },
  icon: { fontSize: 20, color: '#8BC34A', width: 28, textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '600', color: '#8BC34A' },
});
