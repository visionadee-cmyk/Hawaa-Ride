import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { ref, set as rtdbSet } from 'firebase/database';
import {
    collection,
    doc,
    onSnapshot,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, Pressable, StyleSheet, Switch, Vibration, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { MapView, Marker, Polyline } from '@/src/components/Map';
import { db, rtdb } from '@/src/firebase';
import type { DriverProfile, RideDoc } from '@/src/ride/types';
import { useDriverSettings } from '@/src/settings/DriverSettingsContext';
import { playRingtone } from '@/src/settings/sound';
import type { LatLng } from '@/src/utils/geo';
import { haversineKm } from '@/src/utils/geo';

export default function DriverHome() {
  const router = useRouter();
  const { firebaseUser, logout } = useAuth();
  const { settings } = useDriverSettings();
  const mapRef = useRef<any>(null);

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [rides, setRides] = useState<Array<RideDoc & { id: string }>>([]);
  const [driverLoc, setDriverLoc] = useState<LatLng | null>(null);
  const [currentRide, setCurrentRide] = useState<RideDoc & { id: string } | null>(null);

  const [todayStats, setTodayStats] = useState({ trips: 0, earnings: 0, distance: 0 });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rejectedRideIds, setRejectedRideIds] = useState<Record<string, true>>({});
  const [notificationMinimized, setNotificationMinimized] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(doc(db, 'drivers', firebaseUser.uid), (snap: any) => {
      setLoadingProfile(false);
      if (!snap.exists()) {
        setProfile(null);
        return;
      }
      setProfile(snap.data() as DriverProfile);
    });
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 10 },
        async (pos) => {
          const next: LatLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setDriverLoc(next);

          if (profile?.approvalStatus === 'approved') {
            await setDoc(
              doc(db, 'drivers', firebaseUser.uid),
              { lastLocation: next, updatedAt: serverTimestamp() },
              { merge: true }
            );
            await rtdbSet(ref(rtdb, `drivers/${firebaseUser.uid}/location`), next);
          }
        }
      );

      return () => {
        try {
          if (sub && typeof (sub as any).remove === 'function') (sub as any).remove();
        } catch {
          // ignore on web
        }
      };
    })();
  }, [firebaseUser, profile?.approvalStatus]);

  const playAlert = () => {
    if (settings.soundEnabled) {
      playRingtone(settings.ringtone, settings.notificationVolume);
    }
    if (settings.vibrationEnabled && Platform.OS !== 'web') {
      Vibration.vibrate(250);
    }
  };

  useEffect(() => {
    console.log('[Driver] Rides effect running', { online: profile?.online, approved: profile?.approvalStatus, driverLoc: !!driverLoc });
    if (!profile?.online || profile.approvalStatus !== 'approved') {
      console.log('[Driver] Not showing rides - not online or not approved');
      setRides([]);
      return;
    }

    // Show all searching rides
    const q = query(collection(db, 'rides'), where('status', '==', 'searching'));
    console.log('[Driver] Listening for searching rides...');
    const unsub = onSnapshot(q, (snap: any) => {
      const items: Array<RideDoc & { id: string }> = [];
      snap.forEach((d: any) => items.push({ id: d.id, ...(d.data() as RideDoc) }));
      console.log('[Driver] Got rides update:', items.length);
      setRides(items);
    }, (err: any) => {
      console.log('[Driver] Rides listener error:', err?.message || err);
    });
    return unsub;
  }, [profile?.online, profile?.approvalStatus]);

  // Filter rides by notification range - hide requests when driver has active ride
  const visibleRides = useMemo(() => {
    // Don't show any ride requests if driver has an active ride
    if (currentRide) return [];
    if (!driverLoc || !profile?.notificationRangeKm) {
      console.log('[Driver] Showing all rides (no location filter)', { driverLoc: !!driverLoc, range: profile?.notificationRangeKm });
      return rides;
    }
    const filtered = rides.filter((ride) => {
      if (rejectedRideIds[ride.id]) return false;
      const km = haversineKm(driverLoc, ride.pickup);
      console.log('[Driver] Ride distance check:', { rideId: ride.id, km: km.toFixed(2), range: profile.notificationRangeKm });
      // TEMPORARILY DISABLED FOR TESTING: return km <= (profile.notificationRangeKm || 5);
      return true; // Show all rides for now
    });
    console.log('[Driver] Filtered rides:', { total: rides.length, visible: filtered.length, range: profile.notificationRangeKm });
    return filtered;
  }, [rides, driverLoc, profile?.notificationRangeKm, currentRide, rejectedRideIds]);

  // Keep alerting driver while a visible searching ride exists (until accepted by someone)
  useEffect(() => {
    if (currentRide) return;
    const activeRequestId = visibleRides[0]?.id;
    if (!activeRequestId) return;

    // Alert once immediately, then repeat every 8 seconds while still visible
    playAlert();
    const t = setInterval(() => {
      playAlert();
    }, 8000);
    return () => clearInterval(t);
  }, [visibleRides, currentRide]);

  // Fetch driver's current active ride + today's stats
  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(collection(db, 'rides'), where('driverId', '==', firebaseUser.uid));
    const unsub = onSnapshot(q, (snap: any) => {
      const items: Array<RideDoc & { id: string }> = [];
      let trips = 0, earnings = 0, distance = 0;
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      snap.forEach((d: any) => {
        const data = d.data() as RideDoc;
        const created = data.createdAt as any;
        const ts = created && typeof created === 'object' && 'seconds' in created ? created.seconds * 1000 : 0;
        const isToday = ts >= startOfDay.getTime();

        if (data.status === 'driver_assigned' || data.status === 'driver_arriving' || data.status === 'trip_started') {
          items.push({ id: d.id, ...data });
        }
        if (data.status === 'trip_completed' && isToday) {
          trips++;
          earnings += data.estimatedFare || 0;
          distance += data.estimatedDistanceKm || 0;
        }
      });
      setCurrentRide(items[0] || null);
      setTodayStats({ trips, earnings, distance });
    });
    return unsub;
  }, [firebaseUser]);

  // Refresh stats when screen comes into focus (e.g., after completing a ride)
  useFocusEffect(
    React.useCallback(() => {
      if (!firebaseUser) return;
      // Re-query to ensure fresh data
      const q = query(collection(db, 'rides'), where('driverId', '==', firebaseUser.uid));
      const unsub = onSnapshot(q, (snap: any) => {
        let trips = 0, earnings = 0, distance = 0;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        snap.forEach((d: any) => {
          const data = d.data() as RideDoc;
          const created = data.createdAt as any;
          const ts = created && typeof created === 'object' && 'seconds' in created ? created.seconds * 1000 : 0;
          const isToday = ts >= startOfDay.getTime();

          if (data.status === 'trip_completed' && isToday) {
            trips++;
            earnings += data.estimatedFare || 0;
            distance += data.estimatedDistanceKm || 0;
          }
        });
        setTodayStats({ trips, earnings, distance });
      });
      return unsub;
    }, [firebaseUser])
  );

  const routeLine = useMemo(() => {
    if (!currentRide) return null;
    if (!driverLoc) return null;
    if (currentRide.status === 'trip_started') {
      return [driverLoc, currentRide.dropoff] as LatLng[];
    }
    return [driverLoc, currentRide.pickup] as LatLng[];
  }, [currentRide, driverLoc]);

  const mapInitial = useMemo(() => {
    const center = driverLoc ?? currentRide?.pickup ?? null;
    if (!center) return undefined;
    return { ...center, latitudeDelta: 0.02, longitudeDelta: 0.02 };
  }, [currentRide?.pickup, driverLoc]);

  const toggleOnline = async () => {
    if (!firebaseUser || !profile) return;
    await setDoc(
      doc(db, 'drivers', firebaseUser.uid),
      { online: !profile.online, updatedAt: serverTimestamp() },
      { merge: true }
    );
  };

  const setOnline = async (next: boolean) => {
    if (!firebaseUser || !profile) return;
    if (next === profile.online) return;
    await toggleOnline();
  };

  const accept = async (rideId: string) => {
    if (!firebaseUser) return;
    try {
      await runTransaction(db, async (tx) => {
        const rideRef = doc(db, 'rides', rideId);
        const snap = await tx.get(rideRef);
        if (!snap.exists()) throw new Error('NOT_FOUND');
        const data = snap.data() as any;

        // Only allow one winner
        if (data.status !== 'searching' || data.driverId) {
          throw new Error('TAKEN');
        }

        tx.update(rideRef, {
          driverId: firebaseUser.uid,
          status: 'driver_assigned',
          updatedAt: serverTimestamp(),
        });
      });

      router.push({ pathname: '/(driver)/ride', params: { id: rideId } });
    } catch (e: any) {
      const msg = String(e?.message || '').toUpperCase();
      if (msg.includes('TAKEN')) {
        Alert.alert('Sorry', 'Another driver won this order. Please wait for the next request.');
        reject(rideId);
        return;
      }
      console.error('Accept ride failed:', e);
      Alert.alert('Error', e?.message || 'Failed to accept ride');
    }
  };

  const reject = (rideId: string) => {
    setRejectedRideIds((prev) => ({ ...prev, [rideId]: true }));
  };

  if (!firebaseUser) return null;

  if (loadingProfile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <ThemedText>You are not registered as a driver yet.</ThemedText>
        <View style={{ marginTop: 12 }}>
          <Button title="Register" onPress={() => router.push('/(driver)/register')} />
        </View>
      </View>
    );
  }

  if (profile.approvalStatus !== 'approved') {
    return (
      <View style={styles.center}>
        <ThemedText type="subtitle">Status: {profile.approvalStatus}</ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          Waiting for admin approval.
        </ThemedText>
        <View style={{ marginTop: 12 }}>
          <Button title="Refresh" onPress={() => {}} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapBg}>
        <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={mapInitial}>
          {driverLoc ? <Marker coordinate={driverLoc} title="You" /> : null}
          {currentRide?.pickup ? <Marker coordinate={currentRide.pickup} title="Pickup" /> : null}
          {currentRide?.dropoff ? <Marker coordinate={currentRide.dropoff} title="Destination" /> : null}
          {routeLine ? <Polyline coordinates={routeLine} strokeWidth={4} /> : null}
        </MapView>
      </View>

      <Pressable
        style={styles.locBtn}
        onPress={() => {
          if (!driverLoc || !mapRef.current) return;
          mapRef.current.animateToRegion(
            { ...driverLoc, latitudeDelta: 0.005, longitudeDelta: 0.005 },
            500
          );
        }}
      >
        <ThemedText style={styles.locIcon}>⌖</ThemedText>
      </Pressable>

      <Pressable style={styles.hamburgerBtn} onPress={() => setDrawerOpen(true)}>
        <ThemedText style={styles.hamburgerText}>≡</ThemedText>
      </Pressable>

      <View style={styles.todayCard}>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle" style={styles.todayTitle}>Today&apos;s total</ThemedText>
          <ThemedText style={styles.todayLine}>{todayStats.trips} trips</ThemedText>
          <ThemedText style={styles.todayLine}>{todayStats.distance.toFixed(1)} km</ThemedText>
          <ThemedText style={styles.todayLine}>{profile.online ? 'Online' : 'Offline'}</ThemedText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <ThemedText style={styles.todayAmount}>{todayStats.earnings}</ThemedText>
          <ThemedText style={styles.todayAmountLabel}>MVR</ThemedText>
        </View>
      </View>

      <View style={styles.preordersSection}>
        <ThemedText style={styles.preordersLabel}>Preorders (0)</ThemedText>
      </View>

      {currentRide ? (
        <View style={styles.currentRidePill}>
          <ThemedText type="subtitle">Current ride</ThemedText>
          <ThemedText style={{ marginTop: 4 }}>
            Status: {(currentRide.status as string).toUpperCase()}
          </ThemedText>
          <View style={{ marginTop: 8 }}>
            <Button
              title="Open ride"
              onPress={() => router.push({ pathname: '/(driver)/ride', params: { id: currentRide.id } })}
              color="#FF9800"
            />
          </View>
        </View>
      ) : null}

      <Pressable style={styles.sosBtn} onPress={() => {}}>
        <ThemedText style={styles.sosText}>SOS</ThemedText>
      </Pressable>

      <View style={styles.bottomBar}>
        <ThemedText style={[styles.bottomLabel, !profile.online ? styles.bottomActive : null]}>OFFLINE</ThemedText>
        <Switch
          value={profile.online}
          onValueChange={setOnline}
          trackColor={{ false: '#cfcfcf', true: '#b7e0bf' }}
          thumbColor={profile.online ? '#4CAF50' : '#ffffff'}
        />
        <ThemedText style={[styles.bottomLabel, profile.online ? styles.bottomActive : null]}>ONLINE</ThemedText>
      </View>

      {drawerOpen ? (
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawer}>
            <ThemedText type="title" style={{ marginBottom: 16 }}>Menu</ThemedText>

            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <ThemedText style={styles.drawerItemText}>Profile</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <ThemedText style={styles.drawerItemText}>Notifications</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <ThemedText style={styles.drawerItemText}>Wallet</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); router.push('/(driver)/history'); }}>
              <ThemedText style={styles.drawerItemText}>Recent orders</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); router.push('/(driver)/settings'); }}>
              <ThemedText style={styles.drawerItemText}>⚙️ Settings</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); router.push('/(driver)/range'); }}>
              <ThemedText style={styles.drawerItemText}>📍 Notification Range</ThemedText>
            </Pressable>

            <View style={{ marginTop: 16 }}>
              <Button
                title="Logout"
                onPress={async () => {
                  setDrawerOpen(false);
                  await logout();
                  router.replace('/(auth)/login');
                }}
                color="#f44336"
              />
            </View>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.requestsSheet}>
        {currentRide ? (
          <View style={styles.activeRideBanner}>
            <ThemedText style={styles.activeRideTitle}>🚗 Active Ride in Progress</ThemedText>
            <ThemedText style={styles.activeRideText}>
              Pickup: {currentRide.pickupName || `${currentRide.pickup?.latitude?.toFixed(3)}, ${currentRide.pickup?.longitude?.toFixed(3)}`}
            </ThemedText>
            <ThemedText style={styles.activeRideText}>
              To: {currentRide.dropoffName || `${currentRide.dropoff?.latitude?.toFixed(3)}, ${currentRide.dropoff?.longitude?.toFixed(3)}`}
            </ThemedText>
            <ThemedText style={styles.activeRideFare}>Fare: MVR {currentRide.estimatedFare}</ThemedText>
            <Button 
              title="View Active Ride" 
              onPress={() => router.push({ pathname: '/(driver)/ride', params: { id: currentRide.id } })} 
              color="#FF9800"
            />
          </View>
        ) : (
          <>
            <ThemedText type="subtitle" style={{ padding: 16, paddingBottom: 8 }}>
              Ride Requests ({visibleRides.length})
            </ThemedText>
            {__DEV__ && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <ThemedText style={{ fontSize: 11, color: profile?.online && profile?.approvalStatus === 'approved' ? '#4CAF50' : '#f44336' }}>
                  Debug: {profile?.online ? '🟢 Online' : '🔴 Offline'} | {profile?.approvalStatus === 'approved' ? '✅ Approved' : '⛔ ' + (profile?.approvalStatus || 'unknown')} | {driverLoc ? '📍 Location OK' : '❌ No location'} | Total: {rides.length}
                </ThemedText>
              </View>
            )}
          </>
        )}
        {!currentRide && visibleRides[0] && !notificationMinimized ? (
          <View style={styles.bidCard}>
            <Pressable style={styles.minimizeBtn} onPress={() => setNotificationMinimized(true)}>
              <ThemedText style={styles.minimizeText}>✕</ThemedText>
            </Pressable>
            <View style={styles.bidCardHeader}>
              <ThemedText style={styles.bidEta}>1 mins</ThemedText>
              <ThemedText style={styles.bidFare}>MVR {visibleRides[0].estimatedFare}</ThemedText>
            </View>

            <View style={styles.bidPlacesRow}>
              <View style={styles.bidDotsCol}>
                <View style={styles.bidDotA} />
                <View style={styles.bidVertLine} />
                <View style={styles.bidDotB} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.bidPlace} numberOfLines={1}>
                  {visibleRides[0].pickupName || 'Pickup location'}
                </ThemedText>
                <ThemedText style={styles.bidSub} numberOfLines={1}>
                  {visibleRides[0].pickupName ? '' : `${visibleRides[0].pickup.latitude.toFixed(4)}, ${visibleRides[0].pickup.longitude.toFixed(4)}`}
                </ThemedText>
                <View style={{ height: 10 }} />
                <ThemedText style={styles.bidPlace} numberOfLines={1}>
                  {visibleRides[0].dropoffName || 'Destination'}
                </ThemedText>
                <ThemedText style={styles.bidSub} numberOfLines={1}>
                  {visibleRides[0].dropoffName ? '' : `${visibleRides[0].dropoff.latitude.toFixed(4)}, ${visibleRides[0].dropoff.longitude.toFixed(4)}`}
                </ThemedText>
              </View>
            </View>

            <View style={styles.bidMiniMap}>
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  ...visibleRides[0].pickup,
                  latitudeDelta: 0.03,
                  longitudeDelta: 0.03,
                }}
              >
                <Marker coordinate={visibleRides[0].pickup} />
                <Marker coordinate={visibleRides[0].dropoff} />
                <Polyline coordinates={[visibleRides[0].pickup, visibleRides[0].dropoff]} strokeWidth={4} />
              </MapView>
            </View>

            <View style={styles.bidActionsRow}>
              <Pressable style={styles.rejectBtn} onPress={() => reject(visibleRides[0].id)}>
                <ThemedText style={styles.rejectText}>Reject</ThemedText>
              </Pressable>
              <Pressable style={styles.bidBtn} onPress={() => accept(visibleRides[0].id)}>
                <ThemedText style={styles.bidBtnText}>Bid</ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          !currentRide && visibleRides[0] && notificationMinimized ? (
            <Pressable style={styles.miniNotification} onPress={() => setNotificationMinimized(false)}>
              <ThemedText style={styles.miniNotifText}>🚗 New Request</ThemedText>
            </Pressable>
          ) : (
            !currentRide ? <ThemedText style={{ paddingHorizontal: 16, paddingBottom: 16 }}>No requests</ThemedText> : null
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  mapBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#dfe6ea',
  },
  hamburgerBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerText: {
    fontSize: 22,
    lineHeight: 22,
  },
  todayCard: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayLine: {
    color: '#666',
    marginTop: 2,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111',
  },
  todayAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: '#19A64B',
  },
  todayAmountLabel: {
    color: '#8a8a8a',
    marginTop: 2,
    fontSize: 14,
  },
  preordersSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  preordersLabel: {
    color: '#8BC34A',
    fontSize: 16,
    fontWeight: '700',
  },
  locBtn: {
    position: 'absolute',
    bottom: 220,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  locIcon: {
    fontSize: 24,
    color: '#19A64B',
    fontWeight: '700',
  },
  sosBtn: {
    position: 'absolute',
    bottom: 140,
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e53935',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    color: '#fff',
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  bottomLabel: {
    color: '#9e9e9e',
    fontWeight: '700',
  },
  bottomActive: {
    color: '#fff',
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row',
  },
  drawer: {
    width: 280,
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 60,
  },
  drawerItem: {
    paddingVertical: 12,
  },
  drawerItemText: {
    fontSize: 18,
    color: '#4CAF50',
  },
  currentRidePill: {
    position: 'absolute',
    top: 210,
    left: 16,
    right: 16,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  requestsSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 64,
    maxHeight: 520,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bidCard: {
    margin: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#19A64B',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  bidCardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bidEta: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111',
  },
  bidFare: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
  },
  bidPlacesRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  bidDotsCol: {
    width: 18,
    alignItems: 'center',
    paddingTop: 6,
  },
  bidDotA: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111',
  },
  bidVertLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#ddd',
    marginVertical: 6,
  },
  bidDotB: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#19A64B',
  },
  bidPlace: {
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
  },
  bidSub: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  bidMiniMap: {
    height: 170,
    marginTop: 12,
    backgroundColor: '#dfe6ea',
  },
  bidActionsRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  rejectBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#E57373',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  rejectText: {
    color: '#E53935',
    fontWeight: '900',
    fontSize: 16,
  },
  bidBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F6B24B',
  },
  bidBtnText: {
    color: '#111',
    fontWeight: '900',
    fontSize: 16,
  },
  minimizeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  minimizeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },
  miniNotification: {
    position: 'absolute',
    right: 16,
    bottom: 180,
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  miniNotifText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  rideCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  activeRideBanner: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  activeRideTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  activeRideText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  activeRideFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 8,
    marginBottom: 12,
  },
});
