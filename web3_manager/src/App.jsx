import React, { useState, useEffect } from 'react';
import {
  Wallet,
  PlusCircle,
  Download,
  Link2,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Send,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  ArrowRightLeft,
  FolderKanban,
  Building2,
  Share2,
  ArrowUpRight
} from 'lucide-react';
import WalletList from './pages/WalletList';
import CreateWallet from './pages/CreateWallet';
import ImportWallet from './pages/ImportWallet';
import Mapping from './pages/Mapping';
import Transfer from './pages/Transfer';
import Distribution from './pages/Distribution';
import ProjectInfo from './pages/ProjectInfo';
import Exchange from './pages/Exchange';
import SecurityNotice from './pages/SecurityNotice';
import './App.css';

function App() {
  const [isPrivate, setIsPrivate] = useState(null); // null: checking, true: private, false: normal
  const [currentPage, setCurrentPage] = useState('project-info');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState(['wallet-mgmt']);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    detectIncognito();

    // 监听从 ProjectInfo 发来的导航事件
    const handleNavigate = (event) => {
      if (event.detail && event.detail.project) {
        setSelectedProject(event.detail.project);
        setCurrentPage('wallet-list');
        setExpandedMenus(['wallet-mgmt']);
      }
    };
    window.addEventListener('navigate-to-wallet-list', handleNavigate);
    return () => window.removeEventListener('navigate-to-wallet-list', handleNavigate);
  }, []);

  const detectIncognito = async () => {
    let isIncognito = false;

    try {
      // 1. Chrome & Edge detection (Quota based - Reliable for Chromium 76+)
      if (navigator.storage && navigator.storage.estimate) {
        const { quota } = await navigator.storage.estimate();
        // 通常普通模式配额远大于 10GB，无痕模式通常小于 4GB (甚至是几百MB)
        if (quota < 8000000000) { 
          isIncognito = true;
        }
      }

      // 2. Firefox detection (IndexedDB based)
      if (!isIncognito && /Firefox/.test(navigator.userAgent)) {
        isIncognito = await new Promise(resolve => {
          const db = indexedDB.open("test_incognito");
          db.onerror = () => resolve(true);
          db.onsuccess = () => {
            indexedDB.deleteDatabase("test_incognito");
            resolve(false);
          };
        });
      }

      // 3. Safari detection
      if (!isIncognito && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
        try {
          window.openDatabase(null, null, null, null);
          isIncognito = false;
        } catch (e) {
          isIncognito = true;
        }
      }
    } catch (e) {
      isIncognito = false;
    }

    console.log("Detection Result - isIncognito:", isIncognito);
    setIsPrivate(isIncognito);
  };

  const navGroups = [
    {
      id: 'wallet-mgmt',
      label: '钱包管理',
      icon: <Wallet size={20} />,
      children: [
        { id: 'project-info', label: '项目信息', icon: <FolderKanban size={18} /> },
        { id: 'wallet-list', label: '钱包列表', icon: <LayoutDashboard size={18} /> },
        { id: 'create-wallet', label: '创建钱包', icon: <PlusCircle size={18} /> },
        { id: 'import-wallet', label: '导入钱包', icon: <Download size={18} /> },
      ]
    },
    {
      id: 'transfer-mgmt',
      label: '转账管理',
      icon: <Send size={20} />,
      children: [
        { id: 'mapping', label: '目标钱包配置', icon: <ArrowRightLeft size={18} /> },
        { id: 'transfer', label: '多链转账', icon: <Send size={18} /> },
        { id: 'distribution', label: '钱包分发', icon: <Share2 size={18} /> },
      ]
    },
    {
      id: 'exchange-mgmt',
      label: '交易所管理',
      icon: <Building2 size={20} />,
      children: [
        { id: 'exchange', label: '交易所API管理', icon: <Building2 size={18} /> },
        { id: 'exchange-withdraw', label: '交易所提现', icon: <ArrowUpRight size={18} /> },
      ]
    }
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'wallet-list': return <WalletList initialProject={selectedProject} />;
      case 'project-info': return <ProjectInfo />;
      case 'create-wallet': return <CreateWallet />;
      case 'import-wallet': return <ImportWallet />;
      case 'mapping': return <Mapping />;
      case 'transfer': return <Transfer />;
      case 'distribution': return <Distribution />;
      case 'exchange': return <Exchange />;
      case 'exchange-withdraw': return <Exchange initialTab="withdraw" />;
      default: return <WalletList />;
    }
  };

  const handleNavClick = (pageId) => {
    setCurrentPage(pageId);
    setMobileMenuOpen(false);
  };

  const toggleGroup = (groupId) => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
      setExpandedMenus([groupId]);
      return;
    }
    setExpandedMenus(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  // 如果探测为普通模式 (isPrivate === false)，拦截并显示提醒页
  if (isPrivate === false) {
    return <SecurityNotice />;
  }

  // 探测中显示空白或加载态
  if (isPrivate === null) {
    return <div style={{ background: '#0f172a', minHeight: '100vh' }} />;
  }

  // 仅在 isPrivate === true (无痕模式) 时渲染主应用
  return (
    <div className="app">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="mobile-logo">
          <ShieldCheck size={24} />
          <span>Web3 Manager</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <ShieldCheck size={28} />
            <span>Web3 Manager</span>
          </div>
          <button
            className="collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.id} className="nav-group">
              <button 
                className={`nav-group-header ${expandedMenus.includes(group.id) ? 'expanded' : ''}`}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="nav-icon">{group.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span className="nav-label">{group.label}</span>
                    <span className="group-arrow">
                      {expandedMenus.includes(group.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </>
                )}
              </button>
              
              {expandedMenus.includes(group.id) && !sidebarCollapsed && (
                <div className="nav-group-children">
                  {group.children.map(child => (
                    <button
                      key={child.id}
                      className={`sidebar-nav-item ${currentPage === child.id ? 'active' : ''}`}
                      onClick={() => handleNavClick(child.id)}
                    >
                      <span className="nav-icon-sm">{child.icon}</span>
                      <span className="nav-label">{child.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {sidebarCollapsed && (
                <div className="collapsed-indicator">
                  {group.children.some(c => c.id === currentPage) && <div className="active-dot" />}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-content">
            <p>Web3资产安全管理</p>
            <p style={{ fontSize: '11px', marginTop: '4px' }}>v1.0.0</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="app-main">
        <div className="main-content-wrapper">
          {renderPage()}
        </div>
      </main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}
    </div>
  );
}

export default App;
