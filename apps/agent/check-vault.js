const { Connection, PublicKey } = require('@solana/web3.js');
const connection = new Connection('https://api.mainnet-beta.solana.com');
const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const mint = new PublicKey('2imQKT9sZmRjYtEFPQME15fj4xmHXt7xWvCfC5YWpump');

const [bcPDA] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], PUMP);
connection.getAccountInfo(bcPDA).then(info => {
    if (!info) { console.log('BC not found'); return; }
    const creator = new PublicKey(info.data.slice(49, 81));
    console.log('Creator:', creator.toBase58());
    const [vault] = PublicKey.findProgramAddressSync([Buffer.from('creator-vault'), creator.toBuffer()], PUMP);
    console.log('Vault PDA:', vault.toBase58());
    return connection.getAccountInfo(vault).then(v => console.log('Vault exists:', !!v));
});
