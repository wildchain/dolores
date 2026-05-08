"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiClient, type ChallengeCacheData } from "@/lib/api";

interface PendingChallengesContextValue {
  /** All unresolved challenges filed by the connected wallet */
  pendingChallenges: ChallengeCacheData[];
  /** True if the connected wallet has an unresolved challenge for this taskId */
  hasPendingChallenge: (taskId: string) => boolean;
  /** Returns the challenge data for this taskId, if one exists */
  getChallengeForTask: (taskId: string) => ChallengeCacheData | undefined;
  /** Re-fetch — call after successfully filing a challenge */
  refresh: () => void;
  loading: boolean;
}

const PendingChallengesContext = createContext<
  PendingChallengesContextValue | undefined
>(undefined);

export function PendingChallengesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { publicKey } = useWallet();
  const [challenges, setChallenges] = useState<ChallengeCacheData[]>([]);
  const [byTaskId, setByTaskId] = useState<Map<string, ChallengeCacheData>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!publicKey) {
      setChallenges([]);
      setByTaskId(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiClient.challenges
      .getChallenges({
        requester: publicKey.toBase58(),
        unresolved: true,
        limit: 100,
      })
      .then(res => {
        if (cancelled) return;
        const list = res.data;
        setChallenges(list);
        setByTaskId(new Map(list.map(c => [c.taskId, c])));
      })
      .catch(() => {
        if (cancelled) return;
        setChallenges([]);
        setByTaskId(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, tick]);

  const hasPendingChallenge = useCallback(
    (taskId: string) => byTaskId.has(taskId),
    [byTaskId],
  );

  const getChallengeForTask = useCallback(
    (taskId: string) => byTaskId.get(taskId),
    [byTaskId],
  );

  return (
    <PendingChallengesContext.Provider
      value={{
        pendingChallenges: challenges,
        hasPendingChallenge,
        getChallengeForTask,
        refresh,
        loading,
      }}
    >
      {children}
    </PendingChallengesContext.Provider>
  );
}

export function usePendingChallenges(): PendingChallengesContextValue {
  const ctx = useContext(PendingChallengesContext);
  if (!ctx) {
    throw new Error(
      "usePendingChallenges must be used inside PendingChallengesProvider",
    );
  }
  return ctx;
}
