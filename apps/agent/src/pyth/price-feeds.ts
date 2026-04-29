/**
 * Pyth Network Price Feed IDs
 *
 * Maps human-readable symbols to Pyth Hermes feed IDs.
 * Source: https://pyth.network/developers/price-feed-ids
 */

export const PRICE_FEEDS: Record<string, string> = {
    // Major cryptocurrencies
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
    XRP: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
    ADA: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
    DOGE: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
    AVAX: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
    DOT: "0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284f5e37d4419b3f5632",
    LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
    UNI: "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
    LTC: "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",

    // Stablecoins
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    DAI: "0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd",

    // Solana ecosystem
    JTO: "0xb43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2",
    JUP: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    BONK: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
    WIF: "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
    RAY: "0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a",

    // DeFi
    AAVE: "0x2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
    CRV: "0xa19d04ac696c7a6616d291c7e5d1377cc8be437c327b75adb5dc1bad745fcae8",
    MKR: "0x9375299e31c0deb9c6bc378e6329aab44cb48ec655552a70d4b9050346a30378",
    COMP: "0x4a8e42861cabc5ecb50996f92e7cfa2bce3fd0a2423b0c44c9b423fb2bd25478",

    // Commodities
    XAU: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
    XAG: "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
};

export const HERMES_ENDPOINT = "https://hermes.pyth.network";

export function getFeedId(symbol: string): string | null {
    return PRICE_FEEDS[symbol.toUpperCase()] ?? null;
}

export function getSymbolFromFeedId(feedId: string): string | null {
    const cleanFeedId = feedId.toLowerCase().replace(/^0x/, "");
    for (const [symbol, id] of Object.entries(PRICE_FEEDS)) {
        if (id.toLowerCase().replace(/^0x/, "") === cleanFeedId) {
            return symbol;
        }
    }
    return null;
}

export function listSupportedSymbols(): string[] {
    return Object.keys(PRICE_FEEDS).sort();
}