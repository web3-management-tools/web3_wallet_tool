import React, { useState, useEffect } from 'react';
import {
    Code2,
    Database,
    Search,
    CheckCircle,
    AlertCircle,
    Play,
    RefreshCw,
    Terminal,
    Zap,
    Network,
    RotateCcw,
    HelpCircle,
    Download
} from 'lucide-react';
import { ethers } from 'ethers';
import { walletList, getWalletProjects } from '../../api/wallet';
import { decryptPrivateKey } from '../../utils/crypto';
import PasswordInput from '../../components/PasswordInput';
import { COMMON_NETWORKS } from '../../utils/constants';
import './index.css';

export default function UniversalInteraction() {
    // Data Source State
    const [project, setProject] = useState('');
    const [projects, setProjects] = useState([]);
    const [addressInput, setAddressInput] = useState('');
    const [password, setPassword] = useState('');
    const [loadingWallets, setLoadingWallets] = useState(false);
    const [tasks, setTasks] = useState([]);

    // Contract Config State
    const [network, setNetwork] = useState(COMMON_NETWORKS[0]);
    const [customRpc, setCustomRpc] = useState('');
    const [isCustomRpc, setIsCustomRpc] = useState(false);
    const [contractAddress, setContractAddress] = useState('');
    const [abiContent, setAbiContent] = useState('');
    const [methodName, setMethodName] = useState('');
    const [methodParams, setMethodParams] = useState('');
    const [gasBoost, setGasBoost] = useState(''); // Gwei
    const [currentGasPrice, setCurrentGasPrice] = useState(null);

    // Execution State
    const [executing, setExecuting] = useState(false);
    const [message, setMessage] = useState(null);

    // UI State
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);

    useEffect(() => {
        loadProjects();
        // Click outside handler
        const handleClickOutside = (e) => {
            if (!e.target.closest('.project-autocomplete-container')) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Auto-hide toast
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    // Gas Price Polling
    useEffect(() => {
        const fetchGas = async () => {
            try {
                const rpc = getActiveRpc();
                if (!rpc) return;
                const provider = new ethers.JsonRpcProvider(rpc);
                const feeData = await provider.getFeeData();
                const price = feeData.gasPrice || feeData.maxFeePerGas;
                if (price) {
                    setCurrentGasPrice(parseFloat(ethers.formatUnits(price, 'gwei')).toFixed(4));
                }
            } catch (e) { console.warn("Fetch Gas Error:", e); }
        };
        fetchGas();
        const interval = setInterval(fetchGas, 8000);
        return () => clearInterval(interval);
    }, [network, isCustomRpc, customRpc]);

    const loadProjects = async () => {
        const res = await getWalletProjects();
        if (res.success) setProjects(res.data || []);
    };

    const getRpcList = () => {
        if (isCustomRpc) return [customRpc];
        const currentDef = COMMON_NETWORKS.find(n => n.chainId === network.chainId);
        return currentDef?.rpcs || [network.rpc];
    };

    const getActiveRpc = () => getRpcList()[0];

    const handleNetworkChange = (e) => {
        const val = e.target.value;
        if (val === 'custom') {
            setIsCustomRpc(true);
        } else {
            setIsCustomRpc(false);
            const net = COMMON_NETWORKS.find(n => n.chainId === parseInt(val));
            if (net) setNetwork(net);
        }
    };

    const handleFetchWallets = async () => {
        setLoadingWallets(true);
        try {
            let wallets = [];

            // 1. Parse manual input
            const manualAddrs = addressInput
                .split(/[,\n\s]+/)
                .map(a => a.trim())
                .filter(a => ethers.isAddress(a));

            if (manualAddrs.length > 0) {
                // Manual input currently only supports addresses, no private keys => READ ONLY usually
                // BUT user requirement implies we need private keys for interaction.
                // So manual input implies we might not have PKs unless we match them with DB?
                // User Requirement: "Need password box to fetch private key".
                // Interpretation: Priority is DB wallets. Manual addresses might be for filtering or simple read (but title is "On-Chain Interaction").
                // Let's assume manual input is for "filtering" or "external keys" (not supported yet).
                // Let's focus on Project + Password flow as primary for writing.
                if (!project) {
                    setMessage({ type: 'warning', text: '当前仅支持项目钱包进行写操作，请输入地址过滤项目钱包' });
                }
            }

            // 2. Fetch from Project
            if (project && password) {
                const res = await walletList({ project, pwd: password });
                if (res.success) {
                    const dbWallets = res.data || [];
                    const decrypted = await Promise.all(dbWallets.map(async w => {
                        try {
                            const pk = await decryptPrivateKey(w.privateKey);
                            if (!pk || pk.length < 64) return null;
                            new ethers.Wallet(pk); // Validation
                            return { ...w, privKey: pk };
                        } catch (e) { return null; }
                    }));

                    const validWallets = decrypted.filter(w => w !== null);

                    // Filter if manual input exists
                    if (manualAddrs.length > 0) {
                        const allowedSet = new Set(manualAddrs.map(a => a.toLowerCase()));
                        wallets = validWallets.filter(w => allowedSet.has(w.address.toLowerCase()));
                    } else {
                        wallets = validWallets;
                    }

                    if (wallets.length === 0) {
                        setMessage({ type: 'error', text: '没有找到有效钱包或密码错误' });
                    }
                } else {
                    setMessage({ type: 'error', text: res.msg });
                    setLoadingWallets(false);
                    return;
                }
            } else if (manualAddrs.length > 0) {
                setMessage({ type: 'error', text: '通用交互需要私钥，请选择项目并输入密码' });
                setLoadingWallets(false);
                return;
            } else {
                setMessage({ type: 'error', text: '请选择项目并输入密码' });
                setLoadingWallets(false);
                return;
            }

            // 3. Generate Tasks
            const newTasks = wallets.map((w, i) => ({
                id: i,
                address: w.address,
                privKey: w.privKey, // Sensitive, kept in memory
                status: 'pending',
                txHash: '',
                error: '',
                result: ''
            }));

            setTasks(newTasks);
            setMessage({ type: 'success', text: `成功加载 ${newTasks.length} 个钱包` });

        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setLoadingWallets(false);
        }
    };

    const parseParams = (paramStr) => {
        if (!paramStr.trim()) return [];
        try {
            if (paramStr.trim().startsWith('[') && paramStr.trim().endsWith(']')) {
                return JSON.parse(paramStr);
            }
            const parts = paramStr.split(',').map(p => p.trim());
            return parts.filter(p => p !== '');
        } catch (e) {
            throw new Error('参数格式解析失败，请使用 JSON 数组格式，例如 ["arg1", 123]');
        }
    };

    const processParams = (params, walletAddress) => {
        if (!Array.isArray(params)) return params;
        return params.map(p => {
            if (typeof p === 'string' && p.trim() === '{self}') {
                return walletAddress;
            }
            return p;
        });
    };

    const executeTask = async (taskIndex) => {
        const task = tasks[taskIndex];
        const rpcList = getRpcList();

        if (!addressInput && !project) return;
        if (!contractAddress || !abiContent || !methodName) {
            // Only check these if we are running
            return;
        }

        setTasks(prev => {
            const next = [...prev];
            next[taskIndex] = { ...next[taskIndex], status: 'processing', error: '', txHash: '' };
            return next;
        });

        try {
            // 1. Setup Provider & Wallet (Retry logic implied by iterating RPCs)
            let wallet = null;
            let provider = null;
            let lastError = null;

            // Simple RPC Failover
            for (const rpc of rpcList) {
                try {
                    const p = new ethers.JsonRpcProvider(rpc);
                    const w = new ethers.Wallet(task.privKey, p);
                    // Test connection
                    await p.getNetwork();
                    provider = p;
                    wallet = w;
                    break;
                } catch (e) {
                    lastError = e;
                }
            }

            if (!wallet) throw lastError || new Error('所有 RPC连接失败');

            // 2. Setup Contract
            let parsedAbi = abiContent;
            try {
                if (typeof abiContent === 'string' && abiContent.trim().startsWith('[')) {
                    parsedAbi = JSON.parse(abiContent);
                }
            } catch (e) {
                // Ignore parse error, let ethers handle it
            }

            const contract = new ethers.Contract(contractAddress, parsedAbi, wallet);

            // Safer function lookup
            let fragment = null;
            let isView = false;
            try {
                fragment = contract.interface.getFunction(methodName);
                isView = fragment && (fragment.stateMutability === 'view' || fragment.stateMutability === 'pure');
            } catch (e) {
                console.warn("Function lookup warning:", e);
                if (!contract[methodName]) {
                    throw new Error(`方法 ${methodName} 未在ABI中找到`);
                }
            }

            const func = contract[methodName];
            if (!func) throw new Error(`方法 ${methodName} 不存在`);

            // 3. Process Params with Placeholder
            const rawParams = parseParams(methodParams);
            const params = processParams(rawParams, task.address);

            // 4. Gas Setup
            const feeData = await provider.getFeeData();
            let overrides = {};

            const boost = parseFloat(gasBoost);
            if (!isNaN(boost) && boost > 0) {
                const boostWei = ethers.parseUnits(boost.toString(), 'gwei');
                if (feeData.maxFeePerGas) {
                    overrides.maxFeePerGas = feeData.maxFeePerGas + boostWei;
                    overrides.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas + boostWei;
                } else {
                    overrides.gasPrice = (feeData.gasPrice || 0n) + boostWei;
                }
            }

            // 5. Call
            // Check if it's a view function or write function
            // We can try staticCall first? NO, user might want to write.
            // Ethers handles this: if method is constant/view, it calls; else it sends transaction.
            // But we generally want 'sendTransaction' flow here for "On-Chain".
            // If it's a view, it returns result immediately.

            // 5. Call
            if (isView) {
                const result = await func(...params);
                // Handle result if it's an object or array (ethers v6 often returns Result object)
                const displayResult = result.toString ? result.toString() : JSON.stringify(result);
                setTasks(prev => {
                    const next = [...prev];
                    next[taskIndex] = { ...next[taskIndex], status: 'success', result: displayResult };
                    return next;
                });
            } else {
                tx = await func(...params, overrides);
                setTasks(prev => {
                    const next = [...prev];
                    next[taskIndex] = { ...next[taskIndex], txHash: tx.hash };
                    return next;
                });

                // Wait for confirmation
                try {
                    await tx.wait();
                    setTasks(prev => {
                        const next = [...prev];
                        next[taskIndex] = { ...next[taskIndex], status: 'success' };
                        return next;
                    });
                } catch (waitErr) {
                    // Timeout or revert on chain
                    setTasks(prev => {
                        const next = [...prev];
                        next[taskIndex] = { ...next[taskIndex], status: 'error', error: '交易发送成功等待确认超时或失败' };
                        return next;
                    });
                }
            }

        } catch (e) {
            setTasks(prev => {
                const next = [...prev];
                next[taskIndex] = { ...next[taskIndex], status: 'error', error: e.shortMessage || e.message };
                return next;
            });
        }
    };

    const handleExecuteAll = async () => {
        if (!contractAddress || !abiContent || !methodName) {
            setMessage({ type: 'error', text: '请填写完整的合约信息 (地址, ABI, 方法名)' });
            return;
        }

        const pending = tasks.map((t, i) => t.status !== 'success' ? i : -1).filter(i => i !== -1);
        if (pending.length === 0) return;

        setExecuting(true);
        // Execute sequentially to avoid nonce issues if same wallet (unlikely here) or RPC rate limits
        for (const i of pending) {
            await executeTask(i);
            // Small sleep
            await new Promise(r => setTimeout(r, 500));
        }
        setExecuting(false);
        setMessage({ type: 'success', text: '批量执行完成' });
    };

    const handleExport = () => {
        if (tasks.length === 0) return;

        // Define CSV headers
        const headers = ["Index", "Address", "Status", "Result/Hash", "Error"];

        // Map tasks to CSV rows
        const rows = tasks.map((task, i) => [
            i + 1,
            task.address,
            task.status,
            task.txHash || task.result || '',
            task.error || ''
        ]);

        // Combine into CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `interaction_results_${Date.now()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="universal-page">
            <div className="universal-header">
                <div className="title-section">
                    <h1>万能上链交互 (Beta)</h1>
                    <p>自定义 ABI 与参数，批量调用任意合约方法</p>
                </div>
                <div className="header-btns">
                    <button className="reset-btn" onClick={() => window.location.reload()}>
                        <RefreshCw size={16} /> 重置
                    </button>
                </div>
            </div>

            <div className="setup-section">
                {/* STEP 1 */}
                <div className="setup-card source-card">
                    <div className="card-tag">STEP 1</div>
                    <h3><Database size={18} /> 钱包数据源</h3>
                    <div className="setup-grid">
                        <div className="input-group full-row">
                            <label>项目筛选</label>
                            <div className="project-autocomplete-container">
                                <input
                                    type="text"
                                    value={project}
                                    onChange={(e) => {
                                        setProject(e.target.value);
                                        setShowProjectDropdown(true);
                                    }}
                                    onFocus={() => setShowProjectDropdown(true)}
                                    placeholder="选择或输入项目..."
                                />
                                {showProjectDropdown && (
                                    <div className="autocomplete-dropdown">
                                        {projects.filter(p => !project || p.toLowerCase().includes(project.toLowerCase())).map((p, index) => (
                                            <div
                                                key={`${p}-${index}`}
                                                className="autocomplete-item"
                                                onClick={() => {
                                                    setProject(p);
                                                    setShowProjectDropdown(false);
                                                }}
                                            >
                                                {p}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="input-group full-row">
                            <label>钱包地址过滤 (可选，每行一个)</label>
                            <textarea
                                placeholder="留空则加载项目所有钱包..."
                                value={addressInput}
                                onChange={(e) => setAddressInput(e.target.value)}
                                style={{ minHeight: '60px' }}
                            />
                        </div>
                        <div className="input-group full-row">
                            <label>项目密码 (用于解密私钥)</label>
                            <PasswordInput value={password} onChange={setPassword} />
                        </div>
                        <button className="fetch-btn" onClick={handleFetchWallets} disabled={loadingWallets}>
                            <Search size={16} className={loadingWallets ? 'spin' : ''} />
                            {loadingWallets ? '正在解密并加载...' : '加载钱包任务'}
                        </button>
                    </div>
                </div>

                {/* STEP 2 */}
                <div className="setup-card config-card">
                    <div className="card-tag">STEP 2</div>
                    <h3><Code2 size={18} /> 合约配置</h3>
                    <div className="setup-grid">
                        <div className="input-group">
                            <label>网络</label>
                            <select onChange={handleNetworkChange}>
                                {COMMON_NETWORKS.map(n => <option key={n.chainId} value={n.chainId}>{n.name}</option>)}
                                <option value="custom">-- 自定义 RPC --</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label>
                                Gas 加注 (Gwei)
                                {currentGasPrice && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>当前: {currentGasPrice}</span>}
                            </label>
                            <input type="text" placeholder="0" value={gasBoost} onChange={(e) => setGasBoost(e.target.value)} />
                        </div>
                        {isCustomRpc && (
                            <div className="input-group full-row">
                                <label>RPC URL</label>
                                <input type="text" value={customRpc} onChange={(e) => setCustomRpc(e.target.value)} />
                            </div>
                        )}
                        <div className="input-group full-row">
                            <label>合约地址</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                value={contractAddress}
                                onChange={(e) => setContractAddress(e.target.value)}
                                className="base-input font-mono"
                            />
                        </div>
                        <div className="input-group full-row">
                            <label style={{ justifyContent: 'space-between' }}>
                                ABI JSON
                                <span className="text-xs text-secondary-500 font-normal">例: {`[{"inputs":[],"name":"mint"...}]`}</span>
                            </label>
                            <textarea
                                placeholder="在此粘贴合约 ABI JSON..."
                                value={abiContent}
                                onChange={(e) => setAbiContent(e.target.value)}
                                style={{ fontFamily: 'monospace', fontSize: '12px' }}
                            />
                        </div>
                        <div className="input-group">
                            <label>方法名 (Method)</label>
                            <input type="text" placeholder="e.g. mint" value={methodName} onChange={(e) => setMethodName(e.target.value)} />
                        </div>
                        <div className="input-group">
                            <label>
                                参数 (Params)
                                <div className="tooltip-container">
                                    <HelpCircle size={14} />
                                    <div className="tooltip-content">
                                        支持 JSON 数组格式。<br />
                                        特殊占位符: <span className="tooltip-code">{`{self}`}</span> 代表当前执行钱包地址。<br />
                                        示例: <span className="tooltip-code">{`["{self}", "1000"]`}</span>
                                    </div>
                                </div>
                            </label>
                            <input
                                type="text"
                                placeholder='JSON array e.g. ["{self}", 123]'
                                value={methodParams}
                                onChange={(e) => setMethodParams(e.target.value)}
                            />
                        </div>
                        <div className="full-row" style={{ marginTop: '10px' }}>
                            <button className="execute-btn" style={{ width: '100%' }} onClick={handleExecuteAll} disabled={executing || tasks.length === 0}>
                                <Play size={16} /> 开始批量执行
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="tasks-section">
                <div className="tasks-header">
                    <div className="task-stats">
                        共 <strong>{tasks.length}</strong> 个任务 | 成功 <strong>{tasks.filter(t => t.status === 'success').length}</strong> | 失败 <strong>{tasks.filter(t => t.status === 'error').length}</strong>
                    </div>
                    {tasks.length > 0 && (
                        <div className="task-actions">
                            <button className="reset-btn" onClick={handleExport}>
                                <Download size={16} /> 导出结果
                            </button>
                        </div>
                    )}
                </div>

                <div className="task-table-wrapper">
                    <table className="task-table">
                        <thead>
                            <tr>
                                <th width="50">#</th>
                                <th width="300">钱包地址</th>
                                <th>状态</th>
                                <th>结果 / Hash</th>
                                <th>信息</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tasks.map((task, idx) => (
                                <tr key={idx}>
                                    <td>{idx + 1}</td>
                                    <td className="addr-mono">{task.address}</td>
                                    <td>
                                        <div className={`status-pill ${task.status}`}>
                                            {task.status === 'processing' && <RefreshCw size={12} className="spin" />}
                                            {task.status === 'success' && <CheckCircle size={12} />}
                                            {task.status === 'error' && <AlertCircle size={12} />}
                                            {task.status === 'pending' && '等待'}
                                            {task.status === 'success' ? '成功' : task.status === 'error' ? '失败' : task.status === 'processing' ? '执行中' : '就绪'}
                                        </div>
                                    </td>
                                    <td className="mono-text">
                                        {task.txHash ? (
                                            <a href="#" className="tx-hash" title={task.txHash} onClick={(e) => e.preventDefault()}>{task.txHash.slice(0, 10)}...</a>
                                        ) : (
                                            task.result || '-'
                                        )}
                                    </td>
                                    <td style={{ color: 'var(--error-color)', fontSize: '12px' }}>{task.error}</td>
                                </tr>
                            ))}
                            {tasks.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <Terminal size={40} style={{ opacity: 0.2, marginBottom: '10px' }} />
                                        <div>请先加载钱包任务</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {message && (
                <div className={`toast-msg ${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message.text}
                </div>
            )}
        </div>
    );
}
