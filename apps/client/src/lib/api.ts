import type {
  AgentDetailsDto,
  AgentListItemDto,
  AgentTaskDto,
} from "@dolores/shared";
import axios, { AxiosInstance, AxiosResponse } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  expiresAt: number;
}

type TaskFilterParams = {
  agentId?: string;
  requester?: string;
  status?: string;
  capabilityName?: string;
  limit?: number;
  offset?: number;
};

export class ApiClient {
  private readonly client: AxiosInstance;

  constructor(private readonly baseUrl: string = API_BASE_URL) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.request.use(config => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("dolores_auth_token")
          : null;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });
  }

  // Auth endpoints
  auth = {
    getChallenge: (
      wallet: string,
    ): Promise<AxiosResponse<ChallengeResponse>> => {
      return this.client.get<ChallengeResponse>(`/auth/challenge/${wallet}`);
    },

    verifySignature: (
      data: VerifyRequest,
    ): Promise<AxiosResponse<VerifyResponse>> => {
      return this.client.post<VerifyResponse>("/auth/verify", data);
    },
  };

  // Agents endpoints
  agents = {
    getAgents: (params?: {
      limit?: number;
      offset?: number;
    }): Promise<AxiosResponse<AgentListItemDto[]>> => {
      return this.client.get<AgentListItemDto[]>("/agents", {
        params,
      });
    },

    getAgentsByOperator: (
      operatorAddress: string,
    ): Promise<AxiosResponse<AgentListItemDto[]>> => {
      return this.client.get<AgentListItemDto[]>(
        `/agents/operator/${operatorAddress}`,
      );
    },

    getAgentDetails: (
      agentId: string,
    ): Promise<AxiosResponse<AgentDetailsDto>> => {
      return this.client.get<AgentDetailsDto>(`/agents/${agentId}`);
    },

    getAgentTasks: (
      agentId: string,
      params?: { limit?: number; offset?: number },
    ): Promise<AxiosResponse<AgentTaskDto[]>> => {
      return this.client.get<AgentTaskDto[]>(`/agents/${agentId}/tasks`, {
        params,
      });
    },
  };

  // Tasks endpoints
  tasks = {
    getTasks: (
      params?: TaskFilterParams,
    ): Promise<AxiosResponse<unknown[]>> => {
      return this.client.get<unknown[]>("/tasks", {
        params,
      });
    },

    getTaskDetails: (taskId: string): Promise<AxiosResponse<unknown>> => {
      return this.client.get<unknown>(`/tasks/${taskId}`);
    },

    buildRegisterTask: (data: {
      agentId: string;
      capabilityName: string;
      parameters: Record<string, unknown>;
      stakeAmount: number;
    }): Promise<AxiosResponse<unknown>> => {
      return this.client.post<unknown>("/tasks/build-register", data);
    },
  };

  // Challenges endpoints
  challenges = {
    getChallengeDetails: (
      challengeId: string,
    ): Promise<AxiosResponse<unknown>> => {
      return this.client.get<unknown>(`/challenges/${challengeId}`);
    },

    buildFileChallenge: (data: {
      taskId: string;
      receiptUrl: string;
    }): Promise<AxiosResponse<unknown>> => {
      return this.client.post<unknown>("/challenges/build-file", data);
    },

    buildAutoAdjudicate: (data: {
      challengeId: string;
      approved: boolean;
    }): Promise<AxiosResponse<unknown>> => {
      return this.client.post<unknown>(
        "/challenges/build-auto-adjudicate",
        data,
      );
    },
  };
}

export const apiClient = new ApiClient();

// Backwards-compatible named exports
export const authApi = apiClient.auth;
export const agentsApi = apiClient.agents;
export const tasksApi = apiClient.tasks;
export const challengesApi = apiClient.challenges;
