import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Linking,
} from 'react-native';
import type { WorkflowAssignment, WorkflowPlatform, GuideStep } from '@/types';
import { getAssignedWorkflows, updateAssignmentStatus } from '@/lib/api';
import * as SecureStore from 'expo-secure-store';

type Tab = 'make' | 'n8n';

const STATUS_COLORS: Record<string, string> = {
  pending: '#d29922',
  sent: '#00e5ff',
  viewed: '#b388ff',
  setup_complete: '#2ea043',
  error: '#f85149',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  sent: 'Sent',
  viewed: 'Viewed',
  setup_complete: 'Complete',
  error: 'Error',
};

export default function WorkflowsScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('n8n');
  const [assignments, setAssignments] = useState<WorkflowAssignment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [guideModal, setGuideModal] = useState<WorkflowAssignment | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const loadWorkflows = useCallback(async () => {
    const clientId = await SecureStore.getItemAsync('mars_client_id');
    if (!clientId) return;
    const data = await getAssignedWorkflows(clientId);
    setAssignments(data);
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWorkflows();
    setRefreshing(false);
  }, [loadWorkflows]);

  const filtered = assignments.filter(
    (a) => a.workflows?.platform === activeTab
  );

  const openGuide = useCallback(
    async (assignment: WorkflowAssignment) => {
      setGuideModal(assignment);
      setCurrentStep(0);
      // Mark as viewed
      if (assignment.status === 'sent' || assignment.status === 'pending') {
        await updateAssignmentStatus(assignment.id, 'viewed').catch(() => {});
        await loadWorkflows();
      }
    },
    [loadWorkflows]
  );

  const markComplete = useCallback(
    async (assignmentId: string) => {
      await updateAssignmentStatus(assignmentId, 'setup_complete').catch(() => {});
      setGuideModal(null);
      await loadWorkflows();
    },
    [loadWorkflows]
  );

  const guide = guideModal?.workflows?.guide_steps ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Workflows</Text>
        <Text style={styles.headerSub}>
          {filtered.length} workflow{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Platform Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'n8n' && styles.tabActive]}
          onPress={() => setActiveTab('n8n')}
        >
          <Text
            style={[styles.tabText, activeTab === 'n8n' && styles.tabTextActive]}
          >
            n8n
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'make' && styles.tabActive]}
          onPress={() => setActiveTab('make')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'make' && styles.tabTextActive,
            ]}
          >
            Make
          </Text>
        </TouchableOpacity>
      </View>

      {/* Workflow List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00e5ff"
            colors={['#00e5ff']}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>
              {activeTab === 'n8n' ? 'n' : 'M'}
            </Text>
            <Text style={styles.emptyTitle}>No {activeTab.toUpperCase()} Workflows</Text>
            <Text style={styles.emptyText}>
              Workflows sent by your admin will appear here with setup guides.
            </Text>
          </View>
        ) : (
          filtered.map((assignment) => (
            <TouchableOpacity
              key={assignment.id}
              style={styles.card}
              onPress={() => openGuide(assignment)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View
                    style={[
                      styles.platformBadge,
                      {
                        backgroundColor:
                          assignment.workflows.platform === 'n8n'
                            ? 'rgba(0, 229, 255, 0.15)'
                            : 'rgba(179, 136, 255, 0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.platformBadgeText,
                        {
                          color:
                            assignment.workflows.platform === 'n8n'
                              ? '#00e5ff'
                              : '#b388ff',
                        },
                      ]}
                    >
                      {assignment.workflows.platform.toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[assignment.status] ?? '#8b949e' },
                    ]}
                  />
                </View>
                <Text style={styles.cardTitle}>{assignment.workflows.title}</Text>
                {assignment.workflows.description && (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {assignment.workflows.description}
                  </Text>
                )}
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.cardStatus}>
                  {STATUS_LABELS[assignment.status] ?? assignment.status}
                </Text>
                <View style={styles.cardMeta}>
                  {assignment.workflows.tags?.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {assignment.workflows.guide_steps?.length > 0 && (
                <View style={styles.guideHint}>
                  <Text style={styles.guideHintText}>
                    {assignment.workflows.guide_steps.length}-step setup guide included
                  </Text>
                  <Text style={styles.guideArrow}>→</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Guide Modal */}
      <Modal
        visible={guideModal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGuideModal(null)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setGuideModal(null)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {guideModal?.workflows?.guide_title ?? guideModal?.workflows?.title ?? 'Setup Guide'}
            </Text>
            <Text style={styles.modalStep}>
              {guide.length > 0
                ? `${currentStep + 1} / ${guide.length}`
                : ''}
            </Text>
          </View>

          {/* Guide Content */}
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
          >
            {guide.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Guide Available</Text>
                <Text style={styles.emptyText}>
                  This workflow doesn't have a setup guide yet. Contact your
                  admin for instructions.
                </Text>
              </View>
            ) : (
              <>
                {/* Progress bar */}
                <View style={styles.progressBar}>
                  {guide.map((_: GuideStep, i: number) => (
                    <View
                      key={i}
                      style={[
                        styles.progressSegment,
                        i <= currentStep && styles.progressSegmentActive,
                      ]}
                    />
                  ))}
                </View>

                {/* Current Step */}
                <View style={styles.stepContainer}>
                  <Text style={styles.stepNumber}>
                    Step {guide[currentStep]?.step ?? currentStep + 1}
                  </Text>
                  <Text style={styles.stepText}>
                    {guide[currentStep]?.text ?? ''}
                  </Text>
                </View>

                {/* Navigation */}
                <View style={styles.stepNav}>
                  <TouchableOpacity
                    style={[
                      styles.stepButton,
                      currentStep === 0 && styles.stepButtonDisabled,
                    ]}
                    onPress={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                  >
                    <Text style={styles.stepButtonText}>Previous</Text>
                  </TouchableOpacity>

                  {currentStep < guide.length - 1 ? (
                    <TouchableOpacity
                      style={[styles.stepButton, styles.stepButtonPrimary]}
                      onPress={() => setCurrentStep(currentStep + 1)}
                    >
                      <Text style={styles.stepButtonTextPrimary}>Next</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.stepButton, styles.stepButtonSuccess]}
                      onPress={() =>
                        guideModal && markComplete(guideModal.id)
                      }
                    >
                      <Text style={styles.stepButtonTextPrimary}>
                        Mark Complete
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* Workflow JSON preview hint */}
            {guideModal?.workflows?.workflow_json && (
              <View style={styles.jsonHint}>
                <Text style={styles.jsonHintText}>
                  Workflow JSON is included and ready to import into{' '}
                  {guideModal.workflows.platform.toUpperCase()}.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060a' },
  header: { paddingHorizontal: 16, paddingTop: 60, marginBottom: 16 },
  headerTitle: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  headerSub: { color: '#8b949e', fontSize: 14, marginTop: 2 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#0d1117',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#161b22' },
  tabText: { color: '#8b949e', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#00e5ff' },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1a1f2e',
    marginBottom: 16,
  },
  emptyTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: '#8b949e', fontSize: 14, textAlign: 'center', maxWidth: 260 },

  // Workflow card
  card: {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { marginBottom: 12 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  platformBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  platformBadgeText: { fontSize: 11, fontWeight: '700' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  cardDesc: { color: '#8b949e', fontSize: 13, marginTop: 4, lineHeight: 18 },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardStatus: { color: '#8b949e', fontSize: 12, fontWeight: '500' },
  cardMeta: { flexDirection: 'row', gap: 6 },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { color: '#8b949e', fontSize: 11 },

  guideHint: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  guideHintText: { color: '#00e5ff', fontSize: 12, fontWeight: '500' },
  guideArrow: { color: '#00e5ff', fontSize: 14 },

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
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  modalStep: { color: '#8b949e', fontSize: 13 },

  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20 },

  // Progress bar
  progressBar: { flexDirection: 'row', gap: 4, marginBottom: 32 },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: '#1a1f2e',
    borderRadius: 2,
  },
  progressSegmentActive: { backgroundColor: '#00e5ff' },

  // Step
  stepContainer: { marginBottom: 40 },
  stepNumber: {
    color: '#00e5ff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  stepText: { color: '#ffffff', fontSize: 17, lineHeight: 26 },

  // Step navigation
  stepNav: { flexDirection: 'row', gap: 12 },
  stepButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#1a1f2e',
  },
  stepButtonDisabled: { opacity: 0.4 },
  stepButtonPrimary: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00e5ff',
  },
  stepButtonSuccess: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
    borderColor: '#2ea043',
  },
  stepButtonText: { color: '#8b949e', fontSize: 14, fontWeight: '600' },
  stepButtonTextPrimary: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  // JSON hint
  jsonHint: {
    marginTop: 32,
    backgroundColor: '#0d1117',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1a1f2e',
  },
  jsonHintText: { color: '#8b949e', fontSize: 13, lineHeight: 18 },
});
