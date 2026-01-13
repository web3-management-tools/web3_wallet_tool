import React, { useState, useEffect } from 'react';
import {
  Send,
  Settings,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Database,
  FileText,
  FileSpreadsheet,
  RotateCcw,
  Key,
  UserCheck,
  Coins
} from 'lucide-react';
import { ethers } from 'ethers';
import * as XLSX from 'xlsx';
import { walletList } from '../../api/wallet';
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

export default function Distribution() {
  const [password, setPassword] = useState('');
  const [sourceAddress, setSourceInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [sourceInfo, setSourceInfo] = useState(null);
  
  const [network, setNetwork] = useState(COMMON_NETWORKS[0]);
  const [customRpc, setCustomRpc] = useState('');
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  
  // Token states
  const [tokenType, setTokenType] = useState('native');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [randomRange, setRandomRange] = useState({ min: '', max: '' });
  const [transferTasks, setTransferTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getActiveRpc = () => isCustomRpc ? customRpc : network.rpc;

  // Auto fetch token info
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

  const handleVerifySource = async () => {
    if (!password || !sourceAddress.trim()) {
      setMessage({ type: 'error', text: '请输入源地址和钱包密码' });
      return;
    }
    setVerifying(true);
    setSourceInfo(null);
    try {
      const res = await walletList({ address: sourceAddress.trim(), pwd: password });
      if (res.success && res.data && res.data.length > 0) {
        const w = res.data[0];
        const privKey = await decryptPrivateKey(w.privateKey);
        setSourceInfo({ address: w.address, privKey, verified: true });
        setMessage({ type: 'success', text: '源钱包私钥校验成功' });
      } else {
        setMessage({ type: 'error', text: '地址未找到或密码错误' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '解密失败：' + e.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleGenerateTasks = () => {
    if (!sourceInfo || !sourceInfo.verified) {
      setMessage({ type: 'error', text: '请先完成源钱包校验' });
      return;
    }
    if (!targetInput.trim()) {
      setMessage({ type: 'error', text: '请输入目标地址列表' });
      return;
    }

    const targets = targetInput.split('\n').map(a => a.trim()).filter(a => a);
    if (targets.length === 0) return;

    const min = parseFloat(randomRange.min) || 0;
    const max = parseFloat(randomRange.max) || 0;

    const tasks = targets.map(target => {
      const amount = (min === max) ? min.toString() : (Math.random() * (max - min) + min).toFixed(6);
      return {
        from: sourceInfo.address,
        privKey: sourceInfo.privKey,
        to: target,
        amount: amount,
        status: 'pending',
        txHash: '',
        error: '',
        selected: true
      };
    });

    setTransferTasks(tasks);
    setMessage({ type: 'success', text: `已为 ${tasks.length} 个目标生成分发任务` });
  };

  const executeTransfer = async (index) => {
    const task = transferTasks[index];
    const rpcUrl = getActiveRpc();
    if (!task.to || parseFloat(task.amount) <= 0 || !rpcUrl) {
      updateTask(index, { status: 'error', error: '无效配置或金额' });
      return;
    }
    updateTask(index, { status: 'processing', error: '' });
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(task.privKey, provider);
      
      let tx;
      if (tokenType === 'native') {
        tx = await wallet.sendTransaction({ to: task.to, value: ethers.parseEther(task.amount) });
      } else {
        const abi = ["function transfer(address to, uint256 amount) public returns (bool)"];
        const contract = new ethers.Contract(tokenAddress, abi, wallet);
        tx = await contract.transfer(task.to, ethers.parseUnits(task.amount, tokenDecimals));
      }
      
      updateTask(index, { txHash: tx.hash });
      await tx.wait();
      updateTask(index, { status: 'success' });
    } catch (e) {
      updateTask(index, { status: 'error', error: e.shortMessage || e.message });
    }
  };

  const executeAll = async () => {
    const ready = transferTasks.map((t, i) => t.selected && t.status !== 'success' ? i : -1).filter(i => i !== -1);
    if (ready.length === 0) return;
    setLoading(true);
    for (const i of ready) await executeTransfer(i);
    setLoading(false);
    setMessage({ type: 'success', text: '批量分发执行完毕' });
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
      '目标地址': t.to,
      '分发金额': t.amount,
      '资产': tokenType === 'native' ? '原生币' : tokenSymbol,
      '交易哈希': t.txHash || '',
      '错误信息': t.error || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Distribution Results");
    XLSX.writeFile(wb, `dist_1_to_n_${new Date().getTime()}.xlsx`);
  };

  const updateTask = (index, updates) => {
    setTransferTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  return (
    <div className="dist-page">
      <div className="transfer-header">
        <div className="title-section">
          <h1>钱包对等分发 (1对多)</h1>
          <p>支持多链原生币及 ERC20 代币的灵活分发</p>
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

      <section className="setup-section-dist">
        <div className="setup-card source-verify-card">
          <div className="card-tag">STEP 1</div>
          <h3><UserCheck size={18} /> 源钱包验证</h3>
          <div className="verify-grid">
            <div className="input-group">
              <label>源钱包地址</label>
              <input value={sourceAddress} onChange={(e) => setSourceInput(e.target.value)} placeholder="0x..." />
            </div>
            <div className="input-group">
              <label>钱包支付密码</label>
              <PasswordInput value={password} onChange={setPassword} />
            </div>
            <button className="verify-btn" onClick={handleVerifySource} disabled={verifying}>
              <RefreshCw size={16} className={verifying ? 'spin' : ''} /> 校验并获取私钥
            </button>
          </div>
          
          {sourceInfo && (
            <div className="source-status-box">
              <div className="status-header">
                <CheckCircle size={14} color="var(--success-color)" />
                <span>私钥获取成功</span>
              </div>
              <div className="priv-preview">
                <Key size={12} />
                <code>{sourceInfo.privKey.slice(0,6)}********************************{sourceInfo.privKey.slice(-4)}</code>
              </div>
            </div>
          )}
        </div>

        <div className="setup-card config-card-dist">
          <div className="card-tag">STEP 2</div>
          <h3><Settings size={18} /> 分发参数</h3>
          <div className="dist-config-grid-v">
            <div className="input-group">
              <label>网络环境</label>
              <select onChange={handleNetworkChange}>
                {COMMON_NETWORKS.map(n => <option key={n.chainId} value={n.chainId}>{n.name}</option>)}
                <option value="custom">-- 自定义 RPC --</option>
              </select>
            </div>
            {isCustomRpc && <input className="rpc-input" type="text" value={customRpc} onChange={(e) => setCustomRpc(e.target.value)} placeholder="RPC 地址" />}
            
            <div className="input-group">
              <label>资产类型</label>
              <div className="type-toggle">
                <button className={tokenType === 'native' ? 'active' : ''} onClick={() => setTokenType('native')}>原生币</button>
                <button className={tokenType === 'erc20' ? 'active' : ''} onClick={() => setTokenType('erc20')}>ERC20</button>
              </div>
            </div>

            {tokenType === 'erc20' && (
              <div className="input-group">
                <label>合约地址</label>
                <div className="token-info-input">
                  <input type="text" placeholder="0x..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
                  {tokenSymbol && <span className="token-badge">{tokenSymbol}</span>}
                </div>
              </div>
            )}

            <div className="input-group">
              <label>分发金额 (随机区间)</label>
              <div className="range-box-dist">
                <input type="text" placeholder="Min" value={randomRange.min} onChange={(e) => setRandomRange({...randomRange, min: e.target.value})} />
                <span>-</span>
                <input type="text" placeholder="Max" value={randomRange.max} onChange={(e) => setRandomRange({...randomRange, max: e.target.value})} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="target-input-section">
        <div className="action-card">
          <div className="card-tag">STEP 3</div>
          <h3><FileText size={18} /> 批量录入目标地址</h3>
          <div className="target-form-body">
            <textarea 
              value={targetInput} 
              onChange={(e) => setTargetInput(e.target.value)} 
              placeholder={`请在此输入目标地址列表...\n每行一个地址`}
              rows={8}
            />
            <button className="generate-tasks-btn" onClick={handleGenerateTasks} disabled={!sourceInfo}>
              生成任务列表
            </button>
          </div>
        </div>
      </section>

      <section className="tasks-section">
        <div className="tasks-container">
          <div className="tasks-header">
            <h3><Database size={18} /> 执行列表 ({transferTasks.length})</h3>
            <div className="task-actions">
              <button className="retry-btn" onClick={retryFailed} disabled={loading || !transferTasks.some(t => t.status === 'error')}>
                <RotateCcw size={16} /> 重试失败
              </button>
              <button className="run-all-btn" onClick={executeAll} disabled={loading || transferTasks.length === 0}>
                <Send size={16} /> 批量执行
              </button>
            </div>
          </div>

          <div className="task-table-wrapper">
            {transferTasks.length > 0 ? (
              <table className="task-table">
                <thead>
                  <tr>
                    <th width="40"><input type="checkbox" checked={transferTasks.every(t => t.selected)} onChange={(e) => setTransferTasks(prev => prev.map(t => ({...t, selected: e.target.checked})))} /></th>
                    <th width="80">状态</th>
                    <th>目标钱包</th>
                    <th width="150">分发金额</th>
                    <th width="100">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {transferTasks.map((task, index) => (
                    <tr key={index} className={`task-row ${task.status} ${!task.selected ? 'unselected' : ''}`}>
                      <td><input type="checkbox" checked={task.selected} onChange={(e) => updateTask(index, {selected: e.target.checked})} /></td>
                      <td>
                        <div className={`status-pill ${task.status}`}>
                          {task.status === 'processing' && <RefreshCw size={12} className="spin" />}
                          {task.status === 'success' && <CheckCircle size={12} />}
                          {task.status === 'error' && <AlertCircle size={12} title={task.error} />}
                          {task.status === 'pending' && '就绪'}
                        </div>
                      </td>
                      <td className="mono">{task.to}</td>
                      <td className="amount-val">{task.amount} {tokenType === 'native' ? 'Native' : tokenSymbol}</td>
                      <td>
                        <div className="row-actions">
                          {task.txHash && <a href={`${getActiveRpc()?.includes('sepolia') ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'}/tx/${task.txHash}`} target="_blank" rel="noreferrer" className="tx-link-sm">TX</a>}
                          <button className="send-single-btn" onClick={() => executeTransfer(index)} disabled={task.status === 'processing'}>发送</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="placeholder">请完成上方配置并点击“生成任务列表”</div>
            )}
          </div>
        </div>
      </section>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
