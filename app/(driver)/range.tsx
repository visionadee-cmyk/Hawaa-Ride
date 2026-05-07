import { useRouter } from 'expo-router';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MapView, Circle } from '@/src/components/Map';
import { db } from '@/src/firebase';
import type { DriverProfile } from '@/src/ride/types';
import { useAuth } from '@/src/auth/AuthContext';

export default function RangeSettings() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [rangeKm, setRangeKm] = useState(7);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(doc(db, 'drivers', firebaseUser.uid), (snap: any) => {
      if (snap.exists()) {
        const data = snap.data() as DriverProfile;
        setProfile(data);
        setRangeKm(data.notificationRangeKm ?? 7);
      }
    });
    return unsub;
  }, [firebaseUser]);

  const save = async (next: number) => {
    if (!firebaseUser) return;
    setRangeKm(next);
    await setDoc(
      doc(db, 'drivers', firebaseUser.uid),
      { notificationRangeKm: next, updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  const center = profile?.lastLocation ?? { latitude: 4.1755, longitude: 73.5093 };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...center, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
      >
        <Circle
          center={center}
          radius={rangeKm * 1000}
          fillColor="rgba(25,166,75,0.15)"
          strokeColor="#19A64B"
          strokeWidth={2}
        />
      </MapView>

      <View style={styles.bottomSheet}>
        <ThemedText style={styles.label}>You will get jobs within</ThemedText>
        <View style={styles.controlRow}>
          <Pressable style={styles.circleBtn} onPress={() => save(Math.max(1, rangeKm - 1))}>
            <ThemedText style={styles.circleText}>−</ThemedText>
          </Pressable>
          <ThemedText style={styles.value}>{rangeKm.toFixed(1)} km</ThemedText>
          <Pressable style={styles.circleBtn} onPress={() => save(Math.min(50, rangeKm + 1))}>
            <ThemedText style={styles.circleText}>+</ThemedText>
          </Pressable>
        </View>
        <Pressable style={styles.saveBtn} onPress={() => router.back()}>
          <ThemedText style={styles.saveText}>Save</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { position: 'absolute', top: 48, left: 16, zIndex: 10 },
  backArrow: {
    fontSize: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 38,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  label: { fontSize: 16, color: '#333', marginBottom: 12 },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 20,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  circleText: { fontSize: 24, fontWeight: '700', color: '#333' },
  value: { fontSize: 28, fontWeight: '900', minWidth: 80, textAlign: 'center' },
  saveBtn: {
    backgroundColor: '#19A64B',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontSize: 18, fontWeight: '900' },
});
