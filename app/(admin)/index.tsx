import { useRouter } from 'expo-router';
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { Button, FlatList, ScrollView, StyleSheet, View } from 'react-native';

function playBeep() {
  try {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.4;
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { db } from '@/src/firebase';
import type { DriverProfile, RideDoc } from '@/src/ride/types';

export default function AdminDashboard() {
  const router = useRouter();
  const { logout } = useAuth();
  const [pendingDrivers, setPendingDrivers] = useState<Array<DriverProfile & { id: string }>>([]);
  const [allRides, setAllRides] = useState<Array<RideDoc & { id: string }>>([]);
  const [newRideIds, setNewRideIds] = useState<Set<string>>(new Set());
  const prevSearchingCount = useRef(0);

  useEffect(() => {
    const q = query(collection(db, 'drivers'), where('approvalStatus', '==', 'pending'));
    const unsub = onSnapshot(q, (snap: any) => {
      const items: Array<DriverProfile & { id: string }> = [];
      snap.forEach((d: any) => items.push({ id: d.id, ...(d.data() as DriverProfile) }));
      setPendingDrivers(items);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'rides'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap: any) => {
      const items: Array<RideDoc & { id: string }> = [];
      snap.forEach((d: any) => items.push({ id: d.id, ...(d.data() as RideDoc) }));
      const searchingItems = items.filter((r) => r.status === 'searching');
      const searchingCount = searchingItems.length;

      // Play beep when searching count increases
      if (searchingCount > prevSearchingCount.current && prevSearchingCount.current > 0) {
        playBeep();
      }
      prevSearchingCount.current = searchingCount;

      // Track newly appeared searching rides for visual highlight
      setNewRideIds((prev) => {
        const next = new Set(prev);
        searchingItems.forEach((r) => {
          if (!prev.has(r.id)) {
            next.add(r.id);
            // auto-remove highlight after 8 seconds
            setTimeout(() => {
              setNewRideIds((p) => {
                const n = new Set(p);
                n.delete(r.id);
                return n;
              });
            }, 8000);
          }
        });
        return next;
      });

      setAllRides(items);
    });
    return unsub;
  }, []);

  const updateDriverStatus = async (uid: string, status: 'approved' | 'rejected') => {
    await setDoc(
      doc(db, 'drivers', uid),
      { approvalStatus: status, updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <ThemedText type="title" style={styles.header}>Admin Dashboard</ThemedText>
        <Button title="Logout" onPress={async () => { await logout(); router.replace('/(auth)/login'); }} color="#f44336" />
      </View>

      <ThemedText type="subtitle">Pending Drivers ({pendingDrivers.length})</ThemedText>
      <FlatList
        data={pendingDrivers}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        renderItem={({ item }: { item: DriverProfile & { id: string } }) => (
          <View style={styles.card}>
            <ThemedText type="subtitle">{item.name}</ThemedText>
            <ThemedText>License: {item.licenseNumber}</ThemedText>
            <ThemedText>Vehicle: {item.vehicleType}</ThemedText>
            <ThemedText>Details: {item.vehicleDetails}</ThemedText>
            <View style={styles.actions}>
              <Button title="Approve" onPress={() => updateDriverStatus(item.uid, 'approved')} />
              <Button title="Reject" onPress={() => updateDriverStatus(item.uid, 'rejected')} />
            </View>
          </View>
        )}
        ListEmptyComponent={<ThemedText style={styles.empty}>No pending drivers</ThemedText>}
      />

      <ThemedText type="subtitle" style={{ marginTop: 16 }}>
        All Rides ({allRides.length})
      </ThemedText>
      <FlatList
        data={allRides}
        keyExtractor={(i) => i.id}
        scrollEnabled={false}
        renderItem={({ item }: { item: RideDoc & { id: string } }) => {
          const isSearching = item.status === 'searching';
          const isNew = newRideIds.has(item.id);
          return (
            <View style={[styles.card, isSearching ? styles.searchingCard : null, isNew ? styles.newRideCard : null]}>
              <ThemedText type="subtitle" style={isSearching ? styles.searchingText : undefined}>
                {item.status} {isSearching ? '🔔' : ''}
              </ThemedText>
              <ThemedText>Vehicle: {item.vehicleType}</ThemedText>
              <ThemedText>Fare: {item.estimatedFare}</ThemedText>
              <ThemedText>Distance: {item.estimatedDistanceKm.toFixed(2)} km</ThemedText>
              <ThemedText>Pickup: {item.pickupName || 'Unknown'}</ThemedText>
              <ThemedText>Dropoff: {item.dropoffName || 'Unknown'}</ThemedText>
              <ThemedText>Rider: {item.riderId.slice(0, 8)}…</ThemedText>
              <ThemedText>Driver: {item.driverId ? item.driverId.slice(0, 8) + '…' : 'None'}</ThemedText>
            </View>
          );
        }}
        ListEmptyComponent={<ThemedText style={styles.empty}>No rides yet</ThemedText>}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 16 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#fafafa',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  empty: { padding: 16, textAlign: 'center' },
  searchingCard: {
    borderColor: '#E53935',
    borderWidth: 2,
  },
  searchingText: {
    color: '#E53935',
    fontWeight: '900',
  },
  newRideCard: {
    backgroundColor: '#FFEBEE',
  },
});
