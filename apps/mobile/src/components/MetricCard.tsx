import { View, Text, StyleSheet } from 'react-native';

type MetricCardProps = {
  label: string;
  value: string;
  change?: number;
  icon?: string;
};

export default function MetricCard({ label, value, change }: MetricCardProps) {
  const changeColor =
    change !== undefined
      ? change >= 0
        ? '#2ea043'
        : '#f85149'
      : undefined;

  const changeText =
    change !== undefined
      ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
      : undefined;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {changeText && (
          <View
            style={[
              styles.changeBadge,
              { backgroundColor: `${changeColor}15` },
            ]}
          >
            <Text style={[styles.changeText, { color: changeColor }]}>
              {changeText}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    padding: 16,
    shadowColor: '#00e5ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  changeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
