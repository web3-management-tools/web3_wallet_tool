import React, { useState, useEffect } from 'react';
import { 
  PlusCircle, 
  Shield, 
  Settings, 
  Info, 
  RefreshCw
} from 'lucide-react';
import { createWalletList, getWalletProjects } from '../../api/wallet';
import { handleApiError } from '../../api/errorHandler';
import PasswordInput from '../../components/PasswordInput';
import './index.css';

export default function CreateWallet() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState([]);
  const [walletType, setWalletType] = useState('evm');
  const [number, setNumber] = useState(1);
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  // 消息自动消失逻辑
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadProjects = async () => {
    const res = await getWalletProjects();
    if (res.success) {
      setProjects(res.data || []);
    } else {
      handleApiError(res, setMessage);
    }
  };

  const handleCreate = async () => {
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

      if (number < 1 || number > 100) {
        setMessage({ type: 'error', text: '创建数量必须在1-100之间' });
        return;
      }

      setLoading(true);
      setMessage(null);

      const res = await createWalletList({
        type: walletType,
        number: parseInt(number, 10),
        project,
        remark: remark || undefined,
        pwd: password
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.msg || '创建成功' });
        setRemark('');
        setNumber(1);
        loadProjects(); // 刷新项目列表
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      console.error('创建钱包失败:', error);
      setMessage({ type: 'error', text: error.message || '创建失败，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-page">
      <div className="page-header">
        <div className="title-section">
          <h1>批量创建钱包</h1>
          <p>离线生成 Web3 钱包，并使用 AES 加密安全存储私钥</p>
        </div>
      </div>

      <div className="setup-section">
        <div className="setup-card">
          <div className="card-tag">CONFIG</div>
          <h3><Settings size={18} /> 核心配置</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>钱包类型</label>
              <div className="type-toggle">
                <button className={walletType === 'evm' ? 'active' : ''} onClick={() => setWalletType('evm')}>EVM</button>
                <button className={walletType === 'sol' ? 'active' : ''} onClick={() => setWalletType('sol')}>Solana</button>
              </div>
            </div>
            <div className="input-group">
              <label>创建数量 (1-100)</label>
              <input type="number" value={number} onChange={(e) => setNumber(e.target.value)} min="1" max="100" />
            </div>
            <div className="input-group">
              <label>所属项目</label>
              <input 
                type="text" 
                value={project} 
                onChange={(e) => setProject(e.target.value)} 
                placeholder="选择或输入项目名称" 
                list="project-list" 
              />
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
          <div className="card-tag">SECURITY</div>
          <h3><Shield size={18} /> 安全加密设置</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>钱包支付密码</label>
              <PasswordInput value={password} onChange={setPassword} placeholder="用于加密私钥" />
            </div>
            <div className="input-group">
              <label>确认支付密码</label>
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="再次确认" />
            </div>
            <button className="execute-btn full-row" onClick={handleCreate} disabled={loading}>
              {loading ? <RefreshCw className="spin" size={18} /> : <PlusCircle size={18} />}
              {loading ? '正在生成中...' : '立即批量创建钱包'}
            </button>
          </div>
        </div>
      </div>

      <div className="info-card">
        <h3><Info size={18} /> 安全操作指引</h3>
        <div className="info-grid">
          <div className="info-item">
            <strong>AES 强加密</strong>
            <p>私钥和助记词均在本地加密后存入数据库，服务器不存储明文密码。</p>
          </div>
          <div className="info-item">
            <strong>密码唯一性</strong>
            <p>请务必牢记支付密码，一旦丢失将无法解密私钥，资产将永久锁定。</p>
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