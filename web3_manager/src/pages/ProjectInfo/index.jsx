import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  RefreshCw,
  FileSpreadsheet,
  BarChart3,
  Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getProjectStats } from '../../api/wallet';
import { handleApiError } from '../../api/errorHandler';
import './index.css';

export default function ProjectInfo() {
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    loadStats();

    // 监听来自其他页面的项目选择
    const handleProjectSelect = (event) => {
      if (event.detail && event.detail.project) {
        setSelectedProject(event.detail.project);
      }
    };
    window.addEventListener('project-select', handleProjectSelect);
    return () => window.removeEventListener('project-select', handleProjectSelect);
  }, []);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await getProjectStats();
      if (res.success) {
        setProjects(res.data?.projects || []);
        setTotal(res.data?.total || 0);
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      console.error('获取项目统计失败:', error);
      setMessage({ type: 'error', text: '获取数据失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleProjectClick = (projectName) => {
    // 触发自定义事件通知父组件切换页面
    window.dispatchEvent(new CustomEvent('navigate-to-wallet-list', {
      detail: { project: projectName }
    }));
  };

  const handleExport = () => {
    if (projects.length === 0) {
      setMessage({ type: 'error', text: '无可导出数据' });
      return;
    }

    const exportData = projects.map((p, index) => ({
      '序号': index + 1,
      '项目名称': p.project,
      '钱包数量': p.count
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ProjectStats");

    const fileName = `project_stats_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    setMessage({ type: 'success', text: '统计数据已导出' });
  };

  return (
    <div className="project-page">
      <div className="page-header">
        <div className="title-section">
          <h1>项目信息</h1>
          <p>查看所有项目及其钱包统计信息</p>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={loadStats} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> 刷新
          </button>
          <button className="export-btn" onClick={handleExport} disabled={projects.length === 0}>
            <FileSpreadsheet size={16} /> 导出
          </button>
        </div>
      </div>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.text}
        </div>
      )}

      <section className="stats-summary">
        <div className="summary-card">
          <FolderKanban size={28} />
          <div className="summary-info">
            <span className="summary-value">{loading ? '-' : projects.length}</span>
            <span className="summary-label">项目数</span>
          </div>
        </div>
        <div className="summary-card">
          <Wallet size={28} />
          <div className="summary-info">
            <span className="summary-value">{loading ? '-' : total}</span>
            <span className="summary-label">总钱包数</span>
          </div>
        </div>
      </section>

      <section className="results-section">
        {loading ? (
          <div className="loading-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton-card"></div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="project-grid">
            {projects.map((project, index) => (
              <div key={project.project} className="project-card" onClick={() => handleProjectClick(project.project)}>
                <div className="project-card-header">
                  <FolderKanban size={20} />
                  <span className="project-index">#{index + 1}</span>
                </div>
                <div className="project-card-body">
                  <h3 className="project-name">{project.project}</h3>
                  <div className="project-count">
                    <span className="count-number">{project.count}</span>
                    <span className="count-label">钱包数量</span>
                  </div>
                </div>
                <div className="project-card-footer">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min((project.count / total) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <BarChart3 size={48} />
            <p>暂无项目数据</p>
          </div>
        )}
      </section>
    </div>
  );
}