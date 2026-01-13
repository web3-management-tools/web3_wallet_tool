import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Key,
  Globe,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Send,
  Settings,
  Coins,
  Target,
  AlertTriangle,
  FileSpreadsheet,
  RotateCcw,
  Wallet as WalletIcon,
  Dice5,
  Database,
  AlertCircle,
  Clock
} from 'lucide-react';
import PasswordInput from '../../components/PasswordInput';
import { getExchangeNames, getExchangeOne, insertExchange, updateExchange, deleteExchange, withdraw } from '../../api/exchange';
import { getWalletProjects, walletList } from '../../api/wallet';
import { handleApiError } from '../../api/errorHandler';
import { encryptPwd, decryptPwd } from '../../utils/crypto';
import * as XLSX from 'xlsx';
import './index.css';

const CHAINS = [
  { value: 'ERC20', label: 'ERC20 (Ethereum)' },
  { value: 'TRC20', label: 'TRC20 (Tron)' },
  { value: 'BEP20', label: 'BEP20 (BSC)' },
  { value: 'POLYGON', label: 'POLYGON' },
  { value: 'ARB', label: 'Arbitrum' },
  { value: 'OP', label: 'Optimism' },
  { value: 'AVAX', label: 'Avalanche C-Chain' },
  { value: 'SOL', label: 'Solana' },
  { value: '', label: '其他' }
];

// 交易所到网络的映射（根据各交易所官方文档的提现网络名称）
const EXCHANGE_CHAINS = {
  binance: [
    { value: 'ETH', label: 'ETH' },
    { value: 'TRC20', label: 'TRC20' },
    { value: 'BSC', label: 'BSC' },
    { value: 'MATIC', label: 'MATIC' },
    { value: 'ARBITRUM', label: 'ARBITRUM' },
    { value: 'OPTIMISM', label: 'OPTIMISM' },
    { value: 'AVAXC', label: 'AVAXC' },
    { value: 'SOL', label: 'SOL' },
    { value: 'BTC', label: 'BTC' }
  ],
  okx: [
    { value: 'ERC20', label: 'ERC20' },
    { value: 'TRC20', label: 'TRC20' },
    { value: 'BSC', label: 'BSC' },
    { value: 'Polygon', label: 'Polygon' },
    { value: 'Arbitrum One', label: 'Arbitrum One' },
    { value: 'Optimism', label: 'Optimism' },
    { value: 'Avalanche C-Chain', label: 'Avalanche C-Chain' },
    { value: 'Solana', label: 'Solana' },
    { value: 'Bitcoin', label: 'Bitcoin' },
    { value: 'Ethereum', label: 'Ethereum' }
  ],
  bybit: [
    { value: 'ERC20', label: 'ERC20' },
    { value: 'TRC20', label: 'TRC20' },
    { value: 'BSC', label: 'BSC' },
    { value: 'Polygon', label: 'Polygon' },
    { value: 'Arbitrum', label: 'Arbitrum' },
    { value: 'Optimism', label: 'Optimism' },
    { value: 'Avalanche', label: 'Avalanche' },
    { value: 'Solana', label: 'Solana' },
    { value: 'BTC', label: 'BTC' },
    { value: 'ETH', label: 'ETH' }
  ],
  bitget: [
    { value: 'ERC20', label: 'ERC20' },
    { value: 'TRC20', label: 'TRC20' },
    { value: 'BSC', label: 'BSC' },
    { value: 'Polygon', label: 'Polygon' },
    { value: 'Arbitrum', label: 'Arbitrum' },
    { value: 'Optimism', label: 'Optimism' },
    { value: 'Avalanche', label: 'Avalanche' },
    { value: 'Solana', label: 'Solana' },
    { value: 'BTC', label: 'BTC' },
    { value: 'ETH', label: 'ETH' }
  ],
  gate: [
    { value: 'ERC20', label: 'ERC20' },
    { value: 'TRC20', label: 'TRC20' },
    { value: 'BSC', label: 'BSC' },
    { value: 'Polygon', label: 'Polygon' },
    { value: 'Arbitrum', label: 'Arbitrum' },
    { value: 'Optimism', label: 'Optimism' },
    { value: 'Avalanche', label: 'Avalanche' },
    { value: 'Solana', label: 'Solana' },
    { value: 'BTC', label: 'BTC' },
    { value: 'ETH', label: 'ETH' }
  ]
};

const TOKENS = [
  { value: 'USDT', label: 'USDT' },
  { value: 'USDC', label: 'USDC' },
  { value: 'BTC', label: 'BTC' },
  { value: 'ETH', label: 'ETH' },
  { value: 'BNB', label: 'BNB' },
  { value: 'TRX', label: 'TRX' },
  { value: 'DAI', label: 'DAI' },
  { value: 'LINK', label: 'LINK' }
];

const PLATFORMS = [
  { value: 'binance', label: 'Binance' },
  { value: 'okx', label: 'OKX' },
  { value: 'bitget', label: 'Bitget' },
  { value: 'bybit', label: 'Bybit' },
  { value: 'kucoin', label: 'KuCoin' },
  { value: 'gate', label: 'Gate.io' },
];

// 生成随机密码
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function Exchange() {
  const [activeTab, setActiveTab] = useState('list');
  const [password, setPassword] = useState('');
  const [exchanges, setExchanges] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // 表单状态
  const [formData, setFormData] = useState({
    platform: 'binance',
    name: '',
    apikey: '',
    secret: '',
    password: '',
    ip: ''
  });
  const [showPassword, setShowPassword] = useState({
    apikey: false,
    secret: false,
    password: false,
    decrypt: false
  });
  const [isEditing, setIsEditing] = useState(false);

  // 提现配置状态
  const [decryptPwdInput, setDecryptPwdInput] = useState(''); // 交易所API解密密码输入
  const [isApiVerified, setIsApiVerified] = useState(false);
  const [isApiVerifying, setIsApiVerifying] = useState(false);
  const [verifiedApiInfo, setVerifiedApiInfo] = useState(null);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectAddresses, setProjectAddresses] = useState([]);
  const [addressInputMode, setAddressInputMode] = useState('project'); // 'project' | 'manual'
  const [manualAddresses, setManualAddresses] = useState(''); // 多行地址输入

  // 提现任务配置
  const [withdrawConfig, setWithdrawConfig] = useState({
    exchange: '',
    chain: '',
    token: 'USDT',
    amountMode: 'fixed',
    fixedAmount: '',
    amountMin: '',
    amountMax: '',
    intervalMin: '',
    intervalMax: ''
  });

  // 任务列表
  const [withdrawTasks, setWithdrawTasks] = useState([]);
  const [withdrawLogs, setWithdrawLogs] = useState([]);
  const [availableChains, setAvailableChains] = useState([]);

  useEffect(() => {
    loadExchangeNames();
    loadProjects();
  }, []);

  // 消息自动消失
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadExchangeNames = async () => {
    setLoading(true);
    try {
      const res = await getExchangeNames();
      if (res.success) {
        setExchanges(res.data || []);
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '获取数据失败' });
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await getWalletProjects();
      if (res.success) {
        setProjects(res.data || []);
      }
    } catch (error) {
      console.error('获取项目列表失败:', error);
    }
  };

  // 选择项目后获取地址
  const handleProjectChange = async (e) => {
    const project = e.target.value;
    setSelectedProject(project);
    setProjectAddresses([]);
    setWithdrawTasks([]);
    setWithdrawLogs([]);

    // 地址加载移到验证API成功后
    if (project && isApiVerified && decryptPwdInput) {
      setLoading(true);
      try {
        const res = await walletList({ project, pwd: decryptPwdInput });
        if (res.success && res.data) {
          const addresses = res.data.map(w => w.address);
          setProjectAddresses(addresses);
          setMessage({ type: 'success', text: `已加载 ${addresses.length} 个钱包地址` });
        } else {
          setMessage({ type: 'error', text: '获取钱包地址失败，请检查解密密码' });
        }
      } catch (error) {
        setMessage({ type: 'error', text: '获取钱包地址失败' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!password) {
      setMessage({ type: 'error', text: '请输入API加密密码' });
      return;
    }
    if (!formData.name || !formData.apikey || !formData.secret) {
      setMessage({ type: 'error', text: '请填写必填字段' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const encryptedData = {
        ...formData,
        apikey: await encryptPwd(formData.apikey),
        secret: await encryptPwd(formData.secret),
        password: formData.password ? await encryptPwd(formData.password) : '',
        pwd: password
      };

      const res = isEditing ? await updateExchange(encryptedData) : await insertExchange(encryptedData);

      if (res.success) {
        setMessage({ type: 'success', text: isEditing ? '更新成功' : '添加成功' });
        resetForm();
        loadExchangeNames();
        setActiveTab('list');
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (name) => {
    if (!password) {
      setMessage({ type: 'error', text: '请先输入API加密密码' });
      return;
    }

    setLoading(true);
    try {
      const res = await getExchangeOne(name, password);
      console.log('getExchangeOne res:', res);
      if (res.success && res.data) {
        setFormData({
          platform: res.data.platform || 'binance',
          name: res.data.name,
          apikey: res.data.apikey ? await decryptPwd(res.data.apikey) : '',
          secret: res.data.secret ? await decryptPwd(res.data.secret) : '',
          password: res.data.password ? await decryptPwd(res.data.password) : '',
          ip: res.data.ip || ''
        });
        setIsEditing(true);
        setActiveTab('form');
      } else {
        console.log('res.success:', res.success, 'res.data:', res.data);
        handleApiError(res, setMessage);
      }
    } catch (error) {
      console.error('handleEdit error:', error);
      setMessage({ type: 'error', text: '获取详情失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`确定要删除交易所 "${name}" 吗？`)) return;

    setLoading(true);
    try {
      const res = await deleteExchange(name);
      if (res.success) {
        setMessage({ type: 'success', text: '删除成功' });
        loadExchangeNames();
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      platform: 'binance',
      name: '',
      apikey: '',
      secret: '',
      password: '',
      ip: ''
    });
    setShowPassword({ apikey: false, secret: false, password: false, decrypt: false });
    setIsEditing(false);
  };

  const toggleShowPassword = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // 验证 API
  const verifyApiConnection = async () => {
    if (!decryptPwdInput) {
      setMessage({ type: 'error', text: '请输入API解密密码' });
      return;
    }
    if (!withdrawConfig.exchange) {
      setMessage({ type: 'error', text: '请选择交易所' });
      return;
    }

    setIsApiVerifying(true);
    setMessage(null);

    try {
      const res = await getExchangeOne(withdrawConfig.exchange, decryptPwdInput);
      if (res.success && res.data) {
        try {
          const decryptedApikey = res.data.apikey ? await decryptPwd(res.data.apikey) : '';
          const decryptedSecret = res.data.secret ? await decryptPwd(res.data.secret) : '';
          const decryptedPassword = res.data.password ? await decryptPwd(res.data.password) : '';
          const platform = res.data.platform || 'unknown';

          setVerifiedApiInfo({
            platform: platform,
            apikey: decryptedApikey,
            secret: decryptedSecret,
            password: decryptedPassword,
            ip: res.data.ip || ''
          });
          setIsApiVerified(true);
          setMessage({ type: 'success', text: 'API 验证成功' });

          // 根据platform更新网络选项
          console.log('API验证成功，平台:', platform);
          const chains = EXCHANGE_CHAINS[platform.toLowerCase()] || CHAINS;
          console.log('可用网络:', chains);
          setAvailableChains(chains);

          // 验证成功后，如果已选择项目，则加载地址
          if (selectedProject) {
            loadProjectAddresses();
          }
        } catch (decryptError) {
          setIsApiVerified(false);
          setMessage({ type: 'error', text: 'API 解密失败，密码可能错误' });
        }
      } else {
        setIsApiVerified(false);
        handleApiError(res, setMessage);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '验证失败' });
    } finally {
      setIsApiVerifying(false);
    }
  };

  // 加载项目地址
  const loadProjectAddresses = async () => {
    if (!selectedProject || !decryptPwdInput) return;

    setLoading(true);
    try {
      const res = await walletList({ project: selectedProject, pwd: decryptPwdInput });
      if (res.success && res.data) {
        const addresses = res.data.map(w => w.address);
        setProjectAddresses(addresses);
        setMessage({ type: 'success', text: `已加载 ${addresses.length} 个钱包地址` });
      } else {
        setMessage({ type: 'error', text: '获取钱包地址失败，请检查解密密码' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '获取钱包地址失败' });
    } finally {
      setLoading(false);
    }
  };

  const maskSensitive = (value, type) => {
    if (!value) return '-';
    const len = value.length;
    if (len <= 8) return '****';
    if (type === 'apikey') {
      return value.substring(0, 4) + '****' + value.substring(len - 4);
    }
    return value.substring(0, 2) + '****' + value.substring(len - 2);
  };

  const handleExchangeChange = async (e) => {
    const value = e.target.value;
    setWithdrawConfig(prev => ({ ...prev, exchange: value, chain: '' }));
    setIsApiVerified(false);
    setVerifiedApiInfo(null);
    setWithdrawTasks([]);
    setWithdrawLogs([]);
    setMessage(null);

    // 根据选择的交易所更新网络选项
    if (value && decryptPwdInput) {
      try {
        // 获取交易所信息以获取platform字段
        const res = await getExchangeOne(value, decryptPwdInput);
        if (res.success && res.data && res.data.platform) {
          const platform = res.data.platform.toLowerCase();
          console.log('选择的交易所:', value, '平台:', platform);
          const chains = EXCHANGE_CHAINS[platform] || CHAINS;
          console.log('可用网络:', chains);
          setAvailableChains(chains);
        } else {
          setAvailableChains(CHAINS);
        }
      } catch (error) {
        console.error('获取交易所信息失败:', error);
        setAvailableChains(CHAINS);
      }
    } else {
      setAvailableChains([]);
    }
  };

  // 生成任务列表
  const generateTasks = () => {
    if (!isApiVerified) {
      setMessage({ type: 'error', text: '请先验证交易所 API' });
      return;
    }
    if (projectAddresses.length === 0) {
      setMessage({ type: 'error', text: '请先选择项目并加载地址' });
      return;
    }

    const tasks = projectAddresses.map((addr, index) => {
      let amount = '';
      if (withdrawConfig.amountMode === 'fixed') {
        amount = withdrawConfig.fixedAmount || '0';
      } else if (withdrawConfig.amountMode === 'random') {
        const min = parseFloat(withdrawConfig.amountMin) || 0;
        const max = parseFloat(withdrawConfig.amountMax) || 0;
        amount = min > 0 && max > 0 ? (Math.random() * (max - min) + min).toFixed(4) : '0';
      }

      return {
        id: index,
        exchange: withdrawConfig.exchange,
        chain: withdrawConfig.chain,
        token: withdrawConfig.token,
        address: addr,
        amount,
        interval: withdrawConfig.intervalMin && withdrawConfig.intervalMax
          ? Math.floor(Math.random() * (parseInt(withdrawConfig.intervalMax) - parseInt(withdrawConfig.intervalMin) + 1)) + parseInt(withdrawConfig.intervalMin)
          : 5,
        status: 'pending',
        txHash: '',
        error: '',
        selected: true
      };
    });

    setWithdrawTasks(tasks);
  };

  // 更新任务
  const updateTask = (index, updates) => {
    setWithdrawTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = (checked) => {
    setWithdrawTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  // 导出结果
  const exportResults = () => {
    if (withdrawTasks.length === 0) return;
    const data = withdrawTasks.map(t => ({
      '交易所': t.exchange,
      '网络': t.chain,
      '代币': t.token,
      '目标地址': t.address,
      '金额': t.amount,
      '状态': t.status,
      '交易哈希': t.txHash || '',
      '错误信息': t.error || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Withdraw Results");
    XLSX.writeFile(wb, `withdraw_results_${new Date().getTime()}.xlsx`);
  };

  // 添加日志
  const addWithdrawLog = (text, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setWithdrawLogs(prev => [...prev.slice(-99), { time, text, type }]);
  };

  // 执行单个提现任务
  const executeWithdrawTask = async (index) => {
    const task = withdrawTasks[index];
    if (!task.selected || task.status === 'success') return;

    updateTask(index, { status: 'processing', error: '' });
    addWithdrawLog(`开始执行: ${task.address}`, 'info');

    try {
      const res = await withdraw({
        exchange: task.exchange,
        pwd: decryptPwdInput,
        toAddress: task.address,
        network: task.chain,
        coin: task.token,
        amount: parseFloat(task.amount)
      });

      if (res.success) {
        updateTask(index, { status: 'success', txHash: res.data?.txHash || '' });
        addWithdrawLog(`✅ 成功: ${task.amount} ${task.token} → ${task.address}`, 'success');
      } else {
        const errorMsg = res.msg || '提现请求被拒绝';
        updateTask(index, { status: 'error', error: errorMsg });
        addWithdrawLog(`❌ 失败: ${task.address} - ${errorMsg}`, 'error');
      }
    } catch (error) {
      updateTask(index, { status: 'error', error: error.message || '网络错误' });
      addWithdrawLog(`❌ 失败: ${task.address} - ${error.message || '网络错误'}`, 'error');
    }
  };

  // 批量执行
  const executeAll = async () => {
    const ready = withdrawTasks.map((t, i) => t.selected && t.status !== 'success' ? i : -1).filter(i => i !== -1);
    if (ready.length === 0) {
      setMessage({ type: 'error', text: '没有选中的待执行任务' });
      return;
    }

    setLoading(true);
    for (const i of ready) {
      await executeWithdrawTask(i);
      const task = withdrawTasks[i];
      if (task.interval > 0) {
        await new Promise(resolve => setTimeout(resolve, task.interval * 1000));
      }
    }
    setLoading(false);
    setMessage({ type: 'success', text: '批量执行完成' });
  };

  // 重试失败任务
  const retryFailed = async () => {
    const failed = withdrawTasks.map((t, i) => t.selected && t.status === 'error' ? i : -1).filter(i => i !== -1);
    if (failed.length === 0) {
      setMessage({ type: 'error', text: '没有失败的任务需要重试' });
      return;
    }

    setLoading(true);
    for (const i of failed) {
      await executeWithdrawTask(i);
    }
    setLoading(false);
  };

  // 清空配置
  const clearWithdrawConfig = () => {
    setWithdrawConfig({
      exchange: '',
      chain: '',
      token: 'USDT',
      amountMode: 'fixed',
      fixedAmount: '',
      amountMin: '',
      amountMax: '',
      intervalMin: '',
      intervalMax: ''
    });
    setSelectedProject('');
    setProjectAddresses([]);
    setDecryptPwdInput('');
    setIsApiVerified(false);
    setVerifiedApiInfo(null);
    setWithdrawTasks([]);
    setWithdrawLogs([]);
    setManualAddresses('');
    setAddressInputMode('project');
    setShowPassword({ apikey: false, secret: false, password: false, decrypt: false });
  };

  return (
    <div className="exchange-page">
      <div className="page-header">
        <div className="title-section">
          <h1>交易所管理</h1>
          <p>管理交易所API配置及提现操作</p>
        </div>
        <div className="header-tabs">
          <button
            className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => { setActiveTab('list'); resetForm(); }}
          >
            <Building2 size={18} /> 交易所列表
          </button>
          <button
            className={`tab-btn ${activeTab === 'form' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('form');
              if (!isEditing) resetForm();
            }}
          >
            <Plus size={18} /> {isEditing ? '编辑交易所' : '新增交易所'}
          </button>
          <button
            className={`tab-btn ${activeTab === 'withdraw' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('withdraw');
              setShowPassword({ apikey: false, secret: false, password: false, decrypt: false });
            }}
          >
            <ArrowUpRight size={18} /> 提现操作
          </button>
        </div>
      </div>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {message.text}
        </div>
      )}

      {activeTab === 'list' && (
        <section className="content-section">
          <div className="search-bar">
            <div className="input-group">
              <label>API加密密码</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="输入密码用于解密/操作"
              />
            </div>
            <button className="refresh-btn" onClick={loadExchangeNames} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> 刷新
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <RefreshCw size={32} className="spin" />
              <p>加载中...</p>
            </div>
          ) : exchanges.length > 0 ? (
            <div className="exchange-grid">
              {exchanges.map((name) => (
                <div key={name} className="exchange-card">
                  <div className="exchange-card-header">
                    <Building2 size={24} />
                    <span className="exchange-name">{name}</span>
                  </div>
                  <div className="exchange-card-body">
                    <div className="exchange-info">
                      <span className="info-label">平台</span>
                      <span className="platform-badge">{name.split('_')[0]}</span>
                    </div>
                  </div>
                  <div className="exchange-card-footer">
                    <button className="action-btn edit" onClick={() => handleEdit(name)}>
                      <Edit2 size={14} /> 编辑
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(name)}>
                      <Trash2 size={14} /> 删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Building2 size={48} />
              <p>暂无交易所配置</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'form' && (
        <section className="content-section">
          <div className="form-card">
            <h3>{isEditing ? '编辑交易所' : '新增交易所'}</h3>
            <div className="form-grid">
              <div className="input-group">
                <label>平台 <span className="required">*</span></label>
                <input
                  list="platform-options"
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="选择或输入平台"
                />
                <datalist id="platform-options">
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </datalist>
              </div>
              <div className="input-group">
                <label>名称 <span className="required">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="唯一标识，如: binance_main"
                  disabled={isEditing}
                />
              </div>
              <div className="input-group full-width">
                <label>API Key <span className="required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword.apikey ? 'text' : 'password'}
                    value={formData.apikey}
                    onChange={(e) => setFormData({ ...formData, apikey: e.target.value })}
                    placeholder="输入API Key"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => toggleShowPassword('apikey')}
                  >
                    {showPassword.apikey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="input-group full-width">
                <label>Secret <span className="required">*</span></label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword.secret ? 'text' : 'password'}
                    value={formData.secret}
                    onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                    placeholder="输入Secret"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => toggleShowPassword('secret')}
                  >
                    {showPassword.secret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="input-group">
                <label>Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword.password ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="输入Password"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => toggleShowPassword('password')}
                  >
                    {showPassword.password ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="input-group">
                <label>代理IP</label>
                <input
                  type="text"
                  value={formData.ip}
                  onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                  placeholder="IP地址"
                />
              </div>
              <div className="input-group full-width">
                <label>API加密密码 <span className="required">*</span></label>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  placeholder="输入API加密密码"
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => { setActiveTab('list'); setIsEditing(false); resetForm(); }}>
                取消
              </button>
              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <RefreshCw size={16} className="spin" /> : (isEditing ? '更新' : '保存')}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'withdraw' && (
        <section className="content-section withdraw-section">
          {/* 上方：配置区域 */}
          <div className="withdraw-main-card">
            <div className="withdraw-card-header">
              <Settings size={20} />
              <h3>提现配置</h3>
            </div>

            {/* 项目/地址选择区域 */}
            <div className="address-source-section">
              <div className="address-mode-tabs">
                <button
                  className={addressInputMode === 'project' ? 'active' : ''}
                  onClick={() => {
                    setAddressInputMode('project');
                    setProjectAddresses([]);
                    setWithdrawTasks([]);
                    setWithdrawLogs([]);
                  }}
                >
                  <Database size={14} /> 项目获取
                </button>
                <button
                  className={addressInputMode === 'manual' ? 'active' : ''}
                  onClick={() => {
                    setAddressInputMode('manual');
                    setSelectedProject('');
                    setProjectAddresses([]);
                    setWithdrawTasks([]);
                    setWithdrawLogs([]);
                  }}
                >
                  <Edit2 size={14} /> 手动输入
                </button>
              </div>

              {addressInputMode === 'project' ? (
                <div className="input-group">
                  <label><Database size={14} /> 目标项目</label>
                  <select
                    value={selectedProject}
                    onChange={handleProjectChange}
                  >
                    <option value="">选择项目...</option>
                    {projects.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="input-group manual-address-group">
                  <label><Edit2 size={14} /> 提现地址（每行一个）</label>
                  <textarea
                    className="address-textarea"
                    value={manualAddresses}
                    onChange={(e) => {
                      setManualAddresses(e.target.value);
                      const lines = e.target.value.split('\n').filter(line => line.trim());
                      setProjectAddresses(lines);
                    }}
                    placeholder="0x1234...&#10;0xabcd..."
                    rows={5}
                  />
                </div>
              )}
            </div>

            {/* 交易所选择区域 */}
            <div className="exchange-verify-section">
              <div className="input-group">
                <label><Target size={14} /> 交易所</label>
                <select
                  value={withdrawConfig.exchange}
                  onChange={handleExchangeChange}
                >
                  <option value="">选择交易所</option>
                  {exchanges.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group verify-password-group">
                <label><Key size={14} /> API解密密码</label>
                <div className="password-input-wrapper" style={{ height: '38px' }}>
                  <input
                    type={showPassword.decrypt ? 'text' : 'password'}
                    value={decryptPwdInput}
                    onChange={(e) => setDecryptPwdInput(e.target.value)}
                    placeholder="输入API解密密码"
                    style={{ width: '100%', height: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => toggleShowPassword('decrypt')}
                  >
                    {showPassword.decrypt ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="input-group verify-btn-group">
                <button
                  type="button"
                  className={`verify-btn ${isApiVerified ? 'verified' : ''}`}
                  onClick={verifyApiConnection}
                  disabled={isApiVerifying || !withdrawConfig.exchange || !decryptPwdInput}
                >
                  {isApiVerifying ? (
                    <RefreshCw size={14} className="spin" />
                  ) : isApiVerified ? (
                    <>
                      <CheckCircle size={14} /> 已验证
                    </>
                  ) : (
                    <>
                      <Key size={14} /> 验证API
                    </>
                  )}
                </button>
              </div>
            </div>

            {isApiVerified && verifiedApiInfo && (
              <div className="api-info-section">
                <div className="api-info-header">
                  <Key size={14} />
                  <span>API 信息</span>
                </div>
                <div className="api-info-content">
                  <div className="api-info-item">
                    <span className="api-info-label">平台</span>
                    <span className="api-info-value">{verifiedApiInfo.platform}</span>
                  </div>
                  <div className="api-info-item">
                    <span className="api-info-label">API Key</span>
                    <span className="api-info-value">{maskSensitive(verifiedApiInfo.apikey, 'apikey')}</span>
                  </div>
                  <div className="api-info-item">
                    <span className="api-info-label">Secret</span>
                    <span className="api-info-value">{maskSensitive(verifiedApiInfo.secret, 'secret')}</span>
                  </div>
                  {verifiedApiInfo.password && (
                    <div className="api-info-item">
                      <span className="api-info-label">Password</span>
                      <span className="api-info-value">{maskSensitive(verifiedApiInfo.password, 'secret')}</span>
                    </div>
                  )}
                  {verifiedApiInfo.ip && (
                    <div className="api-info-item">
                      <span className="api-info-label">代理IP</span>
                      <span className="api-info-value">{verifiedApiInfo.ip}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="withdraw-form-grid">
              <div className="input-group">
                <label><Coins size={14} /> 网络/链 <span className="hint-text">（请从交易所确认网络名称）</span></label>
                <input
                  list="chain-options"
                  value={withdrawConfig.chain || ''}
                  onChange={(e) => setWithdrawConfig({ ...withdrawConfig, chain: e.target.value })}
                  placeholder="选择或输入网络"
                  disabled={!withdrawConfig.exchange}
                />
                <datalist id="chain-options">
                  {availableChains.length > 0 ? (
                    availableChains.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))
                  ) : (
                    <option value="">请先选择交易所</option>
                  )}
                </datalist>
              </div>

              <div className="input-group">
                <label><Coins size={14} /> 代币</label>
                <input
                  list="token-options"
                  value={withdrawConfig.token}
                  onChange={(e) => setWithdrawConfig({ ...withdrawConfig, token: e.target.value })}
                  placeholder="选择或输入代币"
                />
                <datalist id="token-options">
                  {TOKENS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </datalist>
              </div>

              <div className="input-group">
                <label><WalletIcon size={14} /> 金额模式</label>
                <select
                  value={withdrawConfig.amountMode}
                  onChange={(e) => setWithdrawConfig({ ...withdrawConfig, amountMode: e.target.value })}
                >
                  <option value="fixed">固定金额</option>
                  <option value="random">随机金额</option>
                </select>
              </div>

              {withdrawConfig.amountMode === 'fixed' ? (
                <div className="input-group">
                  <label><Coins size={14} /> 固定金额</label>
                  <input
                    type="number"
                    value={withdrawConfig.fixedAmount}
                    onChange={(e) => setWithdrawConfig({ ...withdrawConfig, fixedAmount: e.target.value })}
                    placeholder="输入金额"
                  />
                </div>
              ) : (
                <div className="amount-range-group">
                  <div className="input-group">
                    <label><Dice5 size={14} /> 最小金额</label>
                    <input
                      type="number"
                      value={withdrawConfig.amountMin}
                      onChange={(e) => setWithdrawConfig({ ...withdrawConfig, amountMin: e.target.value })}
                      placeholder="最小"
                    />
                  </div>
                  <div className="input-group">
                    <label><Dice5 size={14} /> 最大金额</label>
                    <input
                      type="number"
                      value={withdrawConfig.amountMax}
                      onChange={(e) => setWithdrawConfig({ ...withdrawConfig, amountMax: e.target.value })}
                      placeholder="最大"
                    />
                  </div>
                </div>
              )}

              <div className="amount-range-group">
                <div className="input-group">
                  <label><Clock size={14} /> 间隔最小(秒)</label>
                  <input
                    type="number"
                    value={withdrawConfig.intervalMin}
                    onChange={(e) => setWithdrawConfig({ ...withdrawConfig, intervalMin: e.target.value })}
                    placeholder="最小"
                  />
                </div>
                <div className="input-group">
                  <label><Clock size={14} /> 间隔最大(秒)</label>
                  <input
                    type="number"
                    value={withdrawConfig.intervalMax}
                    onChange={(e) => setWithdrawConfig({ ...withdrawConfig, intervalMax: e.target.value })}
                    placeholder="最大"
                  />
                </div>
              </div>
            </div>

            <button
              className="generate-btn full-width"
              onClick={generateTasks}
              disabled={!isApiVerified || projectAddresses.length === 0}
            >
              <RefreshCw size={16} /> 生成 {projectAddresses.length || 0} 个提现任务
            </button>

            <button className="clear-btn full-width" onClick={clearWithdrawConfig}>
              清空配置
            </button>
          </div>

          {/* 下方：任务列表 */}
          <div className="withdraw-tasks-card">
            <div className="tasks-card-header">
              <div className="tasks-title">
                <Settings size={18} />
                <h3>提现任务列表</h3>
              </div>
              <div className="tasks-actions">
                <button className="export-btn" onClick={exportResults} disabled={withdrawTasks.length === 0}>
                  <FileSpreadsheet size={14} /> 导出
                </button>
              </div>
            </div>
            <div className="tasks-toolbar">
              <div className="mode-tabs">
                <button
                  className={withdrawConfig.amountMode === 'fixed' ? 'active' : ''}
                  onClick={() => setWithdrawConfig({ ...withdrawConfig, amountMode: 'fixed' })}
                >
                  <WalletIcon size={14} /> 固定
                </button>
                <button
                  className={withdrawConfig.amountMode === 'random' ? 'active' : ''}
                  onClick={() => setWithdrawConfig({ ...withdrawConfig, amountMode: 'random' })}
                >
                  <Dice5 size={14} /> 随机
                </button>
              </div>
              <div className="toolbar-actions">
                <button className="retry-btn" onClick={retryFailed} disabled={loading || !withdrawTasks.some(t => t.selected && t.status === 'error')}>
                  <RotateCcw size={16} /> 重试失败
                </button>
                <button className="run-all-btn" onClick={executeAll} disabled={loading || withdrawTasks.length === 0}>
                  <Send size={16} /> 批量执行
                </button>
              </div>
            </div>
            <div className="task-table-wrapper">
              {withdrawTasks.length > 0 ? (
                <table className="task-table">
                  <thead>
                    <tr>
                      <th width="40">
                        <input
                          type="checkbox"
                          checked={withdrawTasks.length > 0 && withdrawTasks.every(t => t.selected)}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th width="60">状态</th>
                      <th>目标地址</th>
                      <th width="100">金额</th>
                      <th width="80">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawTasks.map((task, index) => (
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
                            {task.status === 'error' && <AlertCircle size={12} />}
                            {task.status === 'pending' && <Clock size={12} />}
                          </div>
                        </td>
                        <td className="addr-cell">
                          <span className="addr-mono">{task.address}</span>
                        </td>
                        <td className="amount-cell">
                          {task.amount} {task.token}
                        </td>
                        <td>
                          <button
                            className="send-single-btn"
                            onClick={() => executeWithdrawTask(index)}
                            disabled={task.status === 'processing' || task.status === 'success'}
                          >
                            提现
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="tasks-placeholder">
                  <Settings size={32} />
                  <p>选择项目并验证后生成任务</p>
                </div>
              )}
            </div>
          </div>

          {/* 最下方：执行日志 */}
          <div className="withdraw-logs-card">
            <div className="logs-header">
              <div className="logs-title">
                <RefreshCw size={18} />
                <h3>执行日志</h3>
              </div>
            </div>
            <div className="logs-content">
              {withdrawLogs.length === 0 ? (
                <div className="logs-empty">
                  <AlertTriangle size={32} />
                  <p>暂无日志</p>
                </div>
              ) : (
                withdrawLogs.map((log, index) => (
                  <div key={index} className={`log-item ${log.type}`}>
                    <span className="log-time">[{log.time}]</span>
                    <span className="log-text">{log.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
