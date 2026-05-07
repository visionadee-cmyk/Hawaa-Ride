import { useRouter } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Button, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { db } from '@/src/firebase';
import type { VehicleType } from '@/src/ride/types';

export default function DriverRegister() {
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');

  const submit = async () => {
    if (!firebaseUser) return;

    await setDoc(
      doc(db, 'drivers', firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        name,
        phoneNumber: firebaseUser.phoneNumber ?? null,
        licenseNumber,
        vehicleType,
        vehicleDetails,
        approvalStatus: 'pending',
        online: false,
        notificationRangeKm: 5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    router.replace('/(driver)');
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">Driver Registration</ThemedText>

      <TextInput value={name} onChangeText={setName} placeholder="Full name" style={styles.input} />
      <TextInput
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        placeholder="License number"
        style={styles.input}
      />

      <ThemedText style={{ marginTop: 8 }}>Vehicle type</ThemedText>
      <View style={styles.row}>
        <Button title="Bike" onPress={() => setVehicleType('bike')} />
        <Button title="Car" onPress={() => setVehicleType('car')} />
        <Button title="Pickup" onPress={() => setVehicleType('pickup')} />
        <Button title="Van" onPress={() => setVehicleType('van')} />
      </View>
      <ThemedText>Selected: {vehicleType}</ThemedText>

      <TextInput
        value={vehicleDetails}
        onChangeText={setVehicleDetails}
        placeholder="Vehicle details"
        style={styles.input}
      />

      <View style={{ marginTop: 12 }}>
        <Button
          title="Submit for approval"
          onPress={submit}
          disabled={!firebaseUser || !name || !licenseNumber}
        />
      </View>

      <ThemedText style={{ marginTop: 12 }}>
        Document upload will be added next. For MVP, admin approval is based on the submitted info.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
});
