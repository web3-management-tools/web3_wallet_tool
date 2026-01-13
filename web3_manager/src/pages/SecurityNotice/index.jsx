import React from 'react';
import { ShieldAlert, Ghost, Info, ExternalLink } from 'lucide-react';
import './index.css';

export default function SecurityNotice() {
  return (
    <div className="security-notice-page">
      <div className="notice-card">
        <div className="icon-badge">
          <ShieldAlert size={48} color="#ef4444" />
        </div>
        
        <h1>安全访问限制</h1>
        <p className="main-desc">
          为了保护您的 <strong>Web3 资产安全</strong>，本系统强制要求在浏览器 <span className="highlight">无痕 (Incognito)</span> 模式下运行。
        </p>

        <div className="reason-box">
          <div className="reason-item">
            <Ghost size={20} />
            <div>
              <strong>防止数据残留</strong>
              <p>无痕模式确保在关闭浏览器后，内存中的私钥、密码及会话信息被彻底清除。</p>
            </div>
          </div>
          <div className="reason-item">
            <Info size={20} />
            <div>
              <strong>拦截恶意扩展</strong>
              <p>大部分浏览器插件在无痕模式下默认禁用，有效防止插件窃取钱包敏感信息。</p>
            </div>
          </div>
        </div>

        <div className="guide-section">
          <h3>如何开启无痕模式？</h3>
          <div className="steps-grid">
            <div className="step-item">
              <strong>Chrome / Edge</strong>
              <code>Ctrl + Shift + N</code>
            </div>
            <div className="step-item">
              <strong>Firefox</strong>
              <code>Ctrl + Shift + P</code>
            </div>
          </div>
        </div>

        <button className="reload-btn" onClick={() => window.location.reload()}>
          我已切换，立即检测
        </button>
        
        <div className="footer-tip">
          <ExternalLink size={12} /> 
          若您确认已在无痕模式仍看到此页，请尝试手动开启存储权限。
        </div>
      </div>
    </div>
  );
}
