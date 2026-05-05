const { Connection, PublicKey } = require('@solana/web3.js');
const connection = new Connection('https://api.mainnet-beta.solana.com');
const actualAta = new PublicKey('gNP2psevtTqDJrke72nZJhTppNsonGNzrKnS8eb5GpU');
connection.getAccountInfo(actualAta).then(info => {
    if (!info) { console.log('Account not found'); return; }
    console.log('Owner program:', info.owner.toBase58());
    console.log('Data length:', info.data.length);
    // For token accounts, data[32:64] is the mint, data[0:32] is the owner
    const owner = new PublicKey(info.data.slice(0, 32));
    const mint = new PublicKey(info.data.slice(32, 64));
    console.log('Token account owner:', owner.toBase58());
    console.log('Token account mint:', mint.toBase58());
});
