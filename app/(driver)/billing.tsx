import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function BillingPlan() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Billing plan</ThemedText>

      <View style={styles.card}>
        <ThemedText style={styles.planName}>Basic Plan</ThemedText>
        <ThemedText style={styles.planPrice}>Free</ThemedText>
        <ThemedText style={styles.planDesc}>Standard commission per ride</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingTop: 24 },
  backArrow: { fontSize: 28, width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', textAlign: 'center', textAlignVertical: 'center', lineHeight: 38 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: 16, paddingBottom: 16 },
  card: { margin: 16, padding: 20, borderRadius: 16, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#eee' },
  planName: { fontSize: 20, fontWeight: '700' },
  planPrice: { fontSize: 28, fontWeight: '900', color: '#19A64B', marginTop: 8 },
  planDesc: { fontSize: 14, color: '#666', marginTop: 4 },
});
