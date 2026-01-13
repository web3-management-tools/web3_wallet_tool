import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Database,
  Shield,
  Info,
  CheckCircle,
  AlertCircle,
  FileText,
  PlusCircle,
  RefreshCw,
  Upload
} from 'lucide-react';
import { insertWalletList, getWalletProjects } from '../../api/wallet';
import { handleApiError, showSuccess } from '../../api/errorHandler';
import { encryptPrivateKey, encryptPhrase } from '../../utils/crypto';
import PasswordInput from '../../components/PasswordInput';
import './index.css';

export default function ImportWallet() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [remark, setRemark] = useState('');
  const [walletData, setWalletData] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);

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

  const parseWalletData = (data) => {
    data = data.trim();
    if (data.startsWith('[')) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }

    const lines = data.split('\n').filter(line => line.trim());
    const wallets = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        wallets.push({
          address: parts[0],
          privateKey: parts[1],
          phrase: parts[2] || ''
        });
      }
    }
    return wallets.length > 0 ? wallets : null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();

    if (fileExt === 'xlsx' || fileExt === 'xls') {
      // 处理 Excel 文件
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_csv(firstSheet);
          setWalletData(jsonData);
          setMessage({ type: 'success', text: `已加载文件: ${file.name}` });
        } catch (error) {
          console.error('Excel 文件解析失败:', error);
          setMessage({ type: 'error', text: 'Excel 文件解析失败，请检查文件格式' });
        }
      };
      reader.onerror = () => {
        setMessage({ type: 'error', text: '文件读取失败' });
      };
      reader.readAsArrayBuffer(file);
    } else {
      // 处理 CSV/TXT 文件
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        setWalletData(content);
        setMessage({ type: 'success', text: `已加载文件: ${file.name}` });
      };
      reader.onerror = () => {
        setMessage({ type: 'error', text: '文件读取失败' });
      };
      reader.readAsText(file);
    }

    // 重置 input 以便可以重复选择同一文件
    e.target.value = '';
  };

  const handleImport = async () => {
    try {
      if (!password) {
        setMessage({ type: 'error', text: '请输入密码' });
        return;
      }

      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: '两次输入的密码不一致' });
        return;
      }

      if (!project) {
        setMessage({ type: 'error', text: '请选择或输入项目' });
        return;
      }

      if (!walletData.trim()) {
        setMessage({ type: 'error', text: '请输入钱包数据' });
        return;
      }

      const wallets = parseWalletData(walletData);
      if (!wallets) {
        setMessage({ type: 'error', text: '钱包数据格式不正确，请检查输入格式' });
        return;
      }

      setLoading(true);
      setMessage(null);

      const walletListEnc = await Promise.all(wallets.map(async wallet =>
        `${wallet.address},${await encryptPrivateKey(wallet.privateKey)},${await encryptPhrase(wallet.phrase)}`
      ));

      const res = await insertWalletList({
        walletList: walletListEnc,
        project,
        remark: remark || undefined,
        pwd: password,
        autoEncrypt: false  // 已经在前端加密过了，不需要再加密
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.msg || '导入成功' });
        setWalletData('');
        setRemark('');
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      console.error('导入钱包失败:', error);
      setMessage({ type: 'error', text: error.message || '导入失败，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-page">
      <div className="page-header">
        <div className="title-section">
          <h1>批量导入钱包</h1>
          <p>支持多格式外部钱包导入，自动进行 AES 加密安全存储</p>
        </div>
      </div>

      <div className="import-grid">
        <div className="left-col">
          <div className="setup-card">
            <div className="card-tag">STEP 1</div>
            <h3><PlusCircle size={18} /> 基础信息</h3>
            <div className="setup-grid-vertical">
              <div className="input-group">
                <label>所属项目</label>
                <input type="text" value={project} onChange={(e) => setProject(e.target.value)} placeholder="输入或选择项目" list="project-list" />
                <datalist id="project-list">
                  {projects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </datalist>
              </div>
              <div className="input-group">
                <label>备注信息</label>
                <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="可选备注" />
              </div>
            </div>
          </div>

          <div className="setup-card">
            <div className="card-tag">STEP 2</div>
            <h3><Shield size={18} /> 安全设置</h3>
            <div className="setup-grid-vertical">
              <div className="input-group">
                <label>钱包支付密码</label>
                <PasswordInput value={password} onChange={setPassword} placeholder="用于加密私钥" />
              </div>
              <div className="input-group">
                <label>确认支付密码</label>
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="再次确认" />
              </div>
              <button className="execute-btn" onClick={handleImport} disabled={loading}>
                {loading ? <RefreshCw className="spin" size={18} /> : <Download size={18} />}
                {loading ? '正在导入中...' : '立即导入钱包任务'}
              </button>
            </div>
          </div>
        </div>

        <div className="right-col">
          <div className="setup-card full-height">
            <div className="card-tag">DATA</div>
            <h3><FileText size={18} /> 钱包数据录入</h3>
            <div className="data-form">
              <div className="format-preview">
                <div className="format-item">
                  <strong>CSV 格式:</strong>
                  <code>地址,私钥,助记词</code>
                </div>
                <div className="format-item">
                  <strong>支持文件:</strong>
                  <code>CSV, TXT, XLSX, XLS</code>
                </div>
              </div>
              <div className="upload-section">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  className="upload-btn"
                  onClick={() => fileInputRef.current.click()}
                >
                  <Upload size={16} />
                  导入本地文件
                </button>
              </div>
              <textarea
                value={walletData}
                onChange={(e) => setWalletData(e.target.value)}
                placeholder={`在此粘贴钱包数据...\n每行一个钱包，逗号分隔`}
                rows={15}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="info-card info-blue">
        <h3><Info size={18} /> 导入须知</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>批量加密</strong>
            <p>系统会自动识别 CSV/JSON 格式，并在存储前完成私钥的 AES 强加密。</p>
          </div>
          <div className="info-item">
            <strong>格式校验</strong>
            <p>请确保每行数据包含有效的钱包地址和私钥，助记词为可选输入。</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}