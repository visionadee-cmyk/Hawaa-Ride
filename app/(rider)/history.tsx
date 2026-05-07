import { QuerySnapshot, collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { db } from '@/src/firebase';
import type { RideDoc } from '@/src/ride/types';

export default function RiderHistory() {
  const { firebaseUser } = useAuth();
  const [rides, setRides] = useState<Array<RideDoc & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'rides'),
      where('riderId', '==', firebaseUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot) => {
        setError(null);
        const items: Array<RideDoc & { id: string }> = [];
        snap.forEach((d: any) => items.push({ id: d.id, ...(d.data() as RideDoc) }));
        // client-side sort fallback
        items.sort((a, b) => {
          const ta = a.createdAt && typeof a.createdAt === 'object' && 'seconds' in a.createdAt ? (a.createdAt as any).seconds : 0;
          const tb = b.createdAt && typeof b.createdAt === 'object' && 'seconds' in b.createdAt ? (b.createdAt as any).seconds : 0;
          return tb - ta;
        });
        setRides(items);
      },
      (err: any) => {
        console.error('History query error:', err);
        if (err.code === 'failed-precondition') {
          setError('Firestore index required. Create it in Firebase Console > Indexes.');
        } else {
          setError(err.message || 'Failed to load rides');
        }
      }
    );
    return unsub;
  }, [firebaseUser]);

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      )}
      <FlatList
        data={rides}
        keyExtractor={(i: RideDoc & { id: string }) => i.id}
        renderItem={({ item }: { item: RideDoc & { id: string } }) => (
          <View style={styles.row}>
            <ThemedText type="subtitle">{item.status}</ThemedText>
            <ThemedText>From: {item.pickupName || 'Unknown'}</ThemedText>
            <ThemedText>To: {item.dropoffName || 'Unknown'}</ThemedText>
            <ThemedText>Vehicle: {item.vehicleType}</ThemedText>
            <ThemedText>Fare: {item.estimatedFare} MVR</ThemedText>
          </View>
        )}
        ListEmptyComponent={<ThemedText style={{ padding: 16 }}>{error ? 'Fix the error above to see rides' : 'No rides yet'}</ThemedText>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF5350',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
});
