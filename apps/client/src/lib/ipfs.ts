const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function pinManifest(
  manifest: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/ipfs/pin-manifest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`IPFS pin failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { cid: string };
  return data.cid;
}
