"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { authApi } from "@/lib/api";
import bs58 from "bs58";

interface AuthContextValue {
  /** JWT token */
  token: string | null;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether authentication is in progress */
  isAuthenticating: boolean;
  /** Authentication error if any */
  error: string | null;
  /** Trigger authentication flow */
  authenticate: () => Promise<void>;
  /** Clear authentication state */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { publicKey, signMessage, connected } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load token from localStorage on mount
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("dolores_auth_token");
      if (storedToken) {
        setToken(storedToken);
      }
    }
  }, []);

  /**
   * Authenticate with the API
   */
  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected");
      return;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const walletAddress = publicKey.toBase58();

      // Step 1: Get challenge from API
      const { message, nonce } = await authApi.getChallenge(walletAddress);

      console.log("🔐 Challenge received:", { message, nonce });

      // Step 2: Sign the message with the wallet
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      console.log("✍️ Message signed");

      // Step 3: Verify signature and get JWT token
      const response = await authApi.verifySignature({
        wallet: walletAddress,
        message,
        signature: signatureBase58,
      });

      console.log("✅ Authentication successful");

      // Step 4: Store token
      if (typeof window !== "undefined") {
        localStorage.setItem("dolores_auth_token", response.token);
      }
      setToken(response.token);
      setError(null);
    } catch (err) {
      console.error("❌ Authentication failed:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("dolores_auth_token");
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, signMessage]);

  /**
   * Logout and clear token
   */
  const logout = useCallback(() => {
    setToken(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("dolores_auth_token");
    }
    setError(null);
  }, []);

  /**
   * Auto-logout when wallet disconnects
   */
  useEffect(() => {
    if (!connected) {
      logout();
    }
  }, [connected, logout]);

  const value: AuthContextValue = {
    token,
    isAuthenticated: !!token,
    isAuthenticating,
    error,
    authenticate,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
