import React, { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  Info,
  PlusCircle,
  ArrowRightLeft,
  Settings,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  ListFilter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { batchImportMapping, batchQueryMapping } from '../../api/wallet';
import { handleApiError } from '../../api/errorHandler';
import './index.css';

export default function Mapping() {
  const [importData, setImportData] = useState('');
  const [project, setProject] = useState('');
  const [remark, setRemark] = useState('');
  const [queryAddresses, setQueryAddresses] = useState('');
  const [queryResults, setQueryResults] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('import');

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const parseImportData = (data) => {
    data = data.trim();
    if (data.startsWith('[')) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    const lines = data.split('\n').filter(line => line.trim());
    const mappings = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        mappings.push({
          sourceAddress: parts[0],
          targetAddress: parts[1]
        });
      }
    }
    return mappings.length > 0 ? mappings : null;
  };

  const handleImport = async () => {
    try {
      if (!importData.trim()) {
        setMessage({ type: 'error', text: '请输入映射数据' });
        return;
      }
      const mappings = parseImportData(importData);
      if (!mappings) {
        setMessage({ type: 'error', text: '映射数据格式不正确' });
        return;
      }
      setLoading(true);
      const res = await batchImportMapping({
        mappingList: mappings,
        project: project || undefined,
        remark: remark || undefined
      });
      if (res.success) {
        setMessage({ type: 'success', text: '导入配置成功' });
        setImportData('');
        setRemark('');
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '导入失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuery = async () => {
    try {
      if (!queryAddresses.trim()) {
        setMessage({ type: 'error', text: '请输入查询地址' });
        return;
      }
      const inputAddrs = queryAddresses.split('\n')
        .map(a => a.trim())
        .filter(a => a.length > 0);

      if (inputAddrs.length === 0) return;

      setLoading(true);
      const res = await batchQueryMapping(inputAddrs);
      
      if (res.success) {
        const foundMap = Object.fromEntries((res.data || []).map(m => [m.sourceAddress.toLowerCase(), m]));
        const alignedResults = inputAddrs.map(addr => {
          const match = foundMap[addr.toLowerCase()];
          return {
            source: addr,
            target: match ? match.targetAddress : '',
            project: match ? match.project : '',
            remark: match ? match.remark : '',
            found: !!match,
            selected: true
          };
        });
        setQueryResults(alignedResults);
        setMessage({ type: 'success', text: `查询完成，匹配 ${res.data?.length || 0}/${inputAddrs.length}` });
      } else {
        handleApiError(res, setMessage);
      }
    } catch (error) {
      setMessage({ type: 'error', text: '查询出错' });
    } finally {
      setLoading(false);
    }
  };

  const selectFilter = (type) => {
    setQueryResults(prev => prev.map(item => ({
      ...item,
      selected: type === 'all' ? true : (type === 'found' ? item.found : !item.found)
    })));
  };

  const handleExportQueryResults = () => {
    const selectedData = queryResults.filter(r => r.selected);
    if (selectedData.length === 0) {
      setMessage({ type: 'error', text: '未选中任何数据' });
      return;
    }
    const data = selectedData.map(r => ({
      '源地址': r.source,
      '目标地址': r.found ? r.target : '未配置',
      '状态': r.found ? '匹配成功' : '缺失',
      '项目': r.project || '',
      '备注': r.remark || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QueryResults");
    XLSX.writeFile(wb, `query_mapping_${new Date().getTime()}.xlsx`);
  };

  const formatAddress = (addr) => {
    if (!addr) return '-';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const updateResultItem = (index, updates) => {
    setQueryResults(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  return (
    <div className="mapping-page">
      <div className="page-header">
        <div className="title-section">
          <h1>转账目标钱包配置</h1>
          <p>配置源地址与目标地址的 1:1 映射关系，转账时将自动匹配</p>
        </div>
      </div>

      <div className="mapping-content">
        <section className="config-section">
          <div className="setup-card config-card">
            <div className="card-tag">CONFIG</div>
            <div className="config-header-row">
              <h3><Settings size={18} /> 操作模式</h3>
              <div className="tab-switcher-horizontal">
                <button className={activeTab === 'import' ? 'active' : ''} onClick={() => setActiveTab('import')}> 
                  <PlusCircle size={16} /> 批量导入
                </button>
                <button className={activeTab === 'query' ? 'active' : ''} onClick={() => setActiveTab('query')}> 
                  <Search size={16} /> 查询关系
                </button>
              </div>
              <div className="quick-info">
                <Info size={14} /> 映射关系用于转账时自动填入目标地址
              </div>
            </div>
          </div>
        </section>

        <section className="action-section">
          {activeTab === 'import' ? (
            <div className="action-card">
              <div className="card-tag">STEP 1</div>
              <h3><FileText size={18} /> 导入配置数据</h3>
              <div className="form-body">
                <div className="input-layout-row">
                  <div className="textarea-wrap">
                    <div className="format-hints">
                      <code>格式：源地址,目标地址</code>
                    </div>
                    <textarea
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      placeholder={`在此输入映射关系数据...\n每行一个: 源地址,目标地址`}
                      rows={8}
                    />
                  </div>
                  <div className="params-wrap">
                    <div className="input-field">
                      <label>所属项目 (可选)</label>
                      <input type="text" value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project Name" />
                    </div>
                    <div className="input-field">
                      <label>备注信息 (可选)</label>
                      <input type="text" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark" />
                    </div>
                    <button className="execute-btn import-style" onClick={handleImport} disabled={loading}>
                      {loading ? <RefreshCw className="spin" size={18} /> : <PlusCircle size={18} />} 立即导入配置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="action-card">
              <div className="card-tag">QUERY</div>
              <h3><Search size={18} /> 批量查询目标</h3>
              <div className="form-body">
                <div className="input-layout-row">
                  <textarea
                    className="flex-1"
                    value={queryAddresses}
                    onChange={(e) => setQueryAddresses(e.target.value)}
                    placeholder="每行输入一个源地址进行查询..."
                    rows={8}
                  />
                  <div className="params-wrap narrow">
                    <button className="execute-btn" onClick={handleQuery} disabled={loading}>
                      {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />} 执行查询
                    </button>
                  </div>
                </div>

                {queryResults.length > 0 && (
                  <div className="query-results-box">
                    <div className="results-toolbar">
                      <div className="selection-group-horizontal">
                        <div className="group-label"><ListFilter size={14} /> 批量选择：</div>
                        <div className="btn-group">
                          <button onClick={() => selectFilter('all')}>全部结果</button>
                          <button onClick={() => selectFilter('found')}>已匹配项</button>
                          <button onClick={() => selectFilter('missing')}>缺失地址</button>
                        </div>
                      </div>
                      <button className="export-mini-btn" onClick={handleExportQueryResults}>
                        <FileSpreadsheet size={14} /> 导出选中项
                      </button>
                    </div>
                    <div className="results-wrapper">
                      <table className="mini-table">
                        <thead>
                          <tr>
                            <th width="40"></th>
                            <th width="60">状态</th>
                            <th>源地址</th>
                            <th width="30"></th>
                            <th>目标地址</th>
                            <th>备注</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.map((item, index) => (
                            <tr key={index} className={item.found ? 'found-row' : 'missing-row'}>
                              <td>
                                <div className="check-cell" onClick={() => updateResultItem(index, {selected: !item.selected})}>
                                  {item.selected ? <CheckSquare size={16} className="checked" /> : <Square size={16} className="unchecked" />}
                                </div>
                              </td>
                              <td>
                                <div className={`icon-status ${item.found ? 'success' : 'error'}`}>
                                  {item.found ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                                </div>
                              </td>
                              <td className="mono">{formatAddress(item.source)}</td>
                              <td>{item.found && <ArrowRightLeft size={12} />}</td>
                              <td className="mono primary-text">{item.found ? formatAddress(item.target) : '--'}</td>
                              <td className="muted-text">{item.remark || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}