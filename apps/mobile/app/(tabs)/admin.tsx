import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import type { Workflow, DeviceWithStats } from '@/types';
import {
  getWorkflows,
  getAdminDevices,
  assignWorkflow,
  createWorkflow,
} from '@/lib/api';

type ModalMode = 'assign' | 'create' | null;

export default function AdminScreen() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [devices, setDevices] = useState<DeviceWithStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  // Create workflow form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPlatform, setNewPlatform] = useState<'make' | 'n8n'>('n8n');

  const loadData = useCallback(async () => {
    const [w, d] = await Promise.all([getWorkflows(), getAdminDevices()]);
    setWorkflows(w);
    setDevices(d);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleDevice = (id: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllDevices = () => {
    setSelectedDevices(new Set(devices.map((d) => d.id)));
  };

  const handleAssign = async () => {
    if (!selectedWorkflow || selectedDevices.size === 0) return;
    try {
      await assignWorkflow(selectedWorkflow.id, Array.from(selectedDevices));
      Alert.alert(
        'Sent',
        `${selectedWorkflow.title} pushed to ${selectedDevices.size} device(s)`
      );
      setModalMode(null);
      setSelectedWorkflow(null);
      setSelectedDevices(new Set());
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createWorkflow({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        platform: newPlatform,
        guideSteps: [
          { step: 1, text: `Open ${newPlatform.toUpperCase()} and go to Workflows` },
          { step: 2, text: 'Click "Import" and paste the workflow JSON' },
          { step: 3, text: 'Configure your API keys and credentials' },
          { step: 4, text: 'Enable the workflow and test with sample data' },
        ],
      });
      Alert.alert('Created', `${newTitle} added`);
      setModalMode(null);
      setNewTitle('');
      setNewDesc('');
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const makeWorkflows = workflows.filter((w) => w.platform === 'make');
  const n8nWorkflows = workflows.filter((w) => w.platform === 'n8n');

  return (
    <View style={styles.container}>
      <ScrollView
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
          <Text style={styles.headerTitle}>Admin</Text>
          <Text style={styles.headerSub}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} connected
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setModalMode('create')}
          >
            <Text style={styles.actionBtnText}>+ New Workflow</Text>
          </TouchableOpacity>
        </View>

        {/* Devices */}
        <Text style={styles.sectionTitle}>Customer Devices</Text>
        {devices.length === 0 ? (
          <Text style={styles.emptyText}>No customer devices registered yet.</Text>
        ) : (
          devices.map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: device.device?.is_active
                        ? '#2ea043'
                        : '#8b949e',
                    },
                  ]}
                />
              </View>
              <Text style={styles.deviceEmail}>{device.email}</Text>
              <View style={styles.deviceStats}>
                <Text style={styles.statText}>
                  {device.workflowStats.total} workflows
                </Text>
                <Text style={styles.statDivider}> | </Text>
                <Text style={[styles.statText, { color: '#2ea043' }]}>
                  {device.workflowStats.complete} done
                </Text>
                <Text style={styles.statDivider}> | </Text>
                <Text style={[styles.statText, { color: '#d29922' }]}>
                  {device.workflowStats.pending} pending
                </Text>
              </View>
              {device.device && (
                <Text style={styles.lastSeen}>
                  Last seen: {new Date(device.device.last_seen).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))
        )}

        {/* n8n Workflows */}
        <Text style={styles.sectionTitle}>n8n Workflows ({n8nWorkflows.length})</Text>
        {n8nWorkflows.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={styles.workflowRow}
            onPress={() => {
              setSelectedWorkflow(w);
              setSelectedDevices(new Set());
              setModalMode('assign');
            }}
          >
            <View>
              <Text style={styles.workflowName}>{w.title}</Text>
              {w.description && (
                <Text style={styles.workflowDesc} numberOfLines={1}>
                  {w.description}
                </Text>
              )}
            </View>
            <Text style={styles.sendBtn}>Send</Text>
          </TouchableOpacity>
        ))}

        {/* Make Workflows */}
        <Text style={styles.sectionTitle}>Make Workflows ({makeWorkflows.length})</Text>
        {makeWorkflows.map((w) => (
          <TouchableOpacity
            key={w.id}
            style={styles.workflowRow}
            onPress={() => {
              setSelectedWorkflow(w);
              setSelectedDevices(new Set());
              setModalMode('assign');
            }}
          >
            <View>
              <Text style={styles.workflowName}>{w.title}</Text>
              {w.description && (
                <Text style={styles.workflowDesc} numberOfLines={1}>
                  {w.description}
                </Text>
              )}
            </View>
            <Text style={[styles.sendBtn, { color: '#b388ff' }]}>Send</Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Assign Modal — pick devices to send workflow to */}
      <Modal
        visible={modalMode === 'assign'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalMode(null)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              Send: {selectedWorkflow?.title}
            </Text>
            <TouchableOpacity onPress={handleAssign}>
              <Text
                style={[
                  styles.modalClose,
                  {
                    color:
                      selectedDevices.size > 0 ? '#2ea043' : '#8b949e',
                  },
                ]}
              >
                Send ({selectedDevices.size})
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <TouchableOpacity
              style={styles.selectAllBtn}
              onPress={selectAllDevices}
            >
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>

            {devices.map((device) => (
              <TouchableOpacity
                key={device.id}
                style={[
                  styles.deviceSelectRow,
                  selectedDevices.has(device.id) && styles.deviceSelectRowActive,
                ]}
                onPress={() => toggleDevice(device.id)}
              >
                <View>
                  <Text style={styles.deviceSelectName}>{device.name}</Text>
                  <Text style={styles.deviceSelectEmail}>{device.email}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    selectedDevices.has(device.id) && styles.checkboxActive,
                  ]}
                >
                  {selectedDevices.has(device.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Create Workflow Modal */}
      <Modal
        visible={modalMode === 'create'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalMode(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalMode(null)}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Workflow</Text>
            <TouchableOpacity onPress={handleCreate}>
              <Text
                style={[
                  styles.modalClose,
                  { color: newTitle.trim() ? '#2ea043' : '#8b949e' },
                ]}
              >
                Create
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ padding: 20 }}
          >
            {/* Platform selector */}
            <Text style={styles.inputLabel}>Platform</Text>
            <View style={styles.platformToggle}>
              <TouchableOpacity
                style={[
                  styles.platformOpt,
                  newPlatform === 'n8n' && styles.platformOptActive,
                ]}
                onPress={() => setNewPlatform('n8n')}
              >
                <Text
                  style={[
                    styles.platformOptText,
                    newPlatform === 'n8n' && styles.platformOptTextActive,
                  ]}
                >
                  n8n
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.platformOpt,
                  newPlatform === 'make' && styles.platformOptActive,
                ]}
                onPress={() => setNewPlatform('make')}
              >
                <Text
                  style={[
                    styles.platformOptText,
                    newPlatform === 'make' && styles.platformOptTextActive,
                  ]}
                >
                  Make
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Lead Capture Automation"
              placeholderTextColor="#8b949e"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="What does this workflow do?"
              placeholderTextColor="#8b949e"
              multiline
              numberOfLines={3}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060a' },
  content: { paddingHorizontal: 16, paddingTop: 60 },
  header: { marginBottom: 20 },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  headerSub: { color: '#8b949e', fontSize: 14, marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: {
    flex: 1,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00e5ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#00e5ff', fontSize: 14, fontWeight: '600' },

  sectionTitle: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 24,
  },
  emptyText: { color: '#8b949e', fontSize: 14 },

  // Device card
  deviceCard: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    padding: 14,
    marginBottom: 10,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceName: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  deviceEmail: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  deviceStats: { flexDirection: 'row', marginTop: 8, alignItems: 'center' },
  statText: { color: '#8b949e', fontSize: 12, fontWeight: '500' },
  statDivider: { color: '#1a1f2e', fontSize: 12 },
  lastSeen: { color: '#8b949e', fontSize: 11, marginTop: 6 },

  // Workflow row
  workflowRow: {
    backgroundColor: '#0d1117',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workflowName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  workflowDesc: { color: '#8b949e', fontSize: 12, marginTop: 2, maxWidth: 240 },
  sendBtn: { color: '#00e5ff', fontSize: 14, fontWeight: '700' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#05060a' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  modalClose: { color: '#00e5ff', fontSize: 15, fontWeight: '600' },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  modalBody: { flex: 1 },

  // Select all
  selectAllBtn: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  selectAllText: { color: '#00e5ff', fontSize: 14, fontWeight: '600' },

  // Device selection row
  deviceSelectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  deviceSelectRowActive: { backgroundColor: 'rgba(0, 229, 255, 0.05)' },
  deviceSelectName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  deviceSelectEmail: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1a1f2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#00e5ff', borderColor: '#00e5ff' },
  checkmark: { color: '#05060a', fontSize: 14, fontWeight: '800' },

  // Create form
  inputLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 10,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
  },
  inputMulti: { height: 80, textAlignVertical: 'top' },
  platformToggle: {
    flexDirection: 'row',
    backgroundColor: '#0d1117',
    borderRadius: 10,
    padding: 3,
  },
  platformOpt: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  platformOptActive: { backgroundColor: '#161b22' },
  platformOptText: { color: '#8b949e', fontSize: 14, fontWeight: '600' },
  platformOptTextActive: { color: '#00e5ff' },
});
