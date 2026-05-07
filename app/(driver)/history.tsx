import { useRouter } from 'expo-router';
import { QuerySnapshot, collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { db } from '@/src/firebase';
import type { RideDoc } from '@/src/ride/types';

export default function DriverHistory() {
  const router = useRouter();
  const { firebaseUser } = useAuth();
  const [rides, setRides] = useState<Array<RideDoc & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'rides'),
      where('driverId', '==', firebaseUser.uid)
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
        console.error('Driver history query error:', err);
        if (err.code === 'failed-precondition') {
          setError('Firestore index required. Create it in Firebase Console > Indexes.');
        } else {
          setError(err.message || 'Failed to load rides');
        }
      }
    );
    return unsub;
  }, [firebaseUser]);

  const formatTime = (item: RideDoc & { id: string }) => {
    const created = item.createdAt as any;
    const ts = created && typeof created === 'object' && 'seconds' in created ? created.seconds * 1000 : 0;
    if (!ts) return '--:--';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatDateHeader = (item: RideDoc & { id: string }) => {
    const created = item.createdAt as any;
    const ts = created && typeof created === 'object' && 'seconds' in created ? created.seconds * 1000 : 0;
    if (!ts) return '';
    const d = new Date(ts);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <ThemedText style={styles.backArrow}>←</ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>Recent orders</ThemedText>

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
            <View style={styles.rowHeader}>
              <ThemedText style={styles.time}>{formatTime(item)}</ThemedText>
              <ThemedText style={[styles.fare, item.status === 'cancelled' && styles.cancelledFare]}>
                {item.estimatedFare} MVR
              </ThemedText>
            </View>

            <View style={styles.routeRow}>
              <View style={styles.dotCol}>
                <View style={styles.dotA} />
                {item.stopsCount && item.stopsCount > 1 ? (
                  <>
                    <View style={styles.vertLine} />
                    <View style={styles.dotStop} />
                  </>
                ) : null}
                <View style={styles.vertLine} />
                <View style={styles.dotB} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.placeName} numberOfLines={1}>
                  {item.pickupName || 'Unknown'}
                </ThemedText>
                {item.stopsCount && item.stopsCount > 1 && (
                  <ThemedText style={styles.stopText}>{item.stopsCount - 1} stop{item.stopsCount > 2 ? 's' : ''}</ThemedText>
                )}
                <ThemedText style={styles.placeName} numberOfLines={1}>
                  {item.dropoffName || 'Unknown'}
                </ThemedText>
              </View>
            </View>

            {item.status === 'cancelled' && (
              <ThemedText style={styles.cancelledBadge}>Cancelled</ThemedText>
            )}
          </View>
        )}
        ListEmptyComponent={<ThemedText style={{ padding: 16 }}>{error ? 'Fix the error above to see rides' : 'No completed rides yet'}</ThemedText>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  backBtn: { padding: 16, paddingTop: 24 },
  backArrow: { fontSize: 28, width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', textAlign: 'center', textAlignVertical: 'center', lineHeight: 38 },
  title: { fontSize: 32, fontWeight: '900', paddingHorizontal: 16, paddingBottom: 16 },
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  time: {
    fontSize: 14,
    color: '#777',
  },
  fare: {
    fontSize: 16,
    fontWeight: '700',
  },
  cancelledFare: {
    color: '#E53935',
  },
  routeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dotCol: {
    width: 18,
    alignItems: 'center',
    paddingTop: 4,
  },
  dotA: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8BC34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotB: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#19A64B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotStop: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#333',
  },
  vertLine: {
    width: 2,
    height: 18,
    backgroundColor: '#ddd',
    marginVertical: 2,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  stopText: {
    fontSize: 13,
    color: '#777',
    marginVertical: 2,
  },
  cancelledBadge: {
    marginTop: 8,
    color: '#E53935',
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'right',
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
