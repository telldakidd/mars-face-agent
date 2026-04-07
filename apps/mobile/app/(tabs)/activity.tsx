import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import type { AgentActivity } from '@/types';

const MOCK_ACTIVITY: AgentActivity[] = [
  {
    id: 'act-1',
    type: 'trade',
    description: 'Opened XAUUSD long 0.5 lot at $2,312.40',
    confidence: 0.87,
    platform: 'mt5',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'act-2',
    type: 'alert',
    description: 'Gold approaching resistance at $2,330 -- monitoring closely',
    confidence: 0.72,
    platform: 'mt5',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'act-3',
    type: 'trade',
    description: 'Bought YES on "Fed holds rate June 2026" at $0.62',
    confidence: 0.81,
    platform: 'polymarket',
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'act-4',
    type: 'risk',
    description: 'Exposure check: 34% of equity deployed, within moderate-tier limit',
    confidence: 0.95,
    platform: 'all',
    timestamp: new Date(Date.now() - 18000000).toISOString(),
  },
  {
    id: 'act-5',
    type: 'trade',
    description: 'Closed XAUUSD short 0.3 lot at $2,298.10 (+$127.30)',
    confidence: 0.79,
    platform: 'mt5',
    timestamp: new Date(Date.now() - 28800000).toISOString(),
  },
  {
    id: 'act-6',
    type: 'alert',
    description: 'Polymarket whale sold 50k shares on "Trump tariffs" -- tracking impact',
    confidence: 0.65,
    platform: 'polymarket',
    timestamp: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'act-7',
    type: 'risk',
    description: 'Drawdown alert: MT5 account down 2.1% from daily high',
    confidence: 0.91,
    platform: 'mt5',
    timestamp: new Date(Date.now() - 50400000).toISOString(),
  },
];

function typeColor(type: AgentActivity['type']): string {
  switch (type) {
    case 'trade':
      return '#00e5ff';
    case 'alert':
      return '#d29922';
    case 'risk':
      return '#f85149';
    default:
      return '#8b949e';
  }
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ActivityScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activities] = useState<AgentActivity[]>(MOCK_ACTIVITY);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  function renderItem({ item }: { item: AgentActivity }) {
    const color = typeColor(item.type);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.typeBadge, { borderColor: color }]}>
            <Text style={[styles.typeText, { color }]}>
              {item.type.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
        </View>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.platform}>{item.platform.toUpperCase()}</Text>
          <View style={styles.confidenceBadge}>
            <Text style={styles.confidenceText}>
              {Math.round(item.confidence * 100)}% conf
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agent Activity</Text>
        <Text style={styles.headerSub}>Recent trades, alerts, and risk events</Text>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00e5ff"
            colors={['#00e5ff']}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  headerSub: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timestamp: {
    color: '#8b949e',
    fontSize: 12,
  },
  description: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platform: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confidenceText: {
    color: '#00e5ff',
    fontSize: 11,
    fontWeight: '600',
  },
});
