import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Button, StyleSheet, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const { loading, firebaseUser, role } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && role) {
      if (role === 'rider') router.replace('/(rider)');
      else if (role === 'driver') router.replace('/(driver)');
      else router.replace('/(admin)');
    } else if (firebaseUser && !role) {
      router.replace('/(auth)/role');
    }
  }, [loading, firebaseUser, role, router]);

  if (loading) return null;

  if (firebaseUser && role) return null;
  if (firebaseUser && !role) return null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.logo}>🚗 Hawaa Ride</ThemedText>
        <ThemedText type="subtitle" style={styles.tagline}>Your trusted ride companion</ThemedText>
        
        <View style={styles.features}>
          <ThemedText style={styles.feature}>🚗 Reliable rides</ThemedText>
          <ThemedText style={styles.feature}>💰 Fair pricing</ThemedText>
          <ThemedText style={styles.feature}>⚡ Fast pickup</ThemedText>
        </View>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Get Started"
          onPress={() => router.push('/(auth)/login')}
          color="#4CAF50"
        />
        <View style={{ height: 12 }} />
        <Button
          title="Continue as Guest"
          onPress={() => router.push('/(rider)')}
          color="#2196F3"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    marginBottom: 8,
  },
  tagline: {
    color: '#666',
    marginBottom: 40,
  },
  features: {
    gap: 16,
  },
  feature: {
    fontSize: 18,
  },
  buttons: {
    marginBottom: 40,
  },
});
