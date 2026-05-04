import { createHelia } from "helia";
import { json } from "@helia/json";
import { FsBlockstore } from "blockstore-fs";
import { CID } from "multiformats/cid";
import Fastify from "fastify";

const dataDir = process.env.IPFS_DATA_DIR ?? "./data/ipfs";
const port = Number(process.env.IPFS_PORT ?? 3002);

const blockstore = new FsBlockstore(dataDir);
const helia = await createHelia({ blockstore });
const j = json(helia);

const app = Fastify({ logger: true });

app.get("/", async (_request, _reply) => {
  return { name: "dolores-ipfs" };
});

app.post("/pin", async (request, _reply) => {
  const { manifest } = request.body as { manifest: Record<string, unknown> };
  const cid = await j.add(manifest);
  return { cid: cid.toString() };
});

app.get("/get/:cid", async (request, reply) => {
  const { cid: cidStr } = request.params as { cid: string };
  try {
    const cid = CID.parse(cidStr);
    const data = await j.get(cid);
    return data;
  } catch {
    reply.code(404).send({ error: "CID not found" });
  }
});

const close = async () => {
  await app.close();
  await helia.stop();
  process.exit(0);
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

await app.listen({ port, host: "0.0.0.0" });
console.log(`IPFS node ready on :${port}`);
