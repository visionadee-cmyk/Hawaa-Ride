import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const MENU_ITEMS = [
  { label: 'Billing plan', icon: '📋', route: '/(driver)/billing' },
  { label: 'Services', icon: '📋', route: '/(driver)/services' },
  { label: 'Background restrictions', icon: 'ℹ️', route: '/(driver)/restrictions' },
  { label: 'Screen overlay', icon: '⬜', route: '/(driver)/overlay' },
  { label: 'App appearance', icon: '☀️', route: '/(driver)/appearance' },
  { label: 'Get in touch', icon: '💬', route: '/(driver)/contact' },
];

export default function DriverSettings() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Settings</ThemedText>

      {MENU_ITEMS.map((item) => (
        <Pressable
          key={item.label}
          style={styles.menuItem}
          onPress={() => router.push(item.route as any)}
        >
          <ThemedText style={styles.icon}>{item.icon}</ThemedText>
          <ThemedText style={styles.label}>{item.label}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: {
    padding: 16,
    paddingTop: 24,
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '400',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 38,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  icon: {
    fontSize: 20,
    color: '#8BC34A',
    width: 28,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8BC34A',
  },
});
