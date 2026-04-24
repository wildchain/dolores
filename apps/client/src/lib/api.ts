/**
 * API Client for Dolores Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("dolores_auth_token")
      : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || `API Error: ${response.status}`,
      response.status,
      errorData,
    );
  }

  return response.json();
}

// ============================================================================
// Auth API
// ============================================================================

export interface ChallengeResponse {
  message: string;
  nonce: string;
}

export interface VerifyRequest {
  wallet: string;
  message: string;
  signature: string;
}

export interface VerifyResponse {
  token: string;
  wallet: string;
  expiresAt: string;
}

export const authApi = {
  /**
   * Get authentication challenge for a wallet
   */
  getChallenge: async (wallet: string): Promise<ChallengeResponse> => {
    return apiRequest(`/auth/challenge/${wallet}`);
  },

  /**
   * Verify signature and get JWT token
   */
  verifySignature: async (data: VerifyRequest): Promise<VerifyResponse> => {
    return apiRequest("/auth/verify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// Agents API
// ============================================================================

export const agentsApi = {
  /**
   * Get paginated list of agents
   */
  getAgents: async (params?: { limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    return apiRequest(`/agents?${query}`);
  },

  /**
   * Get agent details
   */
  getAgentDetails: async (agentId: string) => {
    return apiRequest(`/agents/${agentId}`);
  },

  /**
   * Get agent's tasks
   */
  getAgentTasks: async (
    agentId: string,
    params?: { limit?: number; offset?: number },
  ) => {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    return apiRequest(`/agents/${agentId}/tasks?${query}`);
  },
};

// ============================================================================
// Tasks API
// ============================================================================

export const tasksApi = {
  /**
   * Get filtered tasks
   */
  getTasks: async (params?: {
    agentId?: string;
    requester?: string;
    status?: string;
    capabilityName?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.agentId) query.set("agentId", params.agentId);
    if (params?.requester) query.set("requester", params.requester);
    if (params?.status) query.set("status", params.status);
    if (params?.capabilityName)
      query.set("capabilityName", params.capabilityName);
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    return apiRequest(`/tasks?${query}`);
  },

  /**
   * Get task details
   */
  getTaskDetails: async (taskId: string) => {
    return apiRequest(`/tasks/${taskId}`);
  },

  /**
   * Build unsigned transaction for registering a task (requires auth)
   */
  buildRegisterTask: async (data: {
    agentId: string;
    capabilityName: string;
    parameters: Record<string, any>;
    stakeAmount: number;
  }) => {
    return apiRequest("/tasks/build-register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ============================================================================
// Challenges API
// ============================================================================

export const challengesApi = {
  /**
   * Get challenge details
   */
  getChallengeDetails: async (challengeId: string) => {
    return apiRequest(`/challenges/${challengeId}`);
  },

  /**
   * Build unsigned transaction for filing a challenge (requires auth)
   */
  buildFileChallenge: async (data: { taskId: string; receiptUrl: string }) => {
    return apiRequest("/challenges/build-file", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Build unsigned transaction for auto-adjudication (requires auth)
   */
  buildAutoAdjudicate: async (data: {
    challengeId: string;
    approved: boolean;
  }) => {
    return apiRequest("/challenges/build-auto-adjudicate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
