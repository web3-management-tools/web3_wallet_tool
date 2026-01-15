import React, { useState, useEffect, useCallback } from 'react';
import {
  Coins,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  Database,
  Search
} from 'lucide-react';
import { ethers } from 'ethers';
import * as XLSX from 'xlsx';
import { walletList, getWalletProjects } from '../../api/wallet';
import { handleApiError } from '../../api/errorHandler';
import './index.css';

const COMMON_NETWORKS = [
  { name: 'Ethereum Mainnet', chainId: 1, rpc: 'https://eth.llamarpc.com' },
  { name: 'BSC Mainnet', chainId: 56, rpc: 'https://bsc-dataseed1.binance.org' },
  { name: 'Polygon Mainnet', chainId: 137, rpc: 'https://polygon-rpc.com' },
  { name: 'Arbitrum One', chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc' },
  { name: 'Optimism', chainId: 10, rpc: 'https://mainnet.optimism.io' },
  { name: 'Avalanche C-Chain', chainId: 43114, rpc: 'https://api.avax.network/ext/bc/C/rpc' },
  { name: 'Base', chainId: 8453, rpc: 'https://base.llamarpc.com' },
  { name: 'zkSync Era', chainId: 324, rpc: 'https://zksync-era.public.blastapi.io' },
  { name: 'Linea', chainId: 59144, rpc: 'https://linea.blockpi.network/v1/rpc/public' },
  { name: 'Mantle', chainId: 5000, rpc: 'https://rpc.mantle.xyz' },
  { name: 'Scroll', chainId: 534352, rpc: 'https://rpc.scroll.io' },
  { name: 'OP Mainnet', chainId: 10, rpc: 'https://mainnet.optimism.io' },
  { name: 'Metis', chainId: 1088, rpc: 'https://andromeda.metis.io/?owner=1088' },
];

export default function BalanceCheck() {
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [walletAddresses, setWalletAddresses] = useState('');
  const [network, setNetwork] = useState(COMMON_NETWORKS[0]);
  const [customRpc, setCustomRpc] = useState('');
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [tokenType, setTokenType] = useState('native');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [queryInterval, setQueryInterval] = useState({ min: 0, max: 0 });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // 消息自动消失
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getActiveRpc = () => isCustomRpc ? customRpc : network.rpc;

  const loadProjects = async () => {
    const res = await getWalletProjects();
    if (res.success) {
      setProjects(res.data || []);
    }
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
    // 切换网络时清空代币信息
    setTokenAddress('');
    setTokenSymbol('');
    setTokenDecimals(18);
  };

  const handleQueryTokenInfo = async () => {
    if (tokenType !== 'erc20' || !tokenAddress || !ethers.isAddress(tokenAddress)) {
      setMessage({ type: 'error', text: '请输入有效的代币合约地址' });
      return;
    }

    const rpcUrl = getActiveRpc();
    if (!rpcUrl) {
      setMessage({ type: 'error', text: '请选择网络或输入 RPC 地址' });
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const abi = ["function symbol() view returns (string)", "function decimals() view returns (uint8)"];
      const contract = new ethers.Contract(tokenAddress, abi, provider);
      const [symbol, decimals] = await Promise.all([
        contract.symbol(),
        contract.decimals()
      ]);
      setTokenSymbol(symbol);
      setTokenDecimals(Number(decimals));
      setMessage({ type: 'success', text: `代币信息获取成功: ${symbol} (精度: ${decimals})` });
    } catch (e) {
      setMessage({ type: 'error', text: '获取代币信息失败，请检查合约地址和网络' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTasks = async () => {
    const addresses = walletAddresses
      .split(/[,\n\s]+/)
      .map(a => a.trim())
      .filter(a => ethers.isAddress(a));

    if (addresses.length === 0 && !project) {
      setMessage({ type: 'error', text: '请输入钱包地址或选择项目' });
      return;
    }

    setLoading(true);
    try {
      let allWallets = [];

      if (addresses.length > 0) {
        // 直接使用输入的地址列表
        allWallets = addresses.map((addr, index) => ({
          address: addr,
          index: index + 1
        }));
      }

      if (project) {
        // 从项目获取钱包，密码固定传 1
        const res = await walletList({ project, pwd: '1' });
        if (res.success) {
          const projectWallets = (res.data || []).map(w => ({
            address: w.address,
            project: w.project
          }));
          allWallets = [...allWallets, ...projectWallets];
        } else {
          handleApiError(res, setMessage);
        }
      }

      // 去重
      const uniqueWallets = [];
      const seen = new Set();
      for (const wallet of allWallets) {
        const addr = wallet.address.toLowerCase();
        if (!seen.has(addr)) {
          seen.add(addr);
          uniqueWallets.push({ ...wallet, address: addr });
        }
      }

      // 创建任务列表
      const newTasks = uniqueWallets.map((w, i) => ({
        id: i,
        address: w.address,
        project: w.project || '-',
        nativeBalance: null,
        tokenBalance: null,
        status: 'pending',
        error: '',
        selected: true
      }));

      setTasks(newTasks);
      setMessage({ type: 'success', text: `已生成 ${newTasks.length} 个查询任务` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || '生成任务失败' });
    } finally {
      setLoading(false);
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const getRandomInterval = () => {
    const min = Math.max(0, queryInterval.min * 1000);
    const max = Math.max(min, queryInterval.max * 1000);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const fetchBalance = async (task) => {
    const rpcUrl = getActiveRpc();
    if (!rpcUrl) throw new Error('RPC 未配置');

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // 查询原生币余额
    const nativeBalance = await provider.getBalance(task.address);
    const nativeBalanceFormatted = ethers.formatEther(nativeBalance);

    // 如果是 ERC20 代币，同时查询代币余额
    let tokenBalance = null;
    if (tokenType === 'erc20') {
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
        throw new Error('代币地址无效');
      }
      const abi = ["function balanceOf(address) view returns (uint256)"];
      const contract = new ethers.Contract(tokenAddress, abi, provider);
      const tokenBal = await contract.balanceOf(task.address);
      tokenBalance = ethers.formatUnits(tokenBal, tokenDecimals);
    }

    return { nativeBalance: nativeBalanceFormatted, tokenBalance };
  };

  const handleStartQuery = async () => {
    const pendingTasks = tasks.filter(t => t.selected && t.status !== 'success');
    if (pendingTasks.length === 0) {
      setMessage({ type: 'error', text: '没有待查询的任务' });
      return;
    }

    setQuerying(true);
    setProgress({ current: 0, total: pendingTasks.length });

    for (const task of pendingTasks) {
      if (!task.selected) continue;

      updateTask(task.id, { status: 'processing', error: '' });

      try {
        const result = await fetchBalance(task);
        updateTask(task.id, {
          status: 'success',
          nativeBalance: parseFloat(result.nativeBalance).toFixed(6),
          tokenBalance: result.tokenBalance ? parseFloat(result.tokenBalance).toFixed(6) : null,
          error: ''
        });
      } catch (e) {
        updateTask(task.id, {
          status: 'error',
          error: e.shortMessage || e.message || '查询失败'
        });
      }

      setProgress(prev => ({ ...prev, current: prev.current + 1 }));

      // 随机延迟
      await sleep(getRandomInterval());
    }

    setQuerying(false);
    setMessage({ type: 'success', text: '查询完成' });
  };

  const handleRetryFailed = async () => {
    const failedTasks = tasks.filter(t => t.selected && t.status === 'error');
    if (failedTasks.length === 0) {
      setMessage({ type: 'error', text: '没有失败的任务需要重试' });
      return;
    }

    setQuerying(true);
    const originalProgress = progress;

    for (const task of failedTasks) {
      if (!task.selected) continue;

      updateTask(task.id, { status: 'processing', error: '' });

      try {
        const result = await fetchBalance(task);
        updateTask(task.id, {
          status: 'success',
          nativeBalance: parseFloat(result.nativeBalance).toFixed(6),
          tokenBalance: result.tokenBalance ? parseFloat(result.tokenBalance).toFixed(6) : null,
          error: ''
        });
      } catch (e) {
        updateTask(task.id, {
          status: 'error',
          error: e.shortMessage || e.message || '查询失败'
        });
      }

      await sleep(getRandomInterval());
    }

    setQuerying(false);
    setMessage({ type: 'success', text: '重试完成' });
  };

  const handleRetrySingle = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    updateTask(taskId, { status: 'processing', error: '' });

    try {
      const result = await fetchBalance(task);
      updateTask(taskId, {
        status: 'success',
        nativeBalance: parseFloat(result.nativeBalance).toFixed(6),
        tokenBalance: result.tokenBalance ? parseFloat(result.tokenBalance).toFixed(6) : null,
        error: ''
      });
    } catch (e) {
      updateTask(taskId, {
        status: 'error',
        error: e.shortMessage || e.message || '查询失败'
      });
    }
  };

  const updateTask = useCallback((taskId, updates) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ));
  }, []);

  const handleToggleSelect = (taskId, checked) => {
    updateTask(taskId, { selected: checked });
  };

  const handleSelectAll = (checked) => {
    setTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  const handleExportResults = () => {
    if (tasks.length === 0) return;

    const data = tasks.map(t => ({
      '序号': t.id + 1,
      '钱包地址': t.address,
      '项目': t.project,
      '平台币余额': t.nativeBalance !== null ? t.nativeBalance : '-',
      '代币余额': t.tokenBalance !== null ? t.tokenBalance : '-',
      '状态': t.status === 'success' ? '成功' : t.status === 'error' ? '失败' : '待查询',
      '错误信息': t.error || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Balance Results");

    // 设置列宽
    ws['!cols'] = [
      { wch: 8 },
      { wch: 45 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 40 }
    ];

    XLSX.writeFile(wb, `balance_check_${new Date().getTime()}.xlsx`);
    setMessage({ type: 'success', text: '结果已导出' });
  };

  const successfulCount = tasks.filter(t => t.status === 'success').length;
  const failedCount = tasks.filter(t => t.status === 'error').length;
  const selectedCount = tasks.filter(t => t.selected).length;

  return (
    <div className="balance-check-page">
      <div className="balance-header">
        <div className="title-section">
          <h1>钱包余额查询</h1>
          <p>批量查询多个钱包的代币余额，支持 EVM 兼容链</p>
        </div>
        <div className="header-btns">
          <button
            className="export-results-btn"
            onClick={handleExportResults}
            disabled={tasks.length === 0}
          >
            <FileSpreadsheet size={18} /> 导出结果
          </button>
          <button
            className="reset-btn"
            onClick={() => {
              setTasks([]);
              setWalletAddresses('');
              setProject('');
              setMessage(null);
            }}
          >
            <RefreshCw size={18} /> 重置
          </button>
        </div>
      </div>

      <section className="setup-section">
        <div className="setup-card source-card">
          <div className="card-tag">STEP 1</div>
          <h3><Database size={18} /> 数据源</h3>
          <div className="setup-grid">
            <div className="input-group full-row">
              <label>项目筛选（可选）</label>
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">不选择项目</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="input-group full-row">
              <label>钱包地址（每行一个，可逗号分隔）</label>
              <textarea
                value={walletAddresses}
                onChange={(e) => setWalletAddresses(e.target.value)}
                placeholder={`0x1234...
0x5678...`}
              />
            </div>
            <button
              className="fetch-btn"
              onClick={handleGenerateTasks}
              disabled={loading}
            >
              <Search size={18} />
              {loading ? '加载中...' : '生成查询任务'}
            </button>
          </div>
        </div>

        <div className="setup-card config-card">
          <div className="card-tag">STEP 2</div>
          <h3><Coins size={18} /> 网络与代币</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>网络环境</label>
              <select onChange={handleNetworkChange}>
                {COMMON_NETWORKS.map(n => (
                  <option key={n.chainId} value={n.chainId}>{n.name}</option>
                ))}
                <option value="custom">-- 自定义 RPC --</option>
              </select>
            </div>
            <div className="input-group">
              <label>代币类型</label>
              <div className="type-toggle">
                <button
                  className={tokenType === 'native' ? 'active' : ''}
                  onClick={() => setTokenType('native')}
                >
                  原生币
                </button>
                <button
                  className={tokenType === 'erc20' ? 'active' : ''}
                  onClick={() => setTokenType('erc20')}
                >
                  ERC20
                </button>
              </div>
            </div>
            {isCustomRpc && (
              <div className="input-group full-row">
                <label>RPC 节点地址</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={customRpc}
                  onChange={(e) => setCustomRpc(e.target.value)}
                />
              </div>
            )}
            {tokenType === 'erc20' && (
              <>
                <div className="input-group full-row">
                  <label>代币合约地址</label>
                  <div className="token-info-input">
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                    />
                    {tokenSymbol && (
                      <span className="token-badge">{tokenSymbol} ({tokenDecimals})</span>
                    )}
                  </div>
                </div>
                <button
                  className="query-token-btn"
                  onClick={handleQueryTokenInfo}
                  disabled={loading || !tokenAddress}
                >
                  {loading ? '查询中...' : '查询代币信息'}
                </button>
              </>
            )}
            <div className="input-group">
              <label>查询间隔最小值 (秒)</label>
              <input
                type="number"
                value={queryInterval.min}
                onChange={(e) => setQueryInterval({ ...queryInterval, min: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.1"
                placeholder="0"
              />
            </div>
            <div className="input-group">
              <label>查询间隔最大值 (秒)</label>
              <input
                type="number"
                value={queryInterval.max}
                onChange={(e) => setQueryInterval({ ...queryInterval, max: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.1"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="tasks-section">
        <div className="tasks-header">
          <div className="execution-modes">
            <div className="mode-tabs">
              <button className="active">
                <Database size={14} /> 任务列表
              </button>
            </div>
            <div className="mode-params">
              {tasks.length > 0 && (
                <div className="progress-info">
                  <strong>{successfulCount}</strong> 成功 / <strong>{failedCount}</strong> 失败 / 共 <strong>{tasks.length}</strong> 个
                  {selectedCount !== tasks.length && ` (选中 ${selectedCount})`}
                </div>
              )}
              <div className="task-actions">
                <button
                  className="retry-btn"
                  onClick={handleRetryFailed}
                  disabled={querying || failedCount === 0}
                >
                  <RefreshCw size={16} /> 重试失败
                </button>
                <button
                  className="run-query-btn"
                  onClick={handleStartQuery}
                  disabled={querying || tasks.length === 0}
                >
                  <Coins size={16} /> 开始查询
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="task-table-wrapper">
          {tasks.length > 0 ? (
            <table className="task-table">
              <thead>
                <tr>
                  <th width="40">
                    <input
                      type="checkbox"
                      checked={tasks.length > 0 && tasks.every(t => t.selected)}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th width="60">序号</th>
                  <th>钱包地址</th>
                  <th width="100">项目</th>
                  <th width="150">平台币余额</th>
                  <th width="150">代币余额</th>
                  <th width="100">状态</th>
                  <th width="100">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className={`task-row ${task.status} ${!task.selected ? 'unselected' : ''}`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={task.selected}
                        onChange={(e) => handleToggleSelect(task.id, e.target.checked)}
                      />
                    </td>
                    <td>{task.id + 1}</td>
                    <td>
                      <span className="addr-mono">{task.address}</span>
                    </td>
                    <td>{task.project}</td>
                    <td>
                      {task.nativeBalance !== null ? (
                        <span className="balance-text">{task.nativeBalance}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {task.tokenBalance !== null ? (
                        <span className="balance-text token-balance">{task.tokenBalance}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <div className={`status-pill ${task.status}`}>
                        {task.status === 'processing' && <RefreshCw size={12} className="spin" />}
                        {task.status === 'success' && <CheckCircle size={12} />}
                        {task.status === 'error' && <AlertCircle size={12} title={task.error} />}
                        {task.status === 'pending' && '待查询'}
                      </div>
                    </td>
                    <td>
                      <div className="task-row-actions">
                        {task.status === 'error' && (
                          <button
                            className="retry-single-btn"
                            onClick={() => handleRetrySingle(task.id)}
                          >
                            重试
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="tasks-placeholder">
              <div className="empty-icon"><Database size={48} /></div>
              <p>请完成 STEP 1 生成查询任务</p>
            </div>
          )}
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
