const { Connection, PublicKey } = require('@solana/web3.js');
const connection = new Connection('https://api.mainnet-beta.solana.com');

const mint = new PublicKey('2imQKT9sZmRjYtEFPQME15fj4xmHXt7xWvCfC5YWpump');
const owner = new PublicKey('5NFai8oFNvzP9z6ANvn5VbDvXr7YmwryiS7Xt7hosYbo');
const TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const ASSOC = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bwL');

const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022.toBuffer(), mint.toBuffer()],
    ASSOC
);
console.log('Computed ATA:', ata.toBase58());
console.log('Actual ATA:  ', 'gNP2psevtTqDJrke72nZJhTppNsonGNzrKnS8eb5GpU');
console.log('Match:', ata.toBase58() === 'gNP2psevtTqDJrke72nZJhTppNsonGNzrKnS8eb5GpU');
