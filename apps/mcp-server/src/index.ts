#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";



//  Config 

const API_URL = process.env.DOLORES_API_URL || "https://lively-dream-production-bf53.up.railway.app";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";



const OPERATOR_KEY_PATH = process.env.DOLORES_OPERATOR_KEY ||
  path.join(os.homedir(), ".config", "solana", "id.json");
const DOLORES_DIR = path.join(os.homedir(), ".dolores", "agents");

const DOLORES_WALLET_PATH = process.env.DOLORES_OPERATOR_KEY ||
  path.join(os.homedir(), ".dolores", "wallet.json");
function getOrCreateWallet(): Keypair {
  // Use existing wallet if found
  if (fs.existsSync(DOLORES_WALLET_PATH)) {
    const raw = JSON.parse(fs.readFileSync(DOLORES_WALLET_PATH, "utf-8"));
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }

  // Create new wallet
  const keypair = Keypair.generate();
  fs.mkdirSync(path.dirname(DOLORES_WALLET_PATH), { recursive: true });
  fs.writeFileSync(
    DOLORES_WALLET_PATH,
    JSON.stringify(Array.from(keypair.secretKey))
  );
  return keypair;
}

const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";
const ADJ_PROGRAM_ID = "8gm7LX32iTGMst7sutoWDmyrzDLYu3FHp3Hcv3HvVJ8A";

//  Helpers 

function loadKeypair(keyPath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

async function apiFetch(endpoint: string, method = "GET", body?: any) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

//  MCP Server 

const server = new Server(
  { name: "dolores-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);



//  Tool Definitions 

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "dolores_setup",
      description: "Check your Dolores wallet setup. Run this first to get your wallet address and check your SOL balance. Creates a new wallet automatically if you don't have one.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "dolores_find_agents",
      description: "Find Dolores agents available for hire on the marketplace. Only shows agents listed for hire. To see YOUR own agents use dolores_my_agents instead.",
      inputSchema: {
        type: "object",
        properties: {
          template: {
            type: "string",
            description: "Filter by capability template: SOL_TRANSFER, JUPITER_TRADER, RAYDIUM_LP, METEORA_POOLS, KAMINO_LENDING, PYTH_ORACLE_READER, PUMPFUN_TRADER",
          },
          limit: {
            type: "number",
            description: "Max number of agents to return (default 3)",
          },
        },
      },
    },
    {
      name: "dolores_hire_agent",
      description: "Hire a Dolores agent by paying the hire fee. This deposits SOL into the agent's reward pool and makes them work for you.",
      inputSchema: {
        type: "object",
        required: ["agentId", "operatorId"],
        properties: {
          agentId: { type: "string", description: "Agent public key" },
          operatorId: { type: "string", description: "Operator public key (agent owner)" },
        },
      },
    },
    {
      name: "dolores_assign_task",
      description: "Assign a task/instruction to a Dolores agent. The agent will autonomously execute it on-chain and return a signed receipt.",
      inputSchema: {
        type: "object",
        required: ["agentId", "instruction"],
        properties: {
          agentId: { type: "string", description: "Agent public key to assign the task to" },
          instruction: { type: "string", description: "Natural language instruction for the agent e.g. 'buy 0.001 SOL of token XYZ' or 'swap 0.01 SOL to USDC'" },
          deadlineMinutes: { type: "number", description: "Task deadline in minutes (default 10)" },
        },
      },
    },
    {
      name: "dolores_task_status",
      description: "Check the status of a previously assigned task.",
      inputSchema: {
        type: "object",
        required: ["taskId"],
        properties: {
          taskId: { type: "string", description: "Task ID returned by dolores_assign_task" },
        },
      },
    },
    {
      name: "dolores_agent_info",
      description: "Get detailed info about a specific Dolores agent including reputation, stake, completed tasks and capability template.",
      inputSchema: {
        type: "object",
        required: ["agentId"],
        properties: {
          agentId: { type: "string", description: "Agent public key" },
        },
      },
    },
    {
      name: "dolores_my_agents",
      description: "List all Dolores agents owned by the current operator wallet. Shows all registered agents regardless of marketplace availability.",
      inputSchema: {
        type: "object",
        properties: {
          operatorId: {
            type: "string",
            description: "Operator wallet public key. If not provided, uses the configured operator key.",
          },
        },
      },
    },
    {
      name: "dolores_new_memecoins",
      description: "Fetch newly launched memecoins on PumpFun from DexScreener live data. Returns real-time token info including price, market cap, volume, and contract address.",
      inputSchema: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max number of tokens to return (default 10)",
          },
        },
      },
    },

    {
      name: "dolores_register_agent",
      description: "Create and register a new Dolores AI agent on Solana. Generates a keypair, registers on-chain, and initializes the staking fund. The agent will be ready to accept tasks.",
      inputSchema: {
        type: "object",
        required: ["template"],
        properties: {
          template: {
            type: "string",
            description: "Agent capability template: SOL_TRANSFER, JUPITER_TRADER, RAYDIUM_LP, METEORA_POOLS, KAMINO_LENDING, PYTH_ORACLE_READER, PUMPFUN_TRADER",
          },
          name: {
            type: "string",
            description: "Human-readable name for the agent (optional)",
          },
        },
      },
    },
    {
      name: "dolores_stake_agent",
      description: "Stake SOL on your Dolores agent to increase its reputation and accountability. Higher stake = more trust from the community.",
      inputSchema: {
        type: "object",
        required: ["agentId", "amountSol"],
        properties: {
          agentId: { type: "string", description: "Agent public key" },
          amountSol: { type: "number", description: "Amount of SOL to stake (minimum 0.01)" },
        },
      },
    },
    {
      name: "dolores_list_agent_for_hire",
      description: "List your Dolores agent on the marketplace so others can hire it. Set a hire fee in SOL.",
      inputSchema: {
        type: "object",
        required: ["agentId"],
        properties: {
          agentId: { type: "string", description: "Agent public key" },
          hireFeeSOL: { type: "number", description: "Fee in SOL to hire this agent (default 0.01)" },
        },
      },
    },
  ],
}));

// Tool Handlers 

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "dolores_setup": {
        const isNew = !fs.existsSync(DOLORES_WALLET_PATH);
        const keypair = getOrCreateWallet();
        const pubkey = keypair.publicKey.toBase58();

        const connection = new Connection(RPC_URL, "confirmed");
        let balance = 0;
        try {
          balance = await connection.getBalance(keypair.publicKey);
        } catch { }

        const balanceSOL = (balance / 1e9).toFixed(4);
        const needsFunding = balance < 10_000_000; // less than 0.01 SOL

        if (isNew) {
          return {
            content: [{
              type: "text",
              text: `🎉 **New Dolores wallet created!**\n\nWallet address: \`${pubkey}\`\nBalance: ${balanceSOL} SOL\nSaved to: \`${DOLORES_WALLET_PATH}\`\n\n⚠️ **You need SOL to use Dolores agents.**\n\nFund your wallet:\n- Devnet (free): \`solana airdrop 1 ${pubkey} --url devnet\`\n- Mainnet: send SOL to \`${pubkey}\`\n\nOnce funded, you can find and hire agents with \`dolores_find_agents\`.`,
            }],
          };
        }

        if (needsFunding) {
          return {
            content: [{
              type: "text",
              text: `⚠️ **Low balance**\n\nWallet: \`${pubkey}\`\nBalance: ${balanceSOL} SOL\n\nYou need more SOL to use Dolores agents.\n- Devnet: \`solana airdrop 1 ${pubkey} --url devnet\`\n- Mainnet: send SOL to \`${pubkey}\``,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: `✅ **Dolores wallet ready**\n\nWallet: \`${pubkey}\`\nBalance: ${balanceSOL} SOL\n\nYou're all set! Try \`dolores_find_agents\` to browse the marketplace.`,
          }],
        };
      }

      case "dolores_find_agents": {
        const limit = (args?.limit as number) ?? 3;
        const agents = await apiFetch(`/agents/marketplace?limit=${limit}`) as any[];

        if (!agents || agents.length === 0) {
          return {
            content: [{ type: "text", text: "No agents currently available for hire on the Dolores marketplace." }],
          };
        }

        // Filter by template if specified
        let filtered = agents;
        if (args?.template) {
          filtered = agents.filter((a: any) =>
            a.capabilityTemplate === args.template
          );
          if (filtered.length === 0) filtered = agents;
        }

        const summary = filtered.slice(0, limit).map((a: any, i: number) => {
          const successRate = a.trustBadge?.successRate ?? 0;
          const stake = (a.stakeAmount / LAMPORTS_PER_SOL).toFixed(3);
          const hireFee = a.hireFeeSOL ?? 0.01;
          return `**Agent ${i + 1}: ${a.agentId.slice(0, 8)}...**
- Reputation: ${a.reputationScore}/100
- Success rate: ${successRate.toFixed(1)}%
- Stake: ${stake} SOL
- Hire fee: ${hireFee} SOL
- Completed tasks: ${a.trustBadge?.completedTasks ?? 0}
- Agent ID: \`${a.agentId}\`
- Operator: \`${a.operator}\``;
        }).join("\n\n");

        return {
          content: [{ type: "text", text: `Found ${filtered.length} agents available for hire:\n\n${summary}` }],
        };
      }

      case "dolores_hire_agent": {
        const { agentId, operatorId } = args as { agentId: string; operatorId: string };

        // Build the hire tx
        const txData = await apiFetch(`/agents/${agentId}/build-hire-tx`, "POST", {
          payerWallet: getOrCreateWallet().publicKey.toBase58(),
          operatorId,
        }) as any;

        if (txData.statusCode === 500 || txData.error) {
          throw new Error(txData.message ?? "Failed to build hire transaction");
        }

        // Sign and send
        const operatorKeypair = getOrCreateWallet();
        const connection = new Connection(RPC_URL, "confirmed");
        const { VersionedTransaction, Transaction } = await import("@solana/web3.js");

        const txBuf = Buffer.from(txData.transaction, "base64");
        const tx = Transaction.from(txBuf);
        tx.sign(operatorKeypair);

        const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
        await connection.confirmTransaction(sig, "confirmed");

        return {
          content: [{
            type: "text",
            text: `✅ Agent hired successfully!\n\nAgent: \`${agentId.slice(0, 8)}...\`\nHire fee paid. TX: \`${sig}\`\n\nYou can now assign tasks to this agent using \`dolores_assign_task\`.`,
          }],
        };
      }

      case "dolores_assign_task": {
        const { agentId, instruction, deadlineMinutes } = args as {
          agentId: string;
          instruction: string;
          deadlineMinutes?: number;
        };

        const keypair = getOrCreateWallet();
        const connection = new Connection(RPC_URL, "confirmed");
        const crypto = require("crypto");

        const taskId = crypto.createHash("sha256")
          .update(`${agentId}${instruction}${Date.now()}`)
          .digest("hex");

        const deadline = Math.floor(Date.now() / 1000) + ((deadlineMinutes ?? 10) * 60);

        // Step 1 — build unsigned register_task tx
        const txData = await apiFetch("/tasks/build-register", "POST", {
          agentId,
          taskId,
          capabilityName: instruction,
          parametersJson: JSON.stringify({ instruction }),
          wallet: keypair.publicKey.toBase58(),
        }) as any;

        if (!txData.transaction) {
          throw new Error(`Failed to build register tx: ${txData.message ?? JSON.stringify(txData)}`);
        }

        // Step 2 — sign and submit
        const { Transaction } = await import("@solana/web3.js");
        const txBuf = Buffer.from(txData.transaction, "base64");
        const tx = Transaction.from(txBuf);
        tx.sign(keypair);

        const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
        await connection.confirmTransaction(sig, "confirmed");

        // Step 3 — seed in API cache
        await apiFetch("/tasks", "POST", {
          taskId,
          agentId,
          assignedBy: keypair.publicKey.toBase58(),
          instruction,
          deadline,
          onChainCreatedAt: Math.floor(Date.now() / 1000),
        });

        return {
          content: [{
            type: "text",
            text: `✅ Task assigned and registered on-chain!\n\nTask ID: \`${taskId}\`\nAgent: \`${agentId.slice(0, 8)}...\`\nInstruction: "${instruction}"\nTX: \`${sig}\`\n\nThe agent will pick this up within seconds. Use \`dolores_task_status\` to check progress.`,
          }],
        };
      }

      case "dolores_task_status": {
        const { taskId } = args as { taskId: string };
        const task = await apiFetch(`/tasks/${taskId}`) as any;

        if (task.statusCode === 404) {
          return {
            content: [{ type: "text", text: `Task \`${taskId.slice(0, 16)}...\` not found.` }],
          };
        }

        const statusEmoji: Record<string, string> = {
          pending: "⏳",
          completed: "✅",
          failed: "❌",
          disputed: "⚠️",
        };

        const emoji = statusEmoji[task.status] ?? "❓";

        return {
          content: [{
            type: "text",
            text: `${emoji} Task Status: **${task.status.toUpperCase()}**\n\nTask ID: \`${taskId.slice(0, 16)}...\`\nAgent: \`${task.agentId?.slice(0, 8)}...\`\nInstruction: "${task.capabilityName}"\nCreated: ${new Date(task.createdAt * 1000).toISOString()}`,
          }],
        };
      }

      case "dolores_agent_info": {
        const { agentId } = args as { agentId: string };
        const agent = await apiFetch(`/agents/${agentId}`) as any;

        if (agent.statusCode === 404) {
          return {
            content: [{ type: "text", text: `Agent \`${agentId}\` not found in Dolores registry.` }],
          };
        }

        const stake = (agent.declaredStake / LAMPORTS_PER_SOL).toFixed(4);
        const successRate = agent.trustBadge?.successRate ?? 0;

        return {
          content: [{
            type: "text",
            text: `**Dolores Agent Info**\n\nAgent ID: \`${agentId}\`\nOperator: \`${agent.operator}\`\nReputation: ${agent.reputationScore}/100\nStake: ${stake} SOL\nSuccess rate: ${successRate.toFixed(1)}%\nCompleted tasks: ${agent.trustBadge?.completedTasks ?? 0}\nSlash count: ${agent.slashCount}\nAvailable for hire: ${agent.availableForHire ? "✅ Yes" : "❌ No"}\nHire fee: ${agent.hireFeeSOL ?? 0.01} SOL`,
          }],
        };
      }

      case "dolores_my_agents": {
        const operatorKeypair = getOrCreateWallet();
        const operatorId = (args?.operatorId as string) ?? operatorKeypair.publicKey.toBase58();

        const allAgents = await apiFetch(`/agents?limit=100`) as any[];

        const myAgents = allAgents.filter((a: any) =>
          a.operator === operatorId
        );

        if (myAgents.length === 0) {
          return {
            content: [{ type: "text", text: `No agents found for operator ${operatorId.slice(0, 8)}...` }],
          };
        }

        const summary = myAgents.map((a: any, i: number) => {
          const stake = (a.stakeAmount / LAMPORTS_PER_SOL).toFixed(4);
          return `**Agent ${i + 1}: ${a.agentId.slice(0, 8)}...**
          - Agent ID: \`${a.agentId}\`
          - Reputation: ${a.reputationScore}/100
          - Stake: ${stake} SOL
          - Available for hire: ${a.availableForHire ? "✅ Yes" : "❌ No"}
          - Completed tasks: ${a.trustBadge?.completedTasks ?? 0}`;
        }).join("\n\n");

        return {
          content: [{
            type: "text",
            text: `Found ${myAgents.length} agent(s) for your wallet:\n\n${summary}`,
          }],
        };
      }

      case "dolores_new_memecoins": {
        const limit = (args?.limit as number) ?? 10;

        const [profilesRes, boostsRes] = await Promise.all([
          fetch("https://api.dexscreener.com/token-profiles/latest/v1"),
          fetch("https://api.dexscreener.com/token-boosts/latest/v1"),
        ]);

        const profiles = await profilesRes.json() as any[];
        const boosts = await boostsRes.json() as any[];

        // Merge and deduplicate by tokenAddress, Solana only
        const seen = new Set<string>();
        const tokens: any[] = [];
        for (const t of [...profiles, ...boosts]) {
          if (t.chainId === "solana" && !seen.has(t.tokenAddress)) {
            seen.add(t.tokenAddress);
            tokens.push(t);
          }
        }

        // Fetch pair data for pricing/market cap
        const addresses = tokens.slice(0, limit).map((t: any) => t.tokenAddress).join(",");
        const pairsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
        const pairsData = await pairsRes.json() as any;
        const pairs: any[] = pairsData.pairs ?? [];

        // Group best pair per token (highest liquidity)
        const bestPair: Record<string, any> = {};
        for (const p of pairs) {
          const addr = p.baseToken?.address;
          if (!addr) continue;
          if (!bestPair[addr] || (p.liquidity?.usd ?? 0) > (bestPair[addr].liquidity?.usd ?? 0)) {
            bestPair[addr] = p;
          }
        }

        const results = tokens.slice(0, limit).map((t: any, i: number) => {
          const p = bestPair[t.tokenAddress];
          const name = p?.baseToken?.name ?? t.description?.split(" ")[0] ?? "Unknown";
          const symbol = p?.baseToken?.symbol ?? "?";
          const price = p?.priceUsd ? `$${parseFloat(p.priceUsd).toFixed(8)}` : "N/A";
          const mcap = p?.marketCap ? `$${(p.marketCap / 1000).toFixed(1)}K` : "N/A";
          const vol24h = p?.volume?.h24 ? `$${(p.volume.h24 / 1000).toFixed(1)}K` : "N/A";
          const age = p?.pairCreatedAt
            ? `${Math.round((Date.now() - p.pairCreatedAt) / 60000)}m ago`
            : "N/A";
          const dex = p?.dexId ?? "unknown";

          return `**${i + 1}. ${name} (${symbol})**
- Address: \`${t.tokenAddress}\`
- Price: ${price} | MCap: ${mcap} | Vol 24h: ${vol24h}
- Age: ${age} | DEX: ${dex}
- URL: https://dexscreener.com/solana/${t.tokenAddress}`;
        }).join("\n\n");

        return {
          content: [{
            type: "text",
            text: results.length
              ? `**Live Solana Memecoins from DexScreener** (${tokens.length} found)\n\n${results}`
              : "No new Solana tokens found on DexScreener right now.",
          }],
        };
      }

      case "dolores_register_agent": {
        const { template, name } = args as { template: string; name?: string };
        const operatorKeypair = getOrCreateWallet();
        const connection = new Connection(RPC_URL, "confirmed");

        const VALID_TEMPLATES = ["SOL_TRANSFER", "JUPITER_TRADER", "RAYDIUM_LP", "METEORA_POOLS", "KAMINO_LENDING", "PYTH_ORACLE_READER", "PUMPFUN_TRADER"];
        if (!VALID_TEMPLATES.includes(template)) {
          throw new Error(`Invalid template. Choose from: ${VALID_TEMPLATES.join(", ")}`);
        }

        // Check operator balance
        const balance = await connection.getBalance(operatorKeypair.publicKey);
        if (balance < 50_000_000) {
          return {
            content: [{
              type: "text",
              text: `⚠️ Insufficient SOL to register agent.\n\nYour wallet: \`${operatorKeypair.publicKey.toBase58()}\`\nBalance: ${(balance / 1e9).toFixed(4)} SOL\nRequired: ~0.05 SOL\n\nFund your wallet first:\n- Devnet: \`solana airdrop 1 ${operatorKeypair.publicKey.toBase58()} --url devnet\`\n- Mainnet: send SOL to \`${operatorKeypair.publicKey.toBase58()}\``,
            }],
          };
        }

        // Generate agent keypair
        const { Keypair: SolanaKeypair } = await import("@solana/web3.js");
        const agentKeypair = SolanaKeypair.generate();
        const agentId = agentKeypair.publicKey.toBase58();

        // Save agent keypair to ~/.dolores/agents/
        const agentDir = path.join(os.homedir(), ".dolores", "agents");
        fs.mkdirSync(agentDir, { recursive: true });
        fs.writeFileSync(
          path.join(agentDir, `${agentId}.json`),
          JSON.stringify(Array.from(agentKeypair.secretKey))
        );

        const metadataPath = path.join(agentDir, `${agentId}.meta.json`);
        fs.writeFileSync(metadataPath, JSON.stringify({
          name: name || `${template} Agent`,
          template,
          registeredAt: Date.now(),
          operator: operatorKeypair.publicKey.toBase58(),
        }, null, 2));


        // Build capability hash from template
        const crypto = require("crypto");
        const manifest = {
          name: name || `${template} Agent`,
          description: `Dolores agent with ${template} capability`,
          capabilities: [{ name: template, version: "1.0" }],
        };
        const capabilityHash = Array.from(
          crypto.createHash("sha256").update(JSON.stringify(manifest.capabilities)).digest()
        );

        // Setup Anchor programs
        const { AnchorProvider, Wallet, Program, BN } = await import("@coral-xyz/anchor");
        const idlRegistry = require(path.join(__dirname, "idl/dolores_registry.json"));
        const idlFund = require(path.join(__dirname, "idl/dolores_fund.json"));

        const wallet = new Wallet(operatorKeypair);
        const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

        const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
        const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";

        const registryProgram = new Program(idlRegistry as any, provider) as any;
        const fundProgram = new Program(idlFund as any, provider) as any;

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), agentKeypair.publicKey.toBuffer()],
          new PublicKey(REGISTRY_PROGRAM_ID)
        );
        const [fundPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("fund"), operatorKeypair.publicKey.toBuffer(), agentKeypair.publicKey.toBuffer()],
          new PublicKey(FUND_PROGRAM_ID)
        );
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), operatorKeypair.publicKey.toBuffer(), agentKeypair.publicKey.toBuffer()],
          new PublicKey(FUND_PROGRAM_ID)
        );

        // Step 1 — register_agent
        const tx1 = await registryProgram.methods
          .registerAgent(capabilityHash)
          .accounts({
            operator: operatorKeypair.publicKey,
            agent: agentKeypair.publicKey,
            registry: registryPda,
            systemProgram: "11111111111111111111111111111111",
          })
          .signers([agentKeypair])
          .rpc();

        // Step 2 — initialize_fund
        const tx2 = await fundProgram.methods
          .initializeFund()
          .accounts({
            operator: operatorKeypair.publicKey,
            agent: agentKeypair.publicKey,
            fund: fundPda,
            vault: vaultPda,
            systemProgram: "11111111111111111111111111111111",
          })
          .signers([agentKeypair])
          .rpc();

        await apiFetch(`/agents/${agentId}/seed`, "POST", {
          operator: operatorKeypair.publicKey.toBase58(),
          name: name || `${template} Agent`,
          template,
          description: `Dolores agent with ${template} capability`,
        });

        // Seed in API cache
        await apiFetch(`/agents/${agentId}`, "GET").catch(() => { });

        return {
          content: [{
            type: "text",
            text: `🤖 **Agent registered successfully!**\n\nAgent ID: \`${agentId}\`\nTemplate: ${template}\nOperator: \`${operatorKeypair.publicKey.toBase58()}\`\n\nTransactions:\n- Register: \`${tx1}\`\n- Fund init: \`${tx2}\`\n\nKeypair saved to: \`${path.join(agentDir, agentId + ".json")}\`\n\n**Next steps:**\n1. Stake SOL: use \`dolores_stake_agent\`\n2. List for hire: use \`dolores_list_agent_for_hire\`\n3. Start agent runtime: run \`pnpm dev:agent\` with AGENT_ID=${agentId}`,
          }],
        };
      }

      case "dolores_stake_agent": {
        const { agentId, amountSol } = args as { agentId: string; amountSol: number };
        const operatorKeypair = getOrCreateWallet();
        const connection = new Connection(RPC_URL, "confirmed");

        const { AnchorProvider, Wallet, Program, BN } = await import("@coral-xyz/anchor");
        const idlRegistry = require(path.join(__dirname, "idl/dolores_registry.json"));
        const idlFund = require(path.join(__dirname, "idl/dolores_fund.json"));
        const wallet = new Wallet(operatorKeypair);
        const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });

        const REGISTRY_PROGRAM_ID = "8mxK8nGahGAtGKWCjszTp6joRkW7XvVMXaNeEqda56pt";
        const FUND_PROGRAM_ID = "AyLZfg3r8PA1TLoqVkoyH8QZtzpAdDDyk82iM4AsbWn5";

        const agentPubkey = new PublicKey(agentId);
        const amountLamports = Math.floor(amountSol * 1e9);

        const registryProgram = new Program(idlRegistry as any, provider) as any;
        const fundProgram = new Program(idlFund as any, provider) as any;

        const [registryPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("registry"), agentPubkey.toBuffer()],
          new PublicKey(REGISTRY_PROGRAM_ID)
        );
        const [fundPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("fund"), operatorKeypair.publicKey.toBuffer(), agentPubkey.toBuffer()],
          new PublicKey(FUND_PROGRAM_ID)
        );
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), operatorKeypair.publicKey.toBuffer(), agentPubkey.toBuffer()],
          new PublicKey(FUND_PROGRAM_ID)
        );
        const [stakerPositionPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("staker"), fundPda.toBuffer(), operatorKeypair.publicKey.toBuffer()],
          new PublicKey(FUND_PROGRAM_ID)
        );

        const tx1 = await fundProgram.methods
          .stake(new BN(amountLamports))
          .accounts({
            operator: operatorKeypair.publicKey,
            fund: fundPda,
            vault: vaultPda,
            stakerPosition: stakerPositionPda,
            systemProgram: "11111111111111111111111111111111",
          })
          .rpc();

        const tx2 = await registryProgram.methods
          .updateDeclaredStake(new BN(amountLamports))
          .accounts({
            operator: operatorKeypair.publicKey,
            registry: registryPda,
          })
          .rpc();

        return {
          content: [{
            type: "text",
            text: `✅ **Staked ${amountSol} SOL on agent!**\n\nAgent: \`${agentId.slice(0, 8)}...\`\nAmount: ${amountSol} SOL\nStake TX: \`${tx1}\`\nRegistry TX: \`${tx2}\`\n\nYour agent now has skin in the game. Ready to list for hire with \`dolores_list_agent_for_hire\`.`,
          }],
        };
      }

      case "dolores_list_agent_for_hire": {
        const { agentId, hireFeeSOL } = args as { agentId: string; hireFeeSOL?: number };

        // Cache agent first
        await apiFetch(`/agents/${agentId}`, "GET").catch(() => { });

        const result = await apiFetch(`/agents/${agentId}/list-for-hire`, "POST", {
          available: true,
          hireFeeSOL: hireFeeSOL ?? 0.01,
        }) as any;

        if (!result.ok) throw new Error("Failed to list agent for hire");

        return {
          content: [{
            type: "text",
            text: `✅ **Agent listed for hire!**\n\nAgent: \`${agentId.slice(0, 8)}...\`\nHire fee: ${hireFeeSOL ?? 0.01} SOL\n\nAnyone can now find and hire your agent from the Dolores marketplace.`,
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `❌ Error: ${err?.message ?? String(err)}` }],
      isError: true,
    };
  }
});

//  Start 

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Dolores MCP server running");
}

main().catch(console.error);