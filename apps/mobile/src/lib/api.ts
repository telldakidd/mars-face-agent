import { getToken } from './auth';
import type {
  DashMetric,
  AgentActivity,
  Trade,
  Message,
  Client,
  Workflow,
  WorkflowAssignment,
  DeviceWithStats,
} from '../types';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

// ---------- Core fetch wrapper ----------

async function fetchWithAuth(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res;
}

// ---------- Portfolio ----------

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

export async function getPortfolio(clientId: string): Promise<DashMetric[]> {
  try {
    const res = await fetchWithAuth(`/api/clients/${clientId}/metrics`);
    return res.json();
  } catch {
    return MOCK_METRICS;
  }
}

// ---------- Activity ----------

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
    description: 'Gold approaching resistance at $2,330',
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
];

export async function getActivity(
  clientId: string
): Promise<AgentActivity[]> {
  try {
    const res = await fetchWithAuth(
      `/api/agent/activity/${clientId}`
    );
    return res.json();
  } catch {
    return MOCK_ACTIVITY;
  }
}

// ---------- Chat ----------

export async function sendMessage(
  clientId: string,
  content: string
): Promise<Message> {
  try {
    const res = await fetchWithAuth('/api/agent/log', {
      method: 'POST',
      body: JSON.stringify({ clientId, content }),
    });
    return res.json();
  } catch {
    // Return a mock agent response
    return {
      id: Date.now().toString(),
      role: 'agent',
      content:
        "I've noted your message. Let me check the latest data and get back to you.",
      timestamp: new Date().toISOString(),
    };
  }
}

// ---------- Trades ----------

const MOCK_TRADES: Trade[] = [
  {
    id: 'tr-1',
    platform: 'mt5',
    symbol: 'XAUUSD',
    side: 'long',
    size: 0.5,
    entryPrice: 2312.4,
    currentPrice: 2324.8,
    pnl: 620.0,
    openedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'open',
  },
  {
    id: 'tr-2',
    platform: 'polymarket',
    symbol: 'Fed Rate Hold June 2026',
    side: 'long',
    size: 500,
    entryPrice: 0.62,
    currentPrice: 0.78,
    pnl: 80.0,
    openedAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'open',
  },
  {
    id: 'tr-3',
    platform: 'mt5',
    symbol: 'XAUUSD',
    side: 'short',
    size: 0.3,
    entryPrice: 2298.1,
    currentPrice: 2285.3,
    pnl: 127.3,
    openedAt: new Date(Date.now() - 259200000).toISOString(),
    closedAt: new Date(Date.now() - 172800000).toISOString(),
    status: 'closed',
  },
];

export async function getTradeHistory(clientId: string): Promise<Trade[]> {
  try {
    const res = await fetchWithAuth(
      `/api/clients/${clientId}/trades`
    );
    return res.json();
  } catch {
    return MOCK_TRADES;
  }
}

// ---------- Client ----------

export async function getClient(clientId: string): Promise<Client> {
  const res = await fetchWithAuth(`/api/clients/${clientId}`);
  return res.json();
}

// ---------- Workflows ----------

export async function getWorkflows(platform?: 'make' | 'n8n'): Promise<Workflow[]> {
  const qs = platform ? `?platform=${platform}` : '';
  try {
    const res = await fetchWithAuth(`/api/workflows${qs}`);
    return res.json();
  } catch {
    return [];
  }
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  try {
    const res = await fetchWithAuth(`/api/workflows/${id}`);
    return res.json();
  } catch {
    return null;
  }
}

export async function getAssignedWorkflows(clientId: string): Promise<WorkflowAssignment[]> {
  try {
    const res = await fetchWithAuth(`/api/workflows/assigned/${clientId}`);
    return res.json();
  } catch {
    return [];
  }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: string
): Promise<void> {
  await fetchWithAuth(`/api/workflows/assignment/${assignmentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function assignWorkflow(
  workflowId: string,
  clientIds: string[],
  notes?: string
): Promise<void> {
  await fetchWithAuth('/api/workflows/assign', {
    method: 'POST',
    body: JSON.stringify({ workflowId, clientIds, notes }),
  });
}

export async function createWorkflow(workflow: {
  title: string;
  description?: string;
  platform: 'make' | 'n8n';
  workflowJson?: Record<string, unknown>;
  guideTitle?: string;
  guideSteps?: { step: number; text: string; imageUrl?: string }[];
  tags?: string[];
}): Promise<Workflow> {
  const res = await fetchWithAuth('/api/workflows', {
    method: 'POST',
    body: JSON.stringify(workflow),
  });
  return res.json();
}

export async function getAdminDevices(): Promise<DeviceWithStats[]> {
  try {
    const res = await fetchWithAuth('/api/workflows/admin/devices');
    return res.json();
  } catch {
    return [];
  }
}
