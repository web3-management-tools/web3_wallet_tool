export const COMMON_NETWORKS = [
    { name: 'Ethereum Mainnet', chainId: 1, rpcs: ['https://rpc.flashbots.net', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'] },
    { name: 'BSC Mainnet', chainId: 56, rpcs: ['https://bsc-dataseed1.binance.org', 'https://binance.llamarpc.com', 'https://bsc-dataseed.binance.org'] },
    { name: 'Polygon Mainnet', chainId: 137, rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://1rpc.io/matic'] },
    { name: 'Arbitrum One', chainId: 42161, rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://1rpc.io/arb'] },
    { name: 'Optimism', chainId: 10, rpcs: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://1rpc.io/op'] },
    { name: 'Avalanche C-Chain', chainId: 43114, rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://1rpc.io/avax/c', 'https://avalanche.public-rpc.com'] },
    { name: 'Base', chainId: 8453, rpcs: ['https://mainnet.base.org', 'https://1rpc.io/base', 'https://base.llamarpc.com'] },
    { name: 'zkSync Era', chainId: 324, rpcs: ['https://mainnet.era.zksync.io', 'https://1rpc.io/zksync2-era', 'https://zksync-era.public.blastapi.io'] },
    { name: 'Linea', chainId: 59144, rpcs: ['https://rpc.linea.build', 'https://linea.blockpi.network/v1/rpc/public', 'https://1rpc.io/linea'] },
    { name: 'Mantle', chainId: 5000, rpcs: ['https://rpc.mantle.xyz', 'https://1rpc.io/mantle'] },
    { name: 'Scroll', chainId: 534352, rpcs: ['https://rpc.scroll.io', 'https://1rpc.io/scroll', 'https://scroll.blockpi.network/v1/rpc/public'] },
    { name: 'Metis', chainId: 1088, rpcs: ['https://andromeda.metis.io/?owner=1088', 'https://metis.publicnode.com'] },
];

// 「只发送交易、不服务读方法」的 RPC 黑名单。
// 这类 RPC 用于私有打包/防夹（如 flashbots Protect），eth_call 会返回 403「rpc method is not whitelisted」，
// 但 eth_getBalance / eth_blockNumber 可用——所以原生币余额能查、ERC20 余额(balanceOf 走 eth_call)会全失败。
// 读取（余额/精度/Gas）请用 getReadRpcList() 过滤掉它们；发送交易仍可用（享私有打包优势）。
export const READ_INCAPABLE_RPCS = new Set([
    'https://rpc.flashbots.net',
]);

// 常用稳定币合约地址（按 chainId 区分）。
// 选择 ERC20 后可在转账页一键填入，省去手动粘贴合约地址。
// 注意：同一代币在不同链上的合约地址与精度均不同，以下地址均已逐链 on-chain 核对 symbol()/decimals()。
export const COMMON_TOKENS = {
    1:      { USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }, // Ethereum
    56:     { USDT: '0x55d398326f99059fF775485246999027B3197955', USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' }, // BSC（精度 18）
    137:    { USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' }, // Polygon
    42161:  { USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' }, // Arbitrum
    10:     { USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' }, // Optimism
    43114:  { USDT: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', USDC: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' }, // Avalanche
    8453:   { USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }, // Base
    324:    { USDT: '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', USDC: '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4' }, // zkSync Era
    59144:  { USDT: '0xA219439258ca9da29E9Cc4cE5596924745e12B93', USDC: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff' }, // Linea
    5000:   { USDT: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE', USDC: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9' }, // Mantle
    534352: { USDT: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df', USDC: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4' }, // Scroll
    1088:   { USDT: '0xbB06DCA3AE6887fAbF931640f67cab3e3a16F4dC', USDC: '0xEA32A96608495e54156Ae48931A7c20f0dcc1a21' }, // Metis（m.USDT / m.USDC）
};
