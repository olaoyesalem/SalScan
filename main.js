// main.js - Your new JavaScript entry point
import * as ethers from 'ethers';

// Make ethers available globally (like the CDN version did)
window.ethers = ethers;

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. STATE & CONFIGURATION ---
    const BASE_RPC_URL = import.meta.env.VITE_BASE_RPC_URL;
    const BASE_CHAINLINK_POL_USD_PRICE_FEED = '0x5e988c11a4f92155c30d9fb69ed75597f712b113';
    const CHAINLINK_PRICE_FEED_ABI = [
        "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
        "function decimals() view returns (uint8)"
    ];

    const networkConfig = {
        'ETH': {
            name: 'Ethereum',
            icon: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
            themeClass: 'eth-main',
            searchName: 'Ethereum',
            coingeckoId: 'ethereum',
            rpcUrl: import.meta.env.VITE_ETH_RPC_URL,
            symbol: 'ETH',
            chainId: 1
        },
        'POLYGON': {
            name: 'Polygon',
            icon: 'https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png',
            themeClass: 'polygon-main',
            searchName: 'Polygon',
            useChainlink: true,
            rpcUrl: import.meta.env.VITE_POLYGON_RPC_URL,
            symbol: 'POL',
            chainId: 137
        }
    };

    let currentNetwork = 'ETH';
    let provider;
    let baseProvider;
    let priceFeedContract;
    let priceInterval = null;

    let currentViewedAddress = null;
    let currentFromPageKey = null;
    let currentToPageKey = null;

    // --- 2. DOM ELEMENT REFERENCES ---
    const networkSelectorBtn = document.getElementById('network-selector-btn');
    const networkSelectorContainer = document.getElementById('network-selector-container');
    const networkDropdownMenu = document.getElementById('network-dropdown-menu');
    const networkOptions = document.querySelectorAll('.network-option');
    const networkIcon = document.getElementById('network-icon');
    const networkName = document.getElementById('network-name');
    const headerIcon = document.getElementById('header-icon');
    const networkSearchName = document.getElementById('network-search-name');
    const searchInput = document.getElementById('search-input');
    const latestBlocksList = document.getElementById('latest-blocks-list');
    const latestTxsList = document.getElementById('latest-txs-list');
    const searchForm = document.getElementById('search-form');
    const mainContent = document.getElementById('main-content');
    const searchResultPage = document.getElementById('search-result-page');
    const searchResultContent = document.getElementById('search-result-content');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    const cryptoPriceDisplay = document.getElementById('crypto-price');

    searchInput.disabled = true;
    searchInput.placeholder = 'Loading network...';


    try {
        console.log(`%c🔗 Initializing Base provider for Chainlink...`, "color: #ff9800;");
        baseProvider = new ethers.providers.JsonRpcProvider(BASE_RPC_URL);
        priceFeedContract = new ethers.Contract(
            BASE_CHAINLINK_POL_USD_PRICE_FEED,
            CHAINLINK_PRICE_FEED_ABI,
            baseProvider
        );
        console.log(`%c✅ Price feed contract initialized.`, "color: #4caf50;");
    } catch (error) {
        console.error("%c❌ FATAL: Could not initialize Base price feed provider.", "color: #f44336; font-weight: bold;", error);
        // The app will still load, but price-fetching for POLYGON will fail.
        // This error will be caught and displayed by updateCryptoPrice later.
    }
    // --- 3. HELPER FUNCTIONS ---
    function showAppError(element, message) {
        console.error(message);
        if (element) {
            element.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }
    function showLoadingSpinner(element) {
        if (element) {
            element.innerHTML = `<div class="flex justify-center items-center p-4"><div class="spinner"></div></div>`;
        }
    }
    function toggleNetworkDropdown() {
        networkDropdownMenu.style.display = networkDropdownMenu.style.display === 'block' ? 'none' : 'block';
    }
    function showMainPage() {
        mainContent.style.display = 'grid';
        searchResultPage.style.display = 'none';
        searchResultContent.innerHTML = '';
        searchInput.value = '';
    }
    function showResultPage() {
        mainContent.style.display = 'none';
        searchResultPage.style.display = 'block';
    }
    function formatEthValue(weiValue) {
        if (!weiValue) return '0.00';
        const eth = ethers.utils.formatEther(weiValue);
        return parseFloat(eth).toFixed(6);
    }
    function formatTokenValue(rawValue, decimals) {
        if (!rawValue || decimals === null || decimals === undefined) return '0';
        try {
            return ethers.utils.formatUnits(rawValue, decimals);
        } catch (e) {
            console.warn("Error formatting token value:", rawValue, decimals, e);
            return 'N/A';
        }
    }
    function formatBigNumber(bigNum) {
        if (!bigNum) return '0';
        return ethers.BigNumber.from(bigNum).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function formatGasValue(weiValue) {
        if (!weiValue) return '0';
        const gwei = ethers.utils.formatUnits(weiValue, 'gwei');
        return `${parseFloat(gwei).toFixed(2)} Gwei`;
    }
    function getRelativeTime(timestamp) {
        const now = new Date();
        const past = new Date(timestamp * 1000);
        const diff = Math.floor((now.getTime() - past.getTime()) / 1000);
        if (diff < 60) return `${diff} sec${diff === 1 ? '' : 's'} ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return `${Math.floor(diff / 86400)} days ago`;
    }

    // --- PRICE FETCHING FUNCTIONS ---
    async function getPolUsdPrice() {
        try {
            const { answer } = await priceFeedContract.latestRoundData();
            const price = parseFloat(ethers.utils.formatUnits(answer, 8)); 
            if (price <= 0) { 
                throw new Error(`Chainlink returned an invalid price: ${price}`); 
            }
            return price;
        } catch (error) {
            console.error("Could not fetch POL/USD price from Base Chainlink:", error.message);
            return null;
        }
    }

    async function updateCryptoPrice(config) {
        if (!config) {
            cryptoPriceDisplay.innerHTML = '';
            return;
        }

        cryptoPriceDisplay.innerHTML = `<span class="text-gray-400">Loading...</span>`;

        try {
            let price = null;

            if (config.useChainlink) {
                price = await getPolUsdPrice();
            } else if (config.coingeckoId) {
                const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${config.coingeckoId}&vs_currencies=usd`);
                if (!response.ok) throw new Error('CoinGecko API request failed');
                
                const data = await response.json();
                price = data[config.coingeckoId]?.usd;
            }

            if (price) {
                cryptoPriceDisplay.innerHTML = `
                    <span class="text-gray-400">${config.symbol}/USD:</span> 
                    <span class="text-white">$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                `;
            } else {
                cryptoPriceDisplay.innerHTML = '';
            }
        } catch (error) {
            console.error("Error fetching crypto price:", error);
            cryptoPriceDisplay.innerHTML = '<span class="text-red-400 text-sm">Price N/A</span>';
        }
    }

    // --- 4. CORE APPLICATION LOGIC ---
    async function updateNetwork(networkKey) {
        console.log(`%c🔄 Switching to ${networkKey}...`, "color: #89b4fa; font-weight: bold;");
        currentNetwork = networkKey;
        const config = networkConfig[networkKey];
        if (!config) return showAppError(document.body, `Invalid network configuration for ${networkKey}.`);
        
        try {
            console.log(`%c🌐 Connecting to ${config.name} at ${config.rpcUrl}`, "color: #ffeb3b;");
            provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
            const network = await provider.getNetwork();
            console.log(`%c✅ Connected to ${config.name} (Chain ID: ${network.chainId})`, "color: #4caf50; font-weight: bold;");
            if (network.chainId !== config.chainId) {
                console.warn(`⚠️ Warning: Expected chainId ${config.chainId} but got ${network.chainId}`);
            }

            if (priceInterval) clearInterval(priceInterval);
            await updateCryptoPrice(config);
            priceInterval = setInterval(() => updateCryptoPrice(config), 60000);

        } catch (error) {
            console.error("%c❌ Connection Failed!", "color: #f44336; font-weight: bold;", error);
            provider = null;
            let errorMsg = `Error: Could not connect to ${config.name} network.`;
            showAppError(latestBlocksList, errorMsg);
            showAppError(latestTxsList, "Please try again later or select another network.");
            
            if (priceInterval) clearInterval(priceInterval);
            cryptoPriceDisplay.innerHTML = '';
            return;
        }

        networkName.textContent = config.name;
        networkIcon.src = config.icon;
        networkSearchName.textContent = config.searchName;
        document.querySelectorAll('.theme-transition').forEach(el => {
            Object.values(networkConfig).forEach(cfg => el.classList.remove(`text-${cfg.themeClass}`, `border-${cfg.themeClass}`, `bg-${cfg.themeClass}`, `focus:ring-${cfg.themeClass}`, `shadow-${cfg.themeClass}/30`));
            if (el.matches('[class*="text-"]')) el.classList.add(`text-${config.themeClass}`);
            if (el.matches('[class*="border-"]')) el.classList.add(`border-${config.themeClass}`);
            if (el.matches('[class*="focus:ring-"]')) el.classList.add(`focus:ring-${config.themeClass}`);
            if (el.id === 'header-icon') el.classList.add(`text-${config.themeClass}`);
            if (el.id === 'network-search-name') el.classList.add(`text-${config.themeClass}`);
            if (el.id === 'search-input') el.classList.add(`focus:shadow-lg`, `focus:shadow-${config.themeClass}/30`);
        });
        document.querySelectorAll('#main-content .glass-card').forEach(card => {
            Object.values(networkConfig).forEach(cfg => card.classList.remove(`border-${cfg.themeClass}`));
            card.classList.add(`border-${config.themeClass}`);
        });
        showMainPage();
        await renderMainPageData();
        searchInput.disabled = false;
        searchInput.placeholder = 'Search by Address / Txn Hash / Block / .eth Name';
        networkDropdownMenu.style.display = 'none';
    }

    async function renderMainPageData() {
        const config = networkConfig[currentNetwork];
        showLoadingSpinner(latestBlocksList);
        showLoadingSpinner(latestTxsList);
        try {
            const latestBlockNumber = await provider.getBlockNumber();
            let blockPromises = [];
            for (let i = 0; i < 5; i++) blockPromises.push(provider.getBlock(latestBlockNumber - i));
            const blocks = await Promise.all(blockPromises);
            latestBlocksList.innerHTML = '';
            blocks.forEach(block => {
                if (!block) return;
                latestBlocksList.innerHTML += `<div class="list-item"><div class="flex items-center gap-3 overflow-hidden"><div class="list-item-icon"><i class="ph ph-cube text-gray-300"></i></div><div class="truncate"><a href="#" class="font-medium search-link" data-query="${block.number}">Block ${block.number}</a><p class="text-sm text-gray-400 truncate">Fee Recipient: <a href="#" class="search-link" data-query="${block.miner}">${block.miner.substring(0, 10)}...</a></p></div></div><div class="text-right flex-shrink-0 ml-2"><p class="text-sm text-gray-200 font-medium">${block.transactions.length} txns</p><p class="text-xs text-gray-400">${getRelativeTime(block.timestamp)}</p></div></div>`;
            });
            const latestBlock = blocks[0];
            if (!latestBlock) return showAppError(latestTxsList, 'Could not fetch latest block.');
            const txHashes = latestBlock.transactions.slice(0, 5);
            if (txHashes.length === 0) {
                latestTxsList.innerHTML = '<p class="text-gray-400 p-4">No transactions in the latest block.</p>';
                return;
            }
            const txs = await Promise.all(txHashes.map(hash => provider.getTransaction(hash)));
            latestTxsList.innerHTML = '';
            txs.forEach(tx => {
                if (!tx) return;
                latestTxsList.innerHTML += `<div class="list-item"><div class="flex items-center gap-3 overflow-hidden"><div class="list-item-icon"><i class="ph ph-receipt text-gray-300"></i></div><div class="truncate"><a href="#" class="font-medium search-link truncate block w-32 md:w-full" data-query="${tx.hash}">${tx.hash.substring(0, 12)}...${tx.hash.substring(tx.hash.length - 4)}</a><p class="text-sm text-gray-400 truncate">From <a href="#" class="search-link" data-query="${tx.from}">${tx.from.substring(0, 10)}...</a></p><p class="text-sm text-gray-400 truncate">To <a href="#" class="search-link" data-query="${tx.to}">${tx.to ? tx.to.substring(0, 10) + '...' : 'Contract Creation'}</a></p></div></div><div class="text-right flex-shrink-0 ml-2"><p class="text-sm text-gray-200 font-medium">${formatEthValue(tx.value)} ${config.symbol}</p><p class="text-xs text-gray-400">${formatGasValue(tx.gasPrice)}</p></div></div>`;
            });
        } catch (error) {
            showAppError(latestBlocksList, "Error fetching block data. The network may be busy.");
            showAppError(latestTxsList, "Error fetching transaction data. Please refresh.");
        }
    }

    // --- 5. SEARCH & RESULT RENDERING ---
    async function handleSearch(event) {
        event.preventDefault();
        const query = searchInput.value.trim();
        await performSearch(query);
    }
    async function performSearch(query) {
        if (!query) return;
        if (!provider) {
            alert('Please wait for the network to connect before searching.');
            return;
        }
        showResultPage();
        showLoadingSpinner(searchResultContent);
        let processedQuery = query;
        try {
            if (currentNetwork === 'ETH' && query.endsWith('.eth')) {
                const resolvedAddress = await provider.resolveName(query);
                if (resolvedAddress) {
                    processedQuery = resolvedAddress;
                    searchResultContent.innerHTML = `<p class="text-sm text-gray-400 mb-2">Resolved ENS Name <strong>${query}</strong> to:</p>`;
                } else {
                    return showAppError(searchResultContent, `Could not resolve ENS name "${query}".`);
                }
            }
            if (processedQuery.startsWith('0x') && processedQuery.length === 66) {
                await renderTransactionPage(processedQuery);
            } else if (processedQuery.startsWith('0x') && processedQuery.length === 42) {
                await renderAddressPage(processedQuery);
            } else if (!isNaN(processedQuery)) {
                await renderBlockPage(parseInt(processedQuery));
            } else {
                searchResultContent.innerHTML = `<p class="error-message">Invalid query. Please enter a valid address, transaction hash, block number, or .eth name.</p>`;
            }
        } catch (error) {
            console.error("Search error:", error);
            showAppError(searchResultContent, `Search failed: ${error.message}. Please check the console.`);
        }
    }

    // --- ADDRESS PAGE ---
    async function renderAddressPage(address) {
        currentViewedAddress = address; 
        const config = networkConfig[currentNetwork];
        searchResultContent.innerHTML = `
            <h2 class="text-2xl font-bold mb-4 truncate">Address: ${address}</h2>
            <div class="flex border-b border-white/10 mb-4">
                <button class="tab-btn active-tab" data-tab="overview">Overview</button>
                <button class="tab-btn" data-tab="tokens">Token Balances</button>
                <button class="tab-btn" data-tab="txs">Transactions</button>
            </div>
            <div id="tab-content-overview" class="tab-content"></div>
            <div id="tab-content-tokens" class="tab-content" style="display: none;"></div>
            <div id="tab-content-txs" class="tab-content" style="display: none;">
                <div id="tx-list-container" class="flex flex-col gap-3"></div>
                <div id="tx-loader-container" class="mt-4 text-center"></div>
            </div>
            <style>
                .tab-btn { padding: 0.75rem 1.5rem; border-bottom: 2px solid transparent; color: #a0a0b0; font-weight: 500; }
                .tab-btn:hover { color: #f0f0f0; background: rgba(255, 255, 255, 0.05); }
                .tab-btn.active-tab { 
                    color: white; 
                    border-bottom-color: ${config.themeClass === 'eth-main' ? '#627EEA' : '#8247E5'}; 
                }
            </style>
        `;
        setupTabListeners(address);
        await renderAddressOverview(address);
    }
    
    function setupTabListeners(address) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active-tab'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                
                btn.classList.add('active-tab');
                const tabName = btn.getAttribute('data-tab');
                const contentEl = document.getElementById(`tab-content-${tabName}`);
                contentEl.style.display = 'block';
                
                const isLoaded = btn.getAttribute('data-loaded') === 'true';

                if (!isLoaded) {
                    btn.setAttribute('data-loaded', 'true'); 
                    
                    if (tabName === 'overview' || tabName === 'tokens') {
                        showLoadingSpinner(contentEl);
                    }
                    
                    if (tabName === 'overview') {
                        await renderAddressOverview(address);
                    } else if (tabName === 'tokens') {
                        await renderAddressTokens(address);
                    } else if (tabName === 'txs') {
                        await renderAddressTxs(address); 
                    }
                }
            });
        });
    }

    async function renderAddressOverview(address) {
        const config = networkConfig[currentNetwork];
        const contentEl = document.getElementById('tab-content-overview');
        try {
            const [balance, txCount, code] = await Promise.all([
                provider.getBalance(address),
                provider.getTransactionCount(address),
                provider.getCode(address)
            ]);
            const accountType = code === '0x' ? 'EOA (Wallet)' : 'Contract';
            contentEl.innerHTML = `<div class="glass-card p-6"><h4 class="text-xl font-semibold mb-4">Overview</h4><div class="search-details"><div class="detail-row"><span class="detail-key">Type:</span><span class="detail-value">${accountType}</span></div><div class="detail-row"><span class="detail-key">Balance:</span><span class="detail-value">${formatEthValue(balance)} ${config.symbol}</span></div><div class="detail-row"><span class="detail-key">Nonce:</span><span class="detail-value">${txCount}</span></div></div>${accountType === 'Contract' ? `<p class="text-sm text-gray-400 mt-3">This address is a smart contract.</p>` : ''}</div>`;
        } catch (e) {
            showAppError(contentEl, `Error fetching overview: ${e.message}`);
        }
    }

    async function renderAddressTokens(address) {
        const contentEl = document.getElementById('tab-content-tokens');
        try {
            const balanceData = await provider.send("alchemy_getTokenBalances", [address, "erc20"]);
            const nonZeroBalances = balanceData.tokenBalances.filter(token => token.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000');
            if (nonZeroBalances.length === 0) {
                contentEl.innerHTML = '<p class="text-gray-400 p-4">This address holds no ERC-20 tokens.</p>';
                return;
            }
            const metadataPromises = nonZeroBalances.map(token => provider.send("alchemy_getTokenMetadata", [token.contractAddress]));
            const metadata = await Promise.all(metadataPromises);
            const tokens = nonZeroBalances.map((token, index) => ({ ...token, ...metadata[index] }));
            let listHtml = '<div class="flex flex-col gap-3">';
            tokens.forEach(token => {
                const formattedBalance = formatTokenValue(token.tokenBalance, token.decimals);
                listHtml += `<div class="list-item"><div class="flex items-center gap-3 overflow-hidden"><img src="${token.logo || 'https://placeholder.com/40'}" alt="${token.symbol}" class="w-10 h-10 rounded-full bg-white/10"><div class="truncate"><p class="font-medium text-white">${token.name || 'Unknown Token'}</p><p class="text-sm text-gray-400 truncate"><a href="#" class="search-link" data-query="${token.contractAddress}">${token.symbol || 'N/A'}</a></p></div></div><div class="text-right flex-shrink-0 ml-2"><p class="text-lg text-gray-200 font-medium">${parseFloat(formattedBalance).toLocaleString()}</p></div></div>`;
            });
            listHtml += '</div>';
            contentEl.innerHTML = listHtml;
        } catch (e) {
            console.error("Error fetching tokens:", e);
            showAppError(contentEl, `Error fetching token balances: ${e.message}.`);
        }
    }

    function renderTxListItems(transfers, address) {
        let listHtml = '';
        transfers.forEach(tx => {
            const isOut = tx.from.toLowerCase() === address.toLowerCase();
            let valueHtml = ''; 

            if (tx.category === 'erc721') {
                const tokenId = parseInt(tx.erc721TokenId, 16);
                valueHtml = `<p class="text-sm text-gray-200 font-medium">1 ${tx.asset}</p><p class="text-xs text-gray-400">ID: #${tokenId}</p>`;
            } else if (tx.category === 'erc1155') {
                const tokenId = parseInt(tx.erc1155Metadata[0].tokenId, 16);
                const amount = parseInt(tx.erc1155Metadata[0].value, 16);
                valueHtml = `<p class="text-sm text-gray-200 font-medium">${amount} ${tx.asset}</p><p class="text-xs text-gray-400">ID: #${tokenId}</p>`;
            } else {
                let decimals = 18; 
                if (tx.rawContract.decimal) { 
                    decimals = parseInt(tx.rawContract.decimal, 16);
                }
                const value = formatTokenValue(tx.rawContract.value, decimals);
                valueHtml = `<p class="text-sm text-gray-200 font-medium">${parseFloat(value).toFixed(4)} ${tx.asset}</p>`;
            }
            
            listHtml += `
                <div class="list-item">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="list-item-icon ${isOut ? 'text-red-400' : 'text-green-400'}">
                            <i class="ph ph-arrow-${isOut ? 'up-right' : 'down-left'}"></i>
                        </div>
                        <div class="truncate">
                            <a href="#" class="font-medium search-link truncate block" data-query="${tx.hash}">${tx.hash.substring(0, 12)}...</a>
                            <p class="text-sm text-gray-400 truncate">
                                ${isOut ? 'To' : 'From'}: 
                                <a href="#" class="search-link" data-query="${isOut ? tx.to : tx.from}">
                                    ${(isOut ? tx.to : tx.from).substring(0, 10)}...
                                </a>
                            </p>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0 ml-2">
                        ${valueHtml}
                        <p class="text-xs text-gray-400">${getRelativeTime(new Date(tx.metadata.blockTimestamp).getTime() / 1000)}</p>
                    </div>
                </div>
            `;
        });
        return listHtml;
    }

    async function fetchAndRenderTxs(address, fromKey, toKey, append = false) {
        const listContainer = document.getElementById('tx-list-container');
        const loaderContainer = document.getElementById('tx-loader-container');
        
        if (!append) {
            listContainer.innerHTML = ''; 
        }
        loaderContainer.innerHTML = ''; 

        const fromParams = { 
            fromAddress: address, 
            category: ["external", "internal", "erc20", "erc721", "erc1155"], 
            withMetadata: true, 
            maxCount: "0x14", 
            excludeZeroValue: true, 
            order: "desc" 
        };
        if (fromKey) fromParams.pageKey = fromKey;
        
        const toParams = { 
            toAddress: address, 
            category: ["external", "internal", "erc20", "erc721", "erc1155"], 
            withMetadata: true, 
            maxCount: "0x14", 
            excludeZeroValue: true, 
            order: "desc" 
        };
        if (toKey) toParams.pageKey = toKey;

        const fromPromise = (fromKey === null || fromKey) ? provider.send("alchemy_getAssetTransfers", [fromParams]) : Promise.resolve({ transfers: [] });
        const toPromise = (toKey === null || toKey) ? provider.send("alchemy_getAssetTransfers", [toParams]) : Promise.resolve({ transfers: [] });

        try {
            const [fromData, toData] = await Promise.all([fromPromise, toPromise]);
            
            currentFromPageKey = fromData.pageKey; 
            currentToPageKey = toData.pageKey;
            
            const allTransfers = [...(fromData.transfers || []), ...(toData.transfers || [])];
            const uniqueTransfers = Array.from(new Map(allTransfers.map(tx => [tx.uniqueId, tx])).values());
            uniqueTransfers.sort((a, b) => parseInt(b.blockNum, 16) - parseInt(a.blockNum, 16));
            
            if (allTransfers.length === 0 && !append) {
                listContainer.innerHTML = '<p class="text-gray-400 p-4">No transactions found for this address.</p>';
                return;
            }

            const listHtml = renderTxListItems(uniqueTransfers, address);
            if (append) {
                listContainer.innerHTML += listHtml;
            } else {
                listContainer.innerHTML = listHtml;
            }
            
            if (currentFromPageKey || currentToPageKey) {
                const config = networkConfig[currentNetwork];
                const themeColor = config.themeClass === 'eth-main' ? '#627EEA' : '#8247E5';
                loaderContainer.innerHTML = `<button id="load-more-txs-btn" class="px-6 py-2 text-white rounded-lg font-medium transition-opacity hover:opacity-80" style="background-color: ${themeColor};">Load More</button>`;
            } else {
                loaderContainer.innerHTML = '<p class="text-gray-500 mt-4">End of transaction history.</p>';
            }

        } catch (e) {
            console.error("Error fetching txs:", e);
            showAppError(loaderContainer, `Error fetching transactions: ${e.message}.`);
        }
    }

    async function renderAddressTxs(address) {
        currentFromPageKey = null; 
        currentToPageKey = null;   
        
        const listContainer = document.getElementById('tx-list-container');
        const loaderContainer = document.getElementById('tx-loader-container');

        listContainer.innerHTML = '';    
        loaderContainer.innerHTML = '';  
        showLoadingSpinner(listContainer); 

        await fetchAndRenderTxs(address, null, null, false); 
    }

    async function handleLoadMoreTxs() {
        const loaderContainer = document.getElementById('tx-loader-container');
        loaderContainer.innerHTML = ''; 
        showLoadingSpinner(loaderContainer); 

        await fetchAndRenderTxs(currentViewedAddress, currentFromPageKey, currentToPageKey, true);
    }


    // --- Transaction Page ---
    async function renderTransactionPage(hash) {
        const config = networkConfig[currentNetwork];
        try {
            const [tx, receipt] = await Promise.all([
                provider.getTransaction(hash),
                provider.getTransactionReceipt(hash)
            ]);
            if (!tx || !receipt) {
                searchResultContent.innerHTML = `<p class="error-message">Transaction not found.</p>`;
            } else {
                searchResultContent.innerHTML = `<h2 class="text-2xl font-bold mb-4">Transaction Details</h2><div class="glass-card p-6"><div class="search-details"><div class="detail-row"><span class="detail-key">Hash:</span><span class="detail-value">${tx.hash}</span></div><div class="detail-row"><span class="detail-key">Status:</span><span class="detail-value ${receipt.status === 1 ? 'text-green-400' : 'text-red-400'}">${receipt.status === 1 ? 'Success' : 'Failed'}</span></div><div class="detail-row"><span class="detail-key">Block:</span><span class="detail-value"><a href="#" class="search-link" data-query="${tx.blockNumber}">${tx.blockNumber}</a></span></div><div class="detail-row"><span class="detail-key">From:</span><span class="detail-value"><a href="#" class="search-link" data-query="${tx.from}">${tx.from}</a></span></div><div class="detail-row"><span class="detail-key">To:</span><span class="detail-value"><a href="#" class="search-link" data-query="${tx.to}">${tx.to}</a></span></div><div class="detail-row"><span class="detail-key">Value:</span><span class="detail-value">${formatEthValue(tx.value)} ${config.symbol}</span></div><div class="detail-row"><span class="detail-key">Gas Price:</span><span class="detail-value">${formatGasValue(tx.gasPrice)}</span></div><div class="detail-row"><span class="detail-key">Gas Used:</span><span class="detail-value">${formatBigNumber(receipt.gasUsed)} units</span></div><div class="detail-row"><span class="detail-key">Gas Limit:</span><span class="detail-value">${formatBigNumber(tx.gasLimit)} units</span></div></div></div>`;
            }
        } catch (e) {
            showAppError(searchResultContent, `Error fetching transaction: ${e.message}`);
        }
    }
    
    // --- Block Page ---
    async function renderBlockPage(blockNumber) {
        try {
            const block = await provider.getBlock(blockNumber);
            if (!block) {
                searchResultContent.innerHTML = `<p class="error-message">Block not found.</p>`;
            } else {
                 searchResultContent.innerHTML = `<h2 class="text-2xl font-bold mb-4">Block Details</h2><div class="glass-card p-6"><div class="search-details"><div class="detail-row"><span class="detail-key">Block:</span><span class="detail-value">${block.number}</span></div><div class="detail-row"><span class="detail-key">Timestamp:</span><span class="detail-value">${new Date(block.timestamp * 1000).toLocaleString()} (${getRelativeTime(block.timestamp)})</span></div><div class="detail-row"><span class="detail-key">Transactions:</span><span class="detail-value">${block.transactions.length}</span></div><div class="detail-row"><span class="detail-key">Fee Recipient:</span><span class="detail-value"><a href="#" class="search-link" data-query="${block.miner}">${block.miner}</a></span></div><div class="detail-row"><span class="detail-key">Hash:</span><span class="detail-value">${block.hash}</span></div><div class="detail-row"><span class="detail-key">Parent Hash:</span><span class="detail-value">${block.parentHash}</span></div><div class="detail-row"><span class="detail-key">Gas Used:</span><span class="detail-value">${formatBigNumber(block.gasUsed)} units</span></div><div class="detail-row"><span class="detail-key">Gas Limit:</span><span class="detail-value">${formatBigNumber(block.gasLimit)} units</span></div></div></div>`;
            }
        } catch (e) {
            showAppError(searchResultContent, `Error fetching block: ${e.message}`);
        }
    }

    // --- 6. EVENT LISTENERS ---
    networkSelectorBtn.addEventListener('click', toggleNetworkDropdown);
    window.addEventListener('click', (event) => {
        if (!networkSelectorContainer.contains(event.target)) {
            networkDropdownMenu.style.display = 'none';
        }
    });
    networkOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            const networkKey = e.currentTarget.getAttribute('data-network');
            updateNetwork(networkKey);
        });
    });
    searchForm.addEventListener('submit', handleSearch);
    backToMainBtn.addEventListener('click', showMainPage);
    
    document.body.addEventListener('click', async (event) => {
        // Handle dynamic search links
        const link = event.target.closest('.search-link');
        if (link) {
            event.preventDefault();
            const query = link.getAttribute('data-query');
            if (query) {
                searchInput.value = query;
                performSearch(query);
            }
        }

        // Handle dynamic "Load More" button click
        if (event.target && event.target.id === 'load-more-txs-btn') {
            await handleLoadMoreTxs();
        }
    });

    // --- 7. INITIALIZATION ---
    console.log("%c🚀 SalScan Initializing...", "color: #627EEA; font-size: 16px; font-weight: bold;");
    console.log(`%c📍 Starting with ${networkConfig[currentNetwork].name}`, "color: #4caf50;");
    
    updateNetwork(currentNetwork);
});