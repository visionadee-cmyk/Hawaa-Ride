import { MapView, Marker, Polyline } from '@/src/components/Map';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { off, onValue, ref } from 'firebase/database';
import { DocumentSnapshot, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Button, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MessageModal } from '@/src/components/MessageModal';
import { db, rtdb } from '@/src/firebase';
import type { RideDoc } from '@/src/ride/types';
import type { LatLng } from '@/src/utils/geo';

export default function RiderRideScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const rideId = typeof id === 'string' ? id : '';

  const mapRef = useRef<MapView | null>(null);

  const [ride, setRide] = useState<(RideDoc & { id: string }) | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!rideId) return;
    const unsub = onSnapshot(doc(db, 'rides', rideId), (snap: DocumentSnapshot) => {
      if (!snap.exists()) {
        setRide(null);
        return;
      }
      setRide({ id: snap.id, ...(snap.data() as RideDoc) });
    });
    return unsub;
  }, [rideId]);

  useEffect(() => {
    if (!ride?.driverId) return;
    const locRef = ref(rtdb, `drivers/${ride.driverId}/location`);
    const unsub = onValue(locRef, (snap: any) => {
      const v = snap.val() as LatLng | null;
      if (v?.latitude && v?.longitude) setDriverLocation(v);
    });
    return () => {
      off(locRef);
      unsub();
    };
  }, [ride?.driverId]);

  const line = useMemo(() => {
    if (!ride) return null;
    // Driver heading to pickup
    if ((ride.status === 'driver_assigned' || ride.status === 'driver_arriving') && driverLocation && ride.pickup) {
      return [driverLocation, ride.pickup];
    }
    // Trip in progress: show route from pickup to dropoff
    if (ride.status === 'trip_started' && ride.pickup && ride.dropoff) {
      return [ride.pickup, ride.dropoff];
    }
    // Default / searching: pickup to dropoff
    if (ride.pickup && ride.dropoff) return [ride.pickup, ride.dropoff];
    return null;
  }, [ride, driverLocation]);

  const cancel = async () => {
    if (!rideId) return;
    await setDoc(
      doc(db, 'rides', rideId),
      { status: 'cancelled', updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  if (!rideId) {
    return (
      <View style={styles.center}>
        <ThemedText>Ride id missing</ThemedText>
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.homeBtn} onPress={() => router.replace('/(rider)')}>
        <ThemedText style={styles.homeBtnText}>🏠 Home</ThemedText>
      </Pressable>

      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
      >
        <Marker coordinate={ride.pickup} title="Pickup" />
        <Marker coordinate={ride.dropoff} title="Dropoff" />
        {driverLocation ? <Marker coordinate={driverLocation} title="Driver" /> : null}
        {line ? <Polyline coordinates={line} strokeWidth={4} /> : null}
      </MapView>

      <View style={styles.sheet}>
        <ThemedText type="subtitle">Status: {ride.status}</ThemedText>
        <ThemedText>Vehicle: {ride.vehicleType}</ThemedText>
        <ThemedText>Fare: {ride.estimatedFare}</ThemedText>
        <ThemedText>Distance: {ride.estimatedDistanceKm.toFixed(2)} km</ThemedText>
        <ThemedText>
          Driver: {ride.driverId ? ride.driverId.slice(0, 8) + '…' : 'Searching…'}
        </ThemedText>

        {ride.driverId && (
          <View style={{ marginTop: 10, flexDirection: 'row', gap: 10 }}>
            <Button title="Message Driver" onPress={() => setShowMessages(true)} />
          </View>
        )}

        {ride.status === 'searching' ? (
          <View style={{ marginTop: 10 }}>
            <Button title="Cancel" onPress={cancel} />
          </View>
        ) : null}
      </View>

      <MessageModal
        visible={showMessages}
        rideId={rideId}
        currentUserRole="rider"
        otherPartyName="Driver"
        onClose={() => setShowMessages(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  homeBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 100,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  homeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
});
