export type Platform = 'mt5' | 'polymarket' | 'tradingview';

export type RiskTier = 'conservative' | 'moderate' | 'aggressive';

export interface Client {
  id: string;
  name: string;
  email: string;
  riskTier: RiskTier;
  platforms: Platform[];
  createdAt: string;
}

export interface DashMetric {
  id: string;
  label: string;
  value: string;
  change?: number;
  platform: Platform | 'all';
  updatedAt: string;
}

export interface AgentActivity {
  id: string;
  type: 'trade' | 'alert' | 'risk';
  description: string;
  confidence: number;
  platform: Platform | 'all';
  timestamp: string;
}

export interface Task {
  id: string;
  clientId: string;
  type: 'trade' | 'rebalance' | 'scan' | 'escalate';
  status: 'pending' | 'running' | 'done' | 'failed';
  payload: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
}

export interface Trade {
  id: string;
  platform: Platform;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  openedAt: string;
  closedAt?: string;
  status: 'open' | 'closed';
}

export interface Conversation {
  id: string;
  clientId: string;
  messages: Message[];
  startedAt: string;
  endedAt?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  imageUri?: string;
}

// ── Workflows ──────────────────────────────────────────────────────────────

export type WorkflowPlatform = 'make' | 'n8n';

export type WorkflowAssignmentStatus =
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'setup_complete'
  | 'error';

export interface GuideStep {
  step: number;
  text: string;
  imageUrl?: string;
}

export interface Workflow {
  id: string;
  title: string;
  description?: string;
  platform: WorkflowPlatform;
  workflow_json?: Record<string, unknown>;
  guide_title?: string;
  guide_steps: GuideStep[];
  tags: string[];
  version: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkflowAssignment {
  id: string;
  status: WorkflowAssignmentStatus;
  sent_at: string;
  viewed_at?: string;
  completed_at?: string;
  notes?: string;
  workflows: Workflow;
}

export interface DeviceWithStats {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  is_admin: boolean;
  device: {
    device_id: string;
    app_version?: string;
    last_seen: string;
    is_active: boolean;
  } | null;
  workflowStats: {
    total: number;
    pending: number;
    complete: number;
  };
}
