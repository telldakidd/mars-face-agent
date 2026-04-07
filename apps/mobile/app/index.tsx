import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { isAuthenticated } from '@/lib/auth';

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const result = await isAuthenticated();
      setAuthed(result);
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#05060a' }}>
        <ActivityIndicator size="large" color="#00e5ff" />
      </View>
    );
  }

  if (authed) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
