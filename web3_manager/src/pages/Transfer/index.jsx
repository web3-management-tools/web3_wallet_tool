import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Settings, 
  Shield, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  ArrowRight,
  Coins,
  Wallet as WalletIcon,
  Dice5,
  MinusCircle,
  Network,
  Database,
  Info,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { ethers } from 'ethers';
import * as XLSX from 'xlsx';
import { walletList, getWalletProjects, batchQueryMapping } from '../../api/wallet';
import { decryptPrivateKey } from '../../utils/crypto';
import PasswordInput from '../../components/PasswordInput';
import './index.css';

const COMMON_NETWORKS = [
  { name: 'Ethereum Mainnet', chainId: 1, rpc: 'https://eth.llamarpc.com' },
  { name: 'BSC Mainnet', chainId: 56, rpc: 'https://binance.llamarpc.com' },
  { name: 'Polygon Mainnet', chainId: 137, rpc: 'https://polygon.llamarpc.com' },
  { name: 'Arbitrum One', chainId: 42161, rpc: 'https://arbitrum.llamarpc.com' },
  { name: 'Optimism', chainId: 10, rpc: 'https://optimism.llamarpc.com' },
  { name: 'Sepolia Testnet', chainId: 11155111, rpc: 'https://rpc.sepolia.org' },
];

export default function Transfer() {
  const [password, setPassword] = useState('');
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [network, setNetwork] = useState(COMMON_NETWORKS[0]);
  const [customRpc, setCustomRpc] = useState('');
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [tokenType, setTokenType] = useState('native');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [amountMode, setAmountMode] = useState('fixed');
  const [batchAmount, setBatchAmount] = useState('');
  const [randomRange, setRandomRange] = useState({ min: '', max: '' });
  const [remainAmount, setRemainAmount] = useState('');
  const [transferTasks, setTransferTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingBalances, setFetchingBalances] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => { loadProjects(); }, []);

  // 消息自动消失逻辑
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getActiveRpc = () => isCustomRpc ? customRpc : network.rpc;

  useEffect(() => {
    if (tokenType === 'erc20' && ethers.isAddress(tokenAddress)) {
      const rpcUrl = getActiveRpc();
      if (rpcUrl) {
        const fetchTokenInfo = async (addr) => {
          try {
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const abi = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
            const contract = new ethers.Contract(addr, abi, provider);
            const [symbol, decimals] = await Promise.all([contract.symbol(), contract.decimals()]);
            setTokenSymbol(symbol);
            setTokenDecimals(Number(decimals));
          } catch (e) { console.error(e); }
        };
        fetchTokenInfo(tokenAddress);
      }
    }
  }, [tokenAddress, tokenType, network, customRpc, isCustomRpc]);

  const loadProjects = async () => {
    const res = await getWalletProjects();
    if (res.success) setProjects(res.data || []);
  };

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
    if (!password || !project) {
      setMessage({ type: 'error', text: '请先选择项目并输入钱包密码' });
      return;
    }
    setLoading(true);
    try {
      const res = await walletList({ project, pwd: password });
      if (res.success) {
        const wallets = res.data || [];
        const decrypted = await Promise.all(wallets.map(async w => ({
          ...w, privKey: await decryptPrivateKey(w.privateKey)
        })));
        const sourceAddresses = decrypted.map(w => w.address);
        const mappingRes = await batchQueryMapping(sourceAddresses);
        const mappingMap = Object.fromEntries((mappingRes.data || []).map(m => [m.sourceAddress.toLowerCase(), m.targetAddress]));
        const tasks = decrypted.map(w => ({
          from: w.address, privKey: w.privKey, to: mappingMap[w.address.toLowerCase()] || '',
          balance: '0', amount: '', status: 'pending', txHash: '', error: '', selected: true
        }));
        setTransferTasks(tasks);
        fetchBalances(tasks);
        setMessage({ type: 'success', text: `成功加载 ${tasks.length} 个钱包数据` });
      } else { setMessage({ type: 'error', text: res.msg }); }
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  };

  const fetchBalances = async (currentTasks) => {
    const rpcUrl = getActiveRpc();
    if (!rpcUrl || currentTasks.length === 0) return;
    setFetchingBalances(true);
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const updatedTasks = await Promise.all(currentTasks.map(async (task) => {
        try {
          if (tokenType === 'native') {
            const balance = await provider.getBalance(task.from);
            return { ...task, balance: ethers.formatEther(balance) };
          } else {
            const abi = ["function balanceOf(address) view returns (uint256)"];
            const contract = new ethers.Contract(tokenAddress, abi, provider);
            const balance = await contract.balanceOf(task.from);
            return { ...task, balance: ethers.formatUnits(balance, tokenDecimals) };
          }
        } catch (e) { return task; }
      }));
      setTransferTasks(updatedTasks);
    } finally { setFetchingBalances(false); }
  };

  const calculateAmount = (task) => {
    if (amountMode === 'fixed') return task.amount || batchAmount;
    if (amountMode === 'full') {
      const b = parseFloat(task.balance);
      if (tokenType === 'native') return b > 0.001 ? (b - 0.001).toFixed(6) : '0';
      return b.toString();
    }
    if (amountMode === 'random') {
      const min = parseFloat(randomRange.min), max = parseFloat(randomRange.max);
      if (isNaN(min) || isNaN(max)) return '0';
      return (Math.random() * (max - min) + min).toFixed(6);
    }
    if (amountMode === 'remaining') {
      const keep = parseFloat(remainAmount), bal = parseFloat(task.balance);
      return bal > keep ? (bal - keep).toFixed(6) : '0';
    }
    return task.amount;
  };

  const executeTransfer = async (index) => {
    const task = transferTasks[index];
    const amount = calculateAmount(task);
    const rpcUrl = getActiveRpc();
    if (!task.to || parseFloat(amount) <= 0 || !rpcUrl) {
      updateTask(index, { status: 'error', error: '无效配置、地址或余额不足' });
      return;
    }
    updateTask(index, { status: 'processing', error: '', amount });
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(task.privKey, provider);
      let tx;
      if (tokenType === 'native') {
        tx = await wallet.sendTransaction({ to: task.to, value: ethers.parseEther(amount) });
      } else {
        const abi = ["function transfer(address to, uint256 amount) public returns (bool)"];
        const contract = new ethers.Contract(tokenAddress, abi, wallet);
        tx = await contract.transfer(task.to, ethers.parseUnits(amount, tokenDecimals));
      }
      updateTask(index, { txHash: tx.hash });
      await tx.wait();
      updateTask(index, { status: 'success' });
    } catch (e) { updateTask(index, { status: 'error', error: e.shortMessage || e.message }); }
  };

  const executeAll = async () => {
    const ready = transferTasks.map((t, i) => t.selected && t.status !== 'success' && t.to ? i : -1).filter(i => i !== -1);
    if (ready.length === 0) {
      setMessage({ type: 'error', text: '没有选中的待执行任务' });
      return;
    }
    setLoading(true);
    for (const i of ready) await executeTransfer(i);
    setLoading(false);
    setMessage({ type: 'success', text: '批量转账任务执行完毕' });
  };

  const retryFailed = async () => {
    const failed = transferTasks.map((t, i) => t.selected && t.status === 'error' ? i : -1).filter(i => i !== -1);
    if (failed.length === 0) return;
    setLoading(true);
    for (const i of failed) await executeTransfer(i);
    setLoading(false);
  };

  const handleExportResults = () => {
    if (transferTasks.length === 0) return;
    const data = transferTasks.map(t => ({
      '状态': t.status,
      '发送方': t.from,
      '接收方': t.to,
      '金额': t.amount,
      '资产': tokenType === 'native' ? '原生币' : tokenSymbol,
      '交易哈希': t.txHash || '',
      '错误信息': t.error || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transfer Results");
    XLSX.writeFile(wb, `transfer_results_${new Date().getTime()}.xlsx`);
  };

  const updateTask = (index, updates) => {
    setTransferTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const toggleSelectAll = (checked) => {
    setTransferTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  return (
    <div className="transfer-page">
      <div className="transfer-header">
        <div className="title-section">
          <h1>批量转账管理</h1>
          <p>支持多链原生币及 ERC20 代币的一对多灵活分发</p>
        </div>
        <div className="header-btns">
          <button className="export-results-btn" onClick={handleExportResults} disabled={transferTasks.length === 0}>
            <FileSpreadsheet size={16} /> 导出结果
          </button>
          <button className="reset-btn" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> 重置
          </button>
        </div>
      </div>

      <section className="setup-section">
        <div className="setup-card source-card">
          <div className="card-tag">STEP 1</div>
          <h3><Database size={18} /> 数据源与安全</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>源项目</label>
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">请选择项目</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>钱包密码</label>
              <PasswordInput value={password} onChange={setPassword} />
            </div>
            <button className="fetch-btn" onClick={handleFetchWallets} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> 
              {loading ? '加载中...' : '加载钱包与余额'}
            </button>
          </div>
        </div>

        <div className="setup-card config-card">
          <div className="card-tag">STEP 2</div>
          <h3><Network size={18} /> 网络与资产</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>网络环境</label>
              <select onChange={handleNetworkChange}>
                {COMMON_NETWORKS.map(n => <option key={n.chainId} value={n.chainId}>{n.name}</option>)}
                <option value="custom">-- 自定义 RPC --</option>
              </select>
            </div>
            <div className="input-group">
              <label>代币类型</label>
              <div className="type-toggle">
                <button className={tokenType === 'native' ? 'active' : ''} onClick={() => setTokenType('native')}>原生币</button>
                <button className={tokenType === 'erc20' ? 'active' : ''} onClick={() => setTokenType('erc20')}>ERC20</button>
              </div>
            </div>
            {isCustomRpc && (
              <div className="input-group full-row">
                <label>RPC 节点地址</label>
                <input type="text" placeholder="https://..." value={customRpc} onChange={(e) => setCustomRpc(e.target.value)} />
              </div>
            )}
            {tokenType === 'erc20' && (
              <div className="input-group full-row">
                <label>合约地址</label>
                <div className="token-info-input">
                  <input type="text" placeholder="0x..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
                  {tokenSymbol && <span className="token-badge">{tokenSymbol} ({tokenDecimals})</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="tasks-section">
        <div className="tasks-container">
          <div className="tasks-header">
            <div className="execution-modes">
              <div className="mode-tabs">
                <button className={amountMode === 'fixed' ? 'active' : ''} onClick={() => setAmountMode('fixed')}><WalletIcon size={14}/> 固定</button>
                <button className={amountMode === 'full' ? 'active' : ''} onClick={() => setAmountMode('full')}><CheckCircle size={14}/> 全额</button>
                <button className={amountMode === 'random' ? 'active' : ''} onClick={() => setAmountMode('random')}><Dice5 size={14}/> 随机</button>
                <button className={amountMode === 'remaining' ? 'active' : ''} onClick={() => setAmountMode('remaining')}><MinusCircle size={14}/> 剩余</button>
              </div>
              
              <div className="mode-params">
                {amountMode === 'fixed' && <input type="text" placeholder="金额" value={batchAmount} onChange={(e) => setBatchAmount(e.target.value)} />}
                {amountMode === 'random' && (
                  <div className="range-box">
                    <input type="text" placeholder="Min" value={randomRange.min} onChange={(e) => setRandomRange({...randomRange, min: e.target.value})} />
                    <span>-</span>
                    <input type="text" placeholder="Max" value={randomRange.max} onChange={(e) => setRandomRange({...randomRange, max: e.target.value})} />
                  </div>
                )}
                {amountMode === 'remaining' && <input type="text" placeholder="保留" value={remainAmount} onChange={(e) => setRemainAmount(e.target.value)} />}
                <div className="task-actions">
                  <button className="retry-btn" onClick={retryFailed} disabled={loading || !transferTasks.some(t => t.selected && t.status === 'error')}>
                    <RotateCcw size={16} /> 重试失败
                  </button>
                  <button className="run-all-btn" onClick={executeAll} disabled={loading || fetchingBalances || transferTasks.length === 0}>
                    <Send size={16} /> 批量执行
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="task-grid-view">
            {transferTasks.length > 0 ? (
              <div className="task-table-wrapper">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th width="40">
                        <input 
                          type="checkbox" 
                          checked={transferTasks.length > 0 && transferTasks.every(t => t.selected)} 
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th width="80">状态</th>
                      <th>发送方 (余额)</th>
                      <th width="40"></th>
                      <th>接收方</th>
                      <th width="150">转账金额</th>
                      <th width="120">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferTasks.map((task, index) => (
                      <tr key={index} className={`task-row ${task.status} ${!task.selected ? 'unselected' : ''}`}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={task.selected} 
                            onChange={(e) => updateTask(index, { selected: e.target.checked })} 
                          />
                        </td>
                        <td>
                          <div className={`status-pill ${task.status}`}>
                            {task.status === 'processing' && <RefreshCw size={12} className="spin" />}
                            {task.status === 'success' && <CheckCircle size={12} />}
                            {task.status === 'error' && <AlertCircle size={12} title={task.error} />}
                            {task.status === 'pending' && '等待'}
                          </div>
                        </td>
                        <td>
                          <div className="wallet-info">
                            <span className="addr-mono">{task.from.slice(0,6)}...{task.from.slice(-4)}</span>
                            <span className="bal-text">
                              {fetchingBalances ? '...' : parseFloat(task.balance).toFixed(4)} {tokenType === 'native' ? 'ETH' : tokenSymbol}
                            </span>
                          </div>
                        </td>
                        <td><ArrowRight size={14} className="sep-icon" /></td>
                        <td>
                          <input 
                            type="text" 
                            className="inline-addr-input" 
                            value={task.to} 
                            onChange={(e) => updateTask(index, { to: e.target.value })}
                            placeholder="目标地址"
                          />
                        </td>
                        <td>
                          <div className="amount-cell">
                            {amountMode === 'fixed' ? (
                              <input type="text" value={task.amount || batchAmount} onChange={(e) => updateTask(index, { amount: e.target.value })} />
                            ) : (
                              <span className="auto-val">{calculateAmount(task)}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="row-actions">
                            {task.txHash && <a href={`${getActiveRpc()?.includes('sepolia') ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'}/tx/${task.txHash}`} target="_blank" rel="noreferrer" className="tx-tag">TX</a>}
                            <button className="send-single-btn" onClick={() => executeTransfer(index)} disabled={task.status === 'processing'}>
                              发送
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tasks-placeholder">
                <div className="empty-icon"><Database size={48} /></div>
                <p>请完成 STEP 1 加载钱包数据</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
