import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { login } from '@/lib/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Glow title */}
        <View style={styles.titleContainer}>
          <Text style={styles.titleGlow}>Mars Agent</Text>
          <Text style={styles.title}>Mars Agent</Text>
        </View>
        <Text style={styles.subtitle}>Face-to-Face AI Advisor</Text>

        {/* Error message */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Email input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#8b949e"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#8b949e"
            secureTextEntry
          />
        </View>

        {/* Login button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#05060a" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060a',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  titleGlow: {
    position: 'absolute',
    fontSize: 36,
    fontWeight: '800',
    color: '#00e5ff',
    opacity: 0.3,
    textShadowColor: '#00e5ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#00e5ff',
    textShadowColor: '#00e5ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1,
  },
  error: {
    color: '#f85149',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#8b949e',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00e5ff',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#05060a',
    fontSize: 16,
    fontWeight: '700',
  },
});
