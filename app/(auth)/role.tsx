import React, { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useAuth, UserRole } from '@/src/auth/AuthContext';

export default function RoleScreen() {
  const router = useRouter();
  const { setRole } = useAuth();
  const [saving, setSaving] = useState(false);

  const choose = async (role: UserRole) => {
    setSaving(true);
    try {
      await setRole(role);
      router.replace('/');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">Choose role</ThemedText>
      <View style={styles.buttons}>
        <Button title="Rider" onPress={() => choose('rider')} disabled={saving} />
        <Button title="Driver" onPress={() => choose('driver')} disabled={saving} />
        <Button title="Admin" onPress={() => choose('admin')} disabled={saving} />
      </View>
      {saving ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  buttons: {
    marginTop: 20,
    gap: 12,
  },
});
