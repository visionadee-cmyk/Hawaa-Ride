import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Button,
    Platform,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';

import { useRouter } from 'expo-router';
import {
    PhoneAuthProvider,
    RecaptchaVerifier,
    signInWithCredential,
    signInWithPhoneNumber,
} from 'firebase/auth';

import { ThemedText } from '@/components/themed-text';
import { auth } from '@/src/firebase';

const IS_WEB = Platform.OS === 'web';

export default function LoginScreen() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const recaptchaRef = useRef<any>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (IS_WEB && !verifierRef.current) {
      const container = document.getElementById('recaptcha-container');
      if (container) {
        try {
          verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
          });
        } catch (e) {
          console.log('RecaptchaVerifier error:', e);
        }
      }
    }
  }, []);

  const requestOtp = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    try {
      if (IS_WEB) {
        // Web: use explicit reCAPTCHA verifier
        const container = document.getElementById('recaptcha-container');
        if (!container) {
          alert('reCAPTCHA container not found');
          setLoading(false);
          return;
        }
        if (!verifierRef.current) {
          verifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
          });
        }
        const confirmation = await signInWithPhoneNumber(auth, phone, verifierRef.current);
        setVerificationId(confirmation.verificationId);
      } else {
        // Native: use FirebaseRecaptchaVerifierModal (lazy import)
        const { FirebaseRecaptchaVerifierModal } = await import('expo-firebase-recaptcha');
        const verifier = recaptchaRef.current as any;
        const provider = new PhoneAuthProvider(auth);
        const id = await provider.verifyPhoneNumber(phone, verifier);
        setVerificationId(id);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!verificationId) return;
    setLoading(true);
    try {
      if (IS_WEB) {
        const credential = PhoneAuthProvider.credential(verificationId, code);
        await signInWithCredential(auth, credential);
      } else {
        const credential = PhoneAuthProvider.credential(verificationId, code);
        await signInWithCredential(auth, credential);
      }
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText type="title">Hawaa Ride</ThemedText>
      <ThemedText style={styles.subtitle}>Sign in with phone number</ThemedText>

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="+92XXXXXXXXXX"
        keyboardType="phone-pad"
        autoComplete="tel"
        style={styles.input}
      />

      {IS_WEB ? (
        <View id="recaptcha-container" style={{ height: 0, overflow: 'hidden' }} />
      ) : (
        <React.Suspense fallback={null}>
          {(() => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { FirebaseRecaptchaVerifierModal } = require('expo-firebase-recaptcha');
            return (
              <FirebaseRecaptchaVerifierModal
                ref={recaptchaRef}
                firebaseConfig={auth.app.options as any}
                attemptInvisibleVerification
              />
            );
          })()}
        </React.Suspense>
      )}

      {verificationId ? (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="OTP code"
            keyboardType="number-pad"
            style={styles.input}
          />
          <Button
            title="Verify"
            onPress={verifyCode}
            disabled={loading || code.length < 4}
          />
        </>
      ) : (
        <Button
          title="Send OTP"
          onPress={requestOtp}
          disabled={loading || phone.length < 8}
        />
      )}

      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
});
