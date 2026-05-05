const { Connection, PublicKey } = require('@solana/web3.js');
const connection = new Connection('https://api.mainnet-beta.solana.com');
const PUMP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const mint = new PublicKey('2imQKT9sZmRjYtEFPQME15fj4xmHXt7xWvCfC5YWpump');

const [bcPDA] = PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), mint.toBuffer()], PUMP);
connection.getAccountInfo(bcPDA).then(info => {
    if (!info) { console.log('BC not found'); return; }
    console.log('Data length:', info.data.length);
    // Offset 8 = after discriminator
    let o = 8;
    const vtr = info.data.readBigUInt64LE(o); o+=8; console.log('virtualTokenReserves:', vtr.toString());
    const vsr = info.data.readBigUInt64LE(o); o+=8; console.log('virtualSolReserves:', vsr.toString());
    const rtr = info.data.readBigUInt64LE(o); o+=8; console.log('realTokenReserves:', rtr.toString());
    const rsr = info.data.readBigUInt64LE(o); o+=8; console.log('realSolReserves:', rsr.toString());
    const tts = info.data.readBigUInt64LE(o); o+=8; console.log('tokenTotalSupply:', tts.toString());
    const complete = info.data.readUInt8(o); o+=1; console.log('complete:', complete);
    const creator = new PublicKey(info.data.slice(o, o+32));
    console.log('creator at offset', o, ':', creator.toBase58());
});
