import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Database,
  Key,
  MessageSquare,
  FileSpreadsheet,
  Download,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { walletList, getWalletProjects } from '../../api/wallet';
import { handleApiError } from '../../api/errorHandler';
import { decryptPrivateKey, decryptPhrase } from '../../utils/crypto';
import PasswordInput from '../../components/PasswordInput';
import './index.css';

export default function WalletList({ initialProject }) {
  const [password, setPassword] = useState('');
  const [project, setProject] = useState('');
  const [address, setAddress] = useState('');
  const [wallets, setWallets] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectInputValue, setProjectInputValue] = useState('');
  const [safeCopyMode, setSafeCopyMode] = useState(true); // 安全复制模式，默认开启

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const res = await getWalletProjects();
    if (res.success) {
      setProjects(res.data || []);
    } else {
      handleApiError(res, setMessage);
    }
  };

  const handleSearch = async () => {
    try {
      if (!password) {
        setMessage({ type: 'error', text: '请输入密码' });
        return;
      }

      setLoading(true);
      setMessage(null);

      const res = await walletList({
        address: address || undefined,
        project: project || undefined,
        pwd: password
      });

      if (res.success) {
        const rawWallets = res.data || [];
        // Directly decrypt all wallets
        const decryptedWallets = await Promise.all(rawWallets.map(async (wallet) => {
          try {
            const [privateKey, phrase] = await Promise.all([
              decryptPrivateKey(wallet.privateKey),
              decryptPhrase(wallet.phrase)
            ]);
            return { ...wallet, decryptedPrivateKey: privateKey, decryptedPhrase: phrase };
          } catch (e) {
            return { ...wallet, decryptedPrivateKey: '解密失败', decryptedPhrase: '解密失败' };
          }
        }));
        
        setWallets(decryptedWallets);
        setMessage({ type: 'success', text: res.msg || `成功查询并解密 ${decryptedWallets.length} 个钱包` });
      } else {
        handleApiError(res, setMessage);
        setWallets([]);
      }
    } catch (error) {
      console.error('查询钱包失败:', error);
      setMessage({ type: 'error', text: error.message || '查询失败，请稍后重试' });
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (wallets.length === 0) return;

    const exportData = wallets.map(w => ({
      '序号': w.index,
      '钱包地址': w.address,
      '私钥': w.decryptedPrivateKey,
      '助记词': w.decryptedPhrase,
      '公钥': w.publicKey,
      '项目': w.project || 'Default',
      '备注': w.remark || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Wallets");
    
    // Set column widths
    const maxWidths = [
      { wch: 10 }, // Index
      { wch: 45 }, // Address
      { wch: 66 }, // Private Key
      { wch: 80 }, // Phrase
      { wch: 45 }, // Public Key
      { wch: 15 }, // Project
      { wch: 20 }, // Remark
    ];
    worksheet['!cols'] = maxWidths;

    const fileName = `wallets_${project || 'all'}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    const originalMsg = message;
    setMessage({ type: 'success', text: '表格已生成并开始下载' });
    setTimeout(() => setMessage(originalMsg), 3000);
  };

  const formatAddress = (addr) => {
    if (!addr) return '-';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatSecret = (secret) => {
    if (!secret || secret === '解密中...' || secret === '解密失败') return secret;
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
  };

  const copyToClipboard = (text, type = '内容') => {
    if (!text) return;

    // 安全复制模式：私钥和助记词去除后四位
    let textToCopy = text;
    if (safeCopyMode && (type === '私钥' || type === '助记词')) {
      if (text.length > 4) {
        textToCopy = text.slice(0, -4);
      }
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalMsg = message;
      const msg = safeCopyMode && (type === '私钥' || type === '助记词')
        ? `已复制${type}（已去除后四位）到剪贴板`
        : `已复制${type}到剪贴板`;
      setMessage({ type: 'success', text: msg });
      setTimeout(() => setMessage(originalMsg), 2000);
    }).catch(() => {
      setMessage({ type: 'error', text: '复制失败' });
    });
  };

  const handleProjectInputChange = (e) => {
    const value = e.target.value;
    setProjectInputValue(value);
    setProject(value);
    setShowProjectDropdown(true);
  };

  const handleProjectSelect = (selectedProject) => {
    setProject(selectedProject);
    setProjectInputValue(selectedProject);
    setShowProjectDropdown(false);
  };

  const getFilteredProjects = () => {
    if (!projectInputValue) return projects;
    return projects.filter(p => 
      p.toLowerCase().includes(projectInputValue.toLowerCase())
    );
  };

  const getUniqueProjects = () => {
    const seen = new Set();
    return getFilteredProjects().filter(p => {
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  };

  const handleClickOutside = (e) => {
    if (!e.target.closest('.project-autocomplete-container')) {
      setShowProjectDropdown(false);
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      setProjectInputValue(initialProject);
    }
  }, [initialProject]);

  return (
    <div className="wallet-page">
      <div className="page-header">
        <div className="title-section">
          <h1>钱包管理</h1>
          <p>批量查询、解密并导出您的 Web3 资产钱包</p>
        </div>
        <div className="header-actions">
          <div className="safe-copy-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={safeCopyMode}
                onChange={(e) => setSafeCopyMode(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">安全复制</span>
            </label>
          </div>
          {wallets.length > 0 && (
            <button className="export-excel-btn" onClick={handleExport}>
              <FileSpreadsheet size={18} /> 导出 Excel
            </button>
          )}
        </div>
      </div>

      <section className="search-section">
        <div className="setup-card search-card">
          <div className="card-tag">SEARCH</div>
          <div className="search-grid">
            <div className="input-group">
              <label>钱包密码</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="用于解密私钥"
              />
            </div>
            <div className="input-group project-autocomplete-container">
              <label>项目筛选</label>
              <input
                type="text"
                value={projectInputValue}
                onChange={handleProjectInputChange}
                onFocus={() => setShowProjectDropdown(true)}
                placeholder="输入或选择项目"
              />
              {showProjectDropdown && getFilteredProjects().length > 0 && (
                <div className="autocomplete-dropdown">
                  {getUniqueProjects().map((p, index) => (
                    <div
                      key={`${p}-${index}`}
                      className="autocomplete-item"
                      onClick={() => handleProjectSelect(p)}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="input-group flex-2">
              <label>地址搜索</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="支持精确地址查询"
              />
            </div>
            <button
              className="execute-search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />}
              {loading ? '正在解密...' : '执行查询'}
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.text}
        </div>
      )}

      <section className="data-section">
        <div className="action-card table-card">
          {wallets.length > 0 ? (
            <div className="table-wrapper">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th width="60">ID</th>
                    <th>钱包地址</th>
                    <th>私钥 (解密)</th>
                    <th>助记词 (解密)</th>
                    <th width="100">项目</th>
                    <th width="120">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <tr key={wallet.address}>
                      <td><span className="id-badge">{wallet.index}</span></td>
                      <td>
                        <div className="mono-cell">
                          <span className="mono">{wallet.address}</span>
                          <button className="copy-icon-btn" onClick={() => copyToClipboard(wallet.address, '地址')}><Copy size={12}/></button>
                        </div>
                      </td>
                      <td>
                        <div className="mono-cell secret">
                          <Key size={12} className="cell-icon"/>
                          <span className="mono">{formatSecret(wallet.decryptedPrivateKey)}</span>
                          <button className="copy-icon-btn" onClick={() => copyToClipboard(wallet.decryptedPrivateKey, '私钥')}><Copy size={12}/></button>
                        </div>
                      </td>
                      <td>
                        <div className="mono-cell secret">
                          <MessageSquare size={12} className="cell-icon"/>
                          <span className="mono">{formatSecret(wallet.decryptedPhrase)}</span>
                          <button className="copy-icon-btn" onClick={() => copyToClipboard(wallet.decryptedPhrase, '助记词')}><Copy size={12}/></button>
                        </div>
                      </td>
                      <td><span className="tag-badge">{wallet.project || 'Default'}</span></td>
                      <td>
                        <span className="remark-hint" title={wallet.remark}>{wallet.remark || '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-placeholder">
              <Database size={48} />
              <p>输入密码并点击“执行查询”以加载数据</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}