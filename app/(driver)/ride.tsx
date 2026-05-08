import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MapView, Marker, Polyline } from '@/src/components/Map';
import { MessageModal } from '@/src/components/MessageModal';
import { SwipeButton } from '@/src/components/SwipeButton';
import { db } from '@/src/firebase';
import type { RideDoc } from '@/src/ride/types';
import type { LatLng } from '@/src/utils/geo';

export default function DriverRideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [ride, setRide] = useState<RideDoc & { id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [driverLoc, setDriverLoc] = useState<LatLng | null>(null);
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'rides', id), (snap: any) => {
      setLoading(false);
      if (!snap.exists()) {
        setRide(null);
        return;
      }
      setRide({ id: snap.id, ...(snap.data() as RideDoc) });
    });
    return unsub;
  }, [id]);

  // Track driver current location for navigation
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
        (pos) => {
          setDriverLoc({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      );
    })();
    return () => {
      try {
        if (sub && typeof sub.remove === 'function') sub.remove();
      } catch {
        // ignore on web
      }
    };
  }, []);

  const markArrived = async () => {
    if (!id) return;
    await updateDoc(doc(db, 'rides', id), {
      status: 'driver_arriving',
      arrivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const startTrip = async () => {
    if (!id) return;
    await updateDoc(doc(db, 'rides', id), {
      status: 'trip_started',
      tripStartedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const completeRide = async () => {
    if (!id) return;
    await updateDoc(doc(db, 'rides', id), {
      status: 'trip_completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const cancelRide = async () => {
    if (!id) return;
    await updateDoc(doc(db, 'rides', id), {
      status: 'cancelled',
      driverId: null,
      updatedAt: serverTimestamp(),
    });
    router.replace('/(driver)');
  };

  const submitRating = async (stars: number) => {
    if (!id) return;
    setRating(stars);
    await updateDoc(doc(db, 'rides', id), {
      driverRating: stars,
      driverRatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as any);
  };

  const openNavigation = () => {
    if (!ride) return;
    let dest: LatLng | null = null;
    if (ride.status === 'driver_assigned' || ride.status === 'driver_arriving') {
      dest = ride.pickup;
    } else if (ride.status === 'trip_started') {
      dest = ride.dropoff;
    }
    if (!dest) return;

    // If we have driver location, use full navigation; otherwise just open to destination
    const url = driverLoc
      ? Platform.select({
          ios: `http://maps.apple.com/?saddr=${driverLoc.latitude},${driverLoc.longitude}&daddr=${dest.latitude},${dest.longitude}`,
          default: `https://www.google.com/maps/dir/?api=1&origin=${driverLoc.latitude},${driverLoc.longitude}&destination=${dest.latitude},${dest.longitude}&travelmode=driving`,
        })
      : Platform.select({
          ios: `http://maps.apple.com/?daddr=${dest.latitude},${dest.longitude}`,
          default: `https://www.google.com/maps/search/?api=1&query=${dest.latitude},${dest.longitude}`,
        });
    if (url) Linking.openURL(url);
  };

  const showNavButton = ride?.status === 'driver_assigned' || ride?.status === 'driver_arriving' || ride?.status === 'trip_started';

  if (loading || !ride) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const showReceipt = ride.status === 'trip_completed' && !paid;
  const showCompleted = ride.status === 'trip_completed' && paid;

  return (
    <View style={styles.container}>
      <Pressable style={styles.homeBtn} onPress={() => router.replace('/(driver)')}>
        <ThemedText style={styles.homeBtnText}>🏠 Home</ThemedText>
      </Pressable>

      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={ride.pickup ? { ...ride.pickup, latitudeDelta: 0.02, longitudeDelta: 0.02 } : undefined}
      >
        {ride.pickup ? <Marker coordinate={ride.pickup} title="Pickup" /> : null}
        {ride.dropoff ? <Marker coordinate={ride.dropoff} title="Destination" /> : null}
        {ride.pickup && ride.dropoff ? <Polyline coordinates={[ride.pickup, ride.dropoff]} strokeWidth={4} /> : null}
      </MapView>

      <View style={styles.topSheet}>
        <View style={styles.topCard}>
          <View style={styles.locationsRow}>
            <View style={styles.dotCol}>
              <View style={styles.dotA} />
              <View style={styles.vertLine} />
              <View style={styles.dotB} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.placeTitle} numberOfLines={1}>
                {ride.pickupName || 'Pickup location'}
              </ThemedText>
              <ThemedText style={styles.placeSub} numberOfLines={1}>
                {ride.pickupName ? '' : `${ride.pickup?.latitude?.toFixed(4)}, ${ride.pickup?.longitude?.toFixed(4)}`}
              </ThemedText>

              <View style={{ height: 10 }} />

              <ThemedText style={styles.placeTitle} numberOfLines={1}>
                {ride.dropoffName || 'Destination'}
              </ThemedText>
              <ThemedText style={styles.placeSub} numberOfLines={1}>
                {ride.dropoffName ? '' : `${ride.dropoff?.latitude?.toFixed(4)}, ${ride.dropoff?.longitude?.toFixed(4)}`}
              </ThemedText>
            </View>
          </View>

          {(ride.status === 'driver_assigned' || ride.status === 'driver_arriving') && (
            <Pressable style={styles.cancelBtn} onPress={cancelRide}>
              <ThemedText style={styles.cancelText}>Cancel ride</ThemedText>
            </Pressable>
          )}
        </View>

        <View style={styles.contactCard}>
          <View style={styles.avatar} />
          <ThemedText style={styles.riderInline} numberOfLines={1}>
            {ride.riderName || 'Customer'}
          </ThemedText>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.iconBtn} onPress={() => setShowMessages(true)}>
            <ThemedText style={styles.iconText}>💬</ThemedText>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => {}}>
            <ThemedText style={styles.iconText}>📞</ThemedText>
          </Pressable>
        </View>
      </View>

      {ride.status === 'driver_assigned' && (
        <View style={styles.bottomArea}>
          <Pressable style={styles.navigateBtn} onPress={openNavigation}>
            <ThemedText style={styles.navigateBtnText}>🗺️ Navigate to Pickup</ThemedText>
          </Pressable>
          <View style={{ height: 12 }} />
          <SwipeButton label="Swipe to Mark Arrived" onComplete={markArrived} />
        </View>
      )}

      {ride.status === 'driver_arriving' && (
        <View style={styles.bottomArea}>
          <SwipeButton label="Swipe to Start Trip" onComplete={startTrip} />
        </View>
      )}

      {ride.status === 'trip_started' && (
        <View style={styles.bottomArea}>
          <Pressable style={styles.navigateBtn} onPress={openNavigation}>
            <ThemedText style={styles.navigateBtnText}>🗺️ Navigate to Destination</ThemedText>
          </Pressable>
          <View style={{ height: 12 }} />
          <SwipeButton label="Swipe to Finish Trip" onComplete={completeRide} />
        </View>
      )}

      {showNavButton && (
        <Pressable style={styles.navBtn} onPress={openNavigation}>
          <ThemedText style={styles.navBtnText}>🗺️</ThemedText>
        </Pressable>
      )}

      {showReceipt && (
        <View style={styles.receiptOverlay}>
          <ThemedText type="title" style={styles.receiptTitle}>Receipt</ThemedText>
          <ThemedText style={styles.receiptLabel}>Customer should pay</ThemedText>
          <ThemedText style={styles.receiptAmount}>MVR {ride.estimatedFare}</ThemedText>
          <Pressable style={styles.primaryBtn} onPress={() => setPaid(true)}>
            <ThemedText style={styles.primaryBtnText}>Payment Completed</ThemedText>
          </Pressable>
        </View>
      )}

      <MessageModal
        visible={showMessages}
        rideId={id || ''}
        currentUserRole="driver"
        otherPartyName={ride?.riderName || 'Rider'}
        onClose={() => setShowMessages(false)}
      />

      {showCompleted && (
        <View style={styles.completeOverlay}>
          <ThemedText style={styles.completeTitle}>Order is completed</ThemedText>
          <ThemedText style={styles.completeSub}>Paid with cash</ThemedText>
          <ThemedText style={styles.completeAmount}>MVR {Number(ride.estimatedFare).toFixed(2)}</ThemedText>

          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/(driver)/history')}>
            <ThemedText style={styles.secondaryBtnText}>Order Details</ThemedText>
          </Pressable>

          <View style={styles.rateCard}>
            <ThemedText style={styles.rateTitle}>Rate {ride.riderName || 'Customer'}</ThemedText>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => submitRating(s)} style={styles.starBtn}>
                  <ThemedText style={[styles.star, rating >= s ? styles.starOn : styles.starOff]}>★</ThemedText>
                </Pressable>
              ))}
            </View>
            <ThemedText style={styles.rateHint}>Tap on the stars to rate</ThemedText>
          </View>

          <Pressable style={[styles.primaryBtn, { marginTop: 16 }]} onPress={() => router.replace('/(driver)')}>
            <ThemedText style={styles.primaryBtnText}>Back to Dashboard</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 48,
    gap: 10,
  },
  topCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  locationsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dotCol: {
    width: 18,
    alignItems: 'center',
    paddingTop: 6,
  },
  dotA: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111',
  },
  vertLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ddd',
    marginVertical: 6,
  },
  dotB: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0B9E3D',
  },
  placeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  placeSub: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  cancelText: {
    color: '#E53935',
    fontWeight: '700',
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e6e6e6',
  },
  riderInline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#0B9E3D',
  },
  receiptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  receiptTitle: {
    marginBottom: 90,
  },
  receiptLabel: {
    color: '#9b9b9b',
    fontSize: 16,
  },
  receiptAmount: {
    fontSize: 40,
    fontWeight: '900',
    marginTop: 10,
  },
  primaryBtn: {
    marginTop: 120,
    backgroundColor: '#0B9E3D',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  completeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B9E3D',
    paddingHorizontal: 24,
    paddingTop: 110,
    alignItems: 'center',
  },
  completeTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  completeSub: {
    color: '#e9f7ee',
    marginTop: 8,
  },
  completeAmount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 18,
  },
  secondaryBtn: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  rateCard: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  rateTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  starBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  star: {
    fontSize: 30,
  },
  starOn: {
    color: '#0B9E3D',
  },
  starOff: {
    color: '#C8D1CC',
  },
  rateHint: {
    marginTop: 10,
    color: '#777',
  },
  navBtn: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  navBtnText: {
    fontSize: 24,
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
  navigateBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0B9E3D',
  },
  navigateBtnText: {
    color: '#0B9E3D',
    fontSize: 16,
    fontWeight: '800',
  },
});
