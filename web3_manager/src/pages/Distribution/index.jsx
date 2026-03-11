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
  { name: 'Sepolia Testnet', chainId: 11155111, rpcs: ['https://rpc.sepolia.org', 'https://sepolia.public.blastapi.io'] },
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
  const [sleepRange, setSleepRange] = useState({ min: '', max: '' });
  const [gasBoost, setGasBoost] = useState('0'); // Gwei
  const [currentGasPrice, setCurrentGasPrice] = useState(null);

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

  const getRpcList = () => {
    if (isCustomRpc) return [customRpc];
    const currentDef = COMMON_NETWORKS.find(n => n.chainId === network.chainId);
    return currentDef?.rpcs || [network.rpc];
  };
  const getActiveRpc = () => getRpcList()[0];

  // 自动刷新 Gas
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
    const interval = setInterval(fetchGas, 5000);
    return () => clearInterval(interval);
  }, [network, isCustomRpc, customRpc]);

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
        let validWallet = null;
        let validPk = '';

        // 遍历所有返回的钱包，尝试解密直到找到一个有效的
        for (const w of res.data) {
          try {
            const pk = await decryptPrivateKey(w.privateKey);
            if (pk && pk.length >= 64) {
              // 简单验证是否是有效私钥格式
              new ethers.Wallet(pk);
              validWallet = w;
              validPk = pk;
              break; // 找到第一个有效的就停止
            }
          } catch (e) {
            continue; // 解密失败则尝试下一个
          }
        }

        if (validWallet) {
          setSourceInfo({ address: validWallet.address, privKey: validPk, verified: true });
          setMessage({ type: 'success', text: '源钱包私钥校验成功' });
        } else {
          throw new Error('未找到有效的私钥，请检查密码或钱包文件');
        }
      } else {
        setMessage({ type: 'error', text: '地址未找到或密码错误' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: '校验失败：' + e.message });
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
    const rpcList = getRpcList();

    // 地址规范化
    let toAddr, tokenAddr;
    try {
      toAddr = ethers.getAddress(task.to);
      if (tokenType === 'erc20') tokenAddr = ethers.getAddress(tokenAddress);
    } catch (e) {
      // Fallback
      toAddr = task.to;
      tokenAddr = tokenAddress;
    }

    if (!toAddr || parseFloat(task.amount) <= 0 || rpcList.length === 0) {
      updateTask(index, { status: 'error', error: '无效配置或金额' });
      return;
    }
    updateTask(index, { status: 'processing', error: '' });

    let lastError;
    for (const rpcUrl of rpcList) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(task.privKey, provider);

        // Gas 准备
        const feeData = await provider.getFeeData();
        let finalMaxFee = feeData.maxFeePerGas;
        let finalPriority = feeData.maxPriorityFeePerGas;
        let finalGasPrice = feeData.gasPrice;

        const boostVal = parseFloat(gasBoost);
        if (!isNaN(boostVal) && boostVal > 0) {
          const addAmount = ethers.parseUnits(boostVal.toString(), 'gwei');
          if (finalMaxFee) { finalMaxFee += addAmount; finalPriority += addAmount; }
          if (finalGasPrice) { finalGasPrice += addAmount; }
        }

        // Estimate Gas
        let gasLimit;
        let txRequest = {};
        try {
          if (tokenType === 'native') {
            txRequest = { to: toAddr, value: ethers.parseEther(task.amount) };
            gasLimit = await provider.estimateGas({ ...txRequest, from: wallet.address });
          } else {
            const contract = new ethers.Contract(tokenAddr, ["function transfer(address to, uint256 amount) public returns (bool)"], wallet);
            txRequest = await contract.transfer.populateTransaction(toAddr, ethers.parseUnits(task.amount, tokenDecimals));
            gasLimit = await provider.estimateGas(txRequest);
          }
          gasLimit = (gasLimit * 110n) / 100n; // 10% buffer
        } catch (e) {
          console.warn("Est gas failed", e);
          gasLimit = tokenType === 'native' ? 21000n : 100000n;
        }

        // 余额检查逻辑
        const currentGasPriceVal = finalMaxFee || finalGasPrice;
        if (!currentGasPriceVal) throw new Error('无法获取Gas价格');
        const estimatedGasCost = gasLimit * currentGasPriceVal;

        const sendAmountBigInt = ethers.parseUnits(task.amount, tokenType === 'native' ? 18 : tokenDecimals);

        if (tokenType === 'native') {
          const balanceBigInt = await provider.getBalance(wallet.address);
          const totalNeed = sendAmountBigInt + estimatedGasCost;
          if (balanceBigInt < totalNeed) {
            const missing = ethers.formatEther(totalNeed - balanceBigInt);
            throw new Error(`余额不足 (缺 ${parseFloat(missing).toFixed(6)} ETH/Native 支付金额+Gas)`);
          }
        } else {
          // ERC20
          const contract = new ethers.Contract(tokenAddr, ["function balanceOf(address) view returns (uint256)"], wallet);
          const [tokenBal, nativeBal] = await Promise.all([
            contract.balanceOf(wallet.address),
            provider.getBalance(wallet.address)
          ]);

          if (tokenBal < sendAmountBigInt) {
            const missing = ethers.formatUnits(sendAmountBigInt - tokenBal, tokenDecimals);
            throw new Error(`代币余额不足 (缺 ${missing} ${tokenSymbol})`);
          }
          if (nativeBal < estimatedGasCost) {
            throw new Error(`ETH/Native余额不足以支付Gas费`);
          }
        }

        // Send
        let tx;
        const txOptions = {
          gasLimit,
          maxFeePerGas: finalMaxFee,
          maxPriorityFeePerGas: finalPriority,
          ...(finalGasPrice && !finalMaxFee ? { gasPrice: finalGasPrice } : {})
        };

        if (tokenType === 'native') {
          tx = await wallet.sendTransaction({ to: toAddr, value: ethers.parseEther(task.amount), ...txOptions });
        } else {
          const contract = new ethers.Contract(tokenAddr, ["function transfer(address to, uint256 amount) public returns (bool)"], wallet);
          tx = await contract.transfer(toAddr, ethers.parseUnits(task.amount, tokenDecimals), txOptions);
        }

        updateTask(index, { txHash: tx.hash });

        // Wait with Timeout
        try {
          const waitPromise = tx.wait();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Wait Timeout')), 120000));
          await Promise.race([waitPromise, timeoutPromise]);
          updateTask(index, { status: 'success' });
        } catch (waitErr) {
          updateTask(index, { status: 'success', error: '已发送(确认超时)' });
        }
        return; // Success, exit retry loop

      } catch (e) {
        lastError = e;
        console.warn(`RPC ${rpcUrl} failed`, e);
        if (e.message && (e.message.includes('余额不足') || e.message.includes('insufficient funds'))) break;
      }
    }

    let msg = lastError?.shortMessage || lastError?.message || 'Failed';
    if (msg.includes('could not coalesce')) msg = 'RPC无响应';
    updateTask(index, { status: 'error', error: msg });
  };

  const executeAll = async () => {
    const ready = transferTasks.map((t, i) => t.selected && t.status !== 'success' ? i : -1).filter(i => i !== -1);
    if (ready.length === 0) return;
    setLoading(true);

    // Parse sleep range
    const minSleep = parseFloat(sleepRange.min) || 0;
    const maxSleep = parseFloat(sleepRange.max) || 0;

    for (let j = 0; j < ready.length; j++) {
      const i = ready[j];

      // Sleep before execution (except for the first one, or maybe before every one? 
      // Logic in Transfer page usually sleeps *between* tasks. 
      // So if j > 0, sleep.)
      if (j > 0 && (minSleep > 0 || maxSleep > 0)) {
        const duration = (minSleep === maxSleep)
          ? minSleep
          : Math.random() * (maxSleep - minSleep) + minSleep;
        if (duration > 0) {
          // console.log(`Sleeping for ${duration}s...`);
          await new Promise(r => setTimeout(r, duration * 1000));
        }
      }

      await executeTransfer(i);
    }
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
          <h1>EVM钱包对等分发 (1对多)</h1>
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
                <code>{sourceInfo.privKey.slice(0, 6)}********************************{sourceInfo.privKey.slice(-4)}</code>
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

            <div className="dist-row-inputs" style={{ display: 'flex', gap: '15px' }}>
              <div className="input-group" style={{ flex: 1.3 }}>
                <label>分发金额 (随机区间)</label>
                <div className="range-box-dist">
                  <input type="text" placeholder="Min" value={randomRange.min} onChange={(e) => setRandomRange({ ...randomRange, min: e.target.value })} />
                  <span>-</span>
                  <input type="text" placeholder="Max" value={randomRange.max} onChange={(e) => setRandomRange({ ...randomRange, max: e.target.value })} />
                </div>
              </div>

              <div className="input-group" style={{ flex: 1.3 }}>
                <label>任务间隔 (秒)</label>
                <div className="range-box-dist">
                  <input type="text" placeholder="Min" value={sleepRange.min} onChange={(e) => setSleepRange({ ...sleepRange, min: e.target.value })} />
                  <span>-</span>
                  <input type="text" placeholder="Max" value={sleepRange.max} onChange={(e) => setSleepRange({ ...sleepRange, max: e.target.value })} />
                </div>
              </div>

              <div className="input-group" style={{ flex: 1 }}>
                <label>
                  <span style={{ fontSize: '0.85em' }}>Gas加注</span>
                  {currentGasPrice && <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginLeft: '4px' }}>当前:{currentGasPrice}</span>}
                </label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Gwei (例: 2)"
                    value={gasBoost}
                    onChange={(e) => setGasBoost(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
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
                    <th width="40"><input type="checkbox" checked={transferTasks.every(t => t.selected)} onChange={(e) => setTransferTasks(prev => prev.map(t => ({ ...t, selected: e.target.checked })))} /></th>
                    <th width="80">状态</th>
                    <th>目标钱包</th>
                    <th width="150">分发金额</th>
                    <th width="100">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {transferTasks.map((task, index) => (
                    <tr key={index} className={`task-row ${task.status} ${!task.selected ? 'unselected' : ''}`}>
                      <td><input type="checkbox" checked={task.selected} onChange={(e) => updateTask(index, { selected: e.target.checked })} /></td>
                      <td>
                        <div className={`status-pill ${task.status}`}>
                          {task.status === 'processing' && <RefreshCw size={12} className="spin" />}
                          {task.status === 'success' && <CheckCircle size={12} />}
                          {task.status === 'error' && <AlertCircle size={12} title={task.error} />}
                          {task.status === 'pending' && '就绪'}
                        </div>
                        {task.status === 'error' && task.error && (
                          <div
                            className="error-reason-text"
                            title={task.error}
                            style={{ fontSize: '0.75rem', color: 'var(--error-color)', marginTop: '4px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                            onClick={() => {
                              navigator.clipboard.writeText(task.error);
                              setMessage({ type: 'success', text: '错误信息已复制' });
                            }}
                          >
                            {task.error}
                          </div>
                        )}
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
