import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import MetricCard from '@/components/MetricCard';
import type { DashMetric } from '@/types';

const MOCK_METRICS: DashMetric[] = [
  {
    id: '1',
    label: 'Total Balance',
    value: '$47,832.15',
    change: 2.4,
    platform: 'all',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    label: 'Daily PnL',
    value: '+$1,142.30',
    change: 3.1,
    platform: 'all',
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    label: 'Open Positions',
    value: '7',
    platform: 'all',
    updatedAt: new Date().toISOString(),
  },
];

type PlatformBreakdown = {
  name: string;
  balance: string;
  positions: number;
  pnl: string;
  pnlPositive: boolean;
};

const PLATFORM_DATA: PlatformBreakdown[] = [
  { name: 'MT5 Gold', balance: '$32,450.00', positions: 3, pnl: '+$892.50', pnlPositive: true },
  { name: 'Polymarket', balance: '$12,120.15', positions: 4, pnl: '+$249.80', pnlPositive: true },
  { name: 'TradingView', balance: '$3,262.00', positions: 0, pnl: '-$0.00', pnlPositive: false },
];

export default function PortfolioScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setRefreshing(false);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00e5ff"
          colors={['#00e5ff']}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning</Text>
        <Text style={styles.headerTitle}>Portfolio Overview</Text>
      </View>

      {/* Metric Cards */}
      <View style={styles.metricsRow}>
        {MOCK_METRICS.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            change={metric.change}
          />
        ))}
      </View>

      {/* Platform Breakdown */}
      <Text style={styles.sectionTitle}>Platforms</Text>
      {PLATFORM_DATA.map((platform) => (
        <View key={platform.name} style={styles.platformCard}>
          <View style={styles.platformHeader}>
            <Text style={styles.platformName}>{platform.name}</Text>
            <Text
              style={[
                styles.platformPnl,
                { color: platform.pnlPositive ? '#2ea043' : '#f85149' },
              ]}
            >
              {platform.pnl}
            </Text>
          </View>
          <View style={styles.platformRow}>
            <Text style={styles.platformLabel}>Balance</Text>
            <Text style={styles.platformValue}>{platform.balance}</Text>
          </View>
          <View style={styles.platformRow}>
            <Text style={styles.platformLabel}>Positions</Text>
            <Text style={styles.platformValue}>{platform.positions}</Text>
          </View>
        </View>
      ))}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/chat')}
        >
          <Text style={styles.actionText}>Talk to Agent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/activity')}
        >
          <Text style={styles.actionText}>View Trades</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonAlt]}>
          <Text style={styles.actionTextAlt}>Risk Status</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060a',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    color: '#8b949e',
    fontSize: 14,
    marginBottom: 2,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
  },
  metricsRow: {
    gap: 12,
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  platformCard: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    padding: 16,
    marginBottom: 10,
  },
  platformHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  platformName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  platformPnl: {
    fontSize: 14,
    fontWeight: '600',
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  platformLabel: {
    color: '#8b949e',
    fontSize: 13,
  },
  platformValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00e5ff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flex: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  actionText: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonAlt: {
    backgroundColor: 'rgba(179, 136, 255, 0.1)',
    borderColor: '#b388ff',
  },
  actionTextAlt: {
    color: '#b388ff',
    fontSize: 13,
    fontWeight: '600',
  },
});
