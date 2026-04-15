# Arweave Master Wallet Configuration Guide

## Development Setup

For local development, generate a new Arweave wallet:

```bash
node -e "const Arweave = require('arweave'); const arweave = Arweave.init({}); arweave.wallets.generate().then(key => console.log(JSON.stringify(key)))" > arweave-wallet.json
```

Then fund it with testnet AR:

1. Get your wallet address: `node -e "const Arweave = require('arweave'); const fs = require('fs'); const arweave = Arweave.init({}); const key = JSON.parse(fs.readFileSync('arweave-wallet.json')); arweave.wallets.jwkToAddress(key).then(console.log);"`
2. Fund via faucet: https://faucet.arweave.net/

Set in `.env`:

```
ARWEAVE_WALLET_PATH=./arweave-wallet.json
```

## Production Setup (Best Practice)

**DO NOT commit wallet keys to Git.**

### Option 1: Environment Variable (Recommended for cloud deployments)

Store the wallet JSON as a base64-encoded secret:

```bash
# Encode wallet
cat arweave-wallet.json | base64

# Set in environment (e.g., Render, Railway, Vercel)
ARWEAVE_WALLET_JSON='<base64-encoded-wallet-json>'
```

### Option 2: Secrets Manager (Enterprise)

Use your cloud provider's secrets manager:

- AWS: Secrets Manager
- GCP: Secret Manager
- Azure: Key Vault
- Kubernetes: Sealed Secrets

Load at runtime in `arweave.service.ts`.

### Option 3: Master Wallet + Sub-wallets

For high-volume operations:

1. Create a master wallet (cold storage)
2. Generate operational sub-wallets
3. Fund sub-wallets with limited AR
4. Rotate sub-wallets regularly

## Security Best Practices

1. **Never commit wallet keys** - Add `arweave-wallet.json` to `.gitignore`
2. **Use minimal funding** - Only fund with what you need for operations
3. **Monitor balance** - Set up alerts for low balance or unusual activity
4. **Rotate regularly** - Generate new wallets periodically
5. **Backup safely** - Encrypt and store master wallet backups securely

## Testnet vs Mainnet

**Testnet (development):**

```
ARWEAVE_HOST=testnet.redstone.tools
ARWEAVE_PORT=443
ARWEAVE_PROTOCOL=https
```

**Mainnet (production):**

```
ARWEAVE_HOST=arweave.net
ARWEAVE_PORT=443
ARWEAVE_PROTOCOL=https
```

## Cost Estimates

Arweave storage costs (as of 2026):

- ~$2-5 per GB for permanent storage
- Average receipt size: ~2-5 KB
- Cost per receipt: ~$0.001
- 1 AR ≈ 200,000 receipts

Fund your wallet accordingly based on expected volume.
