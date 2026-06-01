import React, { useState, useEffect } from 'react';
import {
  Send,
  Settings,
  Shield,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowRight,
  Coins,
  Wallet as WalletIcon,
  Dice5,
  MinusCircle,
  Network,
  Database,
  Info,
  FileSpreadsheet,
  RotateCcw
} from 'lucide-react';
import { ethers } from 'ethers';
import * as XLSX from 'xlsx';
import { walletList, getWalletProjects, batchQueryMapping } from '../../api/wallet';
import { decryptPrivateKey } from '../../utils/crypto';
import { getGlobalPwd } from '../../utils/globalPwd';
import './index.css';

import { COMMON_NETWORKS, COMMON_TOKENS } from '../../utils/constants';

export default function Transfer() {
  const [project, setProject] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projects, setProjects] = useState([]);
  const [network, setNetwork] = useState(COMMON_NETWORKS[0]);
  const [customRpc, setCustomRpc] = useState('');
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [tokenType, setTokenType] = useState('native');
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [tokenInfoStatus, setTokenInfoStatus] = useState('idle'); // idle|loading|ok|error — ERC20 精度(decimals)获取状态
  const [amountMode, setAmountMode] = useState('fixed');
  const [batchAmount, setBatchAmount] = useState('');
  const [randomRange, setRandomRange] = useState({ min: '', max: '' });
  const [remainAmount, setRemainAmount] = useState('');
  const [sleepRange, setSleepRange] = useState({ min: '', max: '' });
  const [gasBoost, setGasBoost] = useState('0'); // Default 0 Gwei
  const [currentGasPrice, setCurrentGasPrice] = useState(null);
  const [transferTasks, setTransferTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingBalances, setFetchingBalances] = useState(false);
  const [message, setMessage] = useState(null);

  // 多对一归集（统一目标模式）
  const [targetMode, setTargetMode] = useState('mapping'); // 'mapping'(按映射) | 'unified'(统一目标/归集)
  const [unifiedTarget, setUnifiedTarget] = useState(''); // 统一目标地址（纯勾选，不可手输）
  const [targetProjectInput, setTargetProjectInput] = useState('');
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const [targetAddrList, setTargetAddrList] = useState([]); // 目标项目的地址列表（供勾选）
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false); // 归集执行前的确认预览

  useEffect(() => {
    loadProjects();
    const handleClickOutside = (e) => {
      if (!e.target.closest('.project-autocomplete-container')) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // 消息自动消失逻辑
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

  // 自动刷新当前 Gas 价格
  useEffect(() => {
    const fetchGas = async () => {
      try {
        const rpc = getActiveRpc();
        if (!rpc) return;
        const provider = new ethers.JsonRpcProvider(rpc);
        const feeData = await provider.getFeeData();
        // 显示逻辑：优先展示 gasPrice (即当前的 Base+Priority 或 Legacy Price)，
        // 因为 maxFeePerGas 通常是 BaseFee 的2倍用于防抖，显示出来会显得虚高。
        const price = feeData.gasPrice || feeData.maxFeePerGas;
        if (price) {
          setCurrentGasPrice(parseFloat(ethers.formatUnits(price, 'gwei')).toFixed(4)); // 保留4位小数以显示低Gas链的微小变化
        }
      } catch (e) { console.warn("Fetch Gas Error:", e); }
    };
    fetchGas();
    const interval = setInterval(fetchGas, 5000); // 加快刷新频率：5秒
    return () => clearInterval(interval);
  }, [network, isCustomRpc, customRpc]);

  useEffect(() => {
    if (tokenType !== 'erc20' || !ethers.isAddress(tokenAddress)) {
      setTokenInfoStatus('idle');
      return;
    }
    const addr = tokenAddress;
    const rpcs = getRpcList();
    const fetchTokenInfo = async () => {
      setTokenInfoStatus('loading');
      // 多 RPC 重试：ETH 主网默认第一个 RPC(flashbots) 是交易型/MEV RPC，
      // 浏览器对它的 eth_call 读请求常失败(不支持/CORS)。单 RPC 无重试会导致
      // decimals 拿不到、回退默认 18，从而把 6 位代币(如 USDT)余额算成 0.0000。
      for (const rpcUrl of rpcs) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const c = new ethers.Contract(addr, [
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)"
          ], provider);
          const dec = await c.decimals(); // decimals 是金额计算关键，必须真实拿到
          if (tokenAddress !== addr) return; // 期间地址变了，丢弃过期结果
          setTokenDecimals(Number(dec));
          try { setTokenSymbol(await c.symbol()); } catch { setTokenSymbol(''); }
          setTokenInfoStatus('ok');
          return;
        } catch (e) {
          console.warn(`fetchTokenInfo via ${rpcUrl} failed, try next:`, e?.message || e);
        }
      }
      if (tokenAddress !== addr) return;
      // 所有 RPC 都失败：精度未知，明确报错并标记，转账逻辑据此阻止，避免金额算错
      setTokenInfoStatus('error');
      setTokenSymbol('');
      setMessage({ type: 'error', text: '无法获取代币精度(decimals)，已阻止转账。请检查合约地址，或换网络/自定义 RPC 重试。' });
    };
    fetchTokenInfo();
  }, [tokenAddress, tokenType, network, customRpc, isCustomRpc]);

  const loadProjects = async () => {
    const res = await getWalletProjects();
    if (res.success) setProjects(res.data || []);
  };

  const handleProjectInputChange = (value) => {
    setProjectInput(value);
    setShowProjectDropdown(true);
  };

  const handleProjectSelect = (selectedProject) => {
    setProject(selectedProject);
    setProjectInput(selectedProject);
    setShowProjectDropdown(false);
  };

  const getFilteredProjects = () => {
    if (!projectInput.trim()) return projects;
    const lowerInput = projectInput.toLowerCase();
    return projects.filter(p => p.toLowerCase().includes(lowerInput));
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
  };

  const handleFetchWallets = async () => {
    if (!project) {
      setMessage({ type: 'error', text: '请先选择项目' });
      return;
    }
    if (!getGlobalPwd()) {
      setMessage({ type: 'error', text: '请先在 系统设置 - 全局密码 配置密码' });
      return;
    }
    setLoading(true);
    try {
      const res = await walletList({ project });
      if (res.success) {
        const wallets = res.data || [];
        const decrypted = await Promise.all(wallets.map(async w => {
          try {
            const pk = await decryptPrivateKey(w.privateKey);
            // 简单验证私钥格式 (64位16进制 或 66位带0x)
            if (!pk || pk.length < 64) throw new Error('Invalid Key');
            // 尝试构建钱包以确效验证
            new ethers.Wallet(pk);
            return { ...w, privKey: pk, isValid: true };
          } catch (e) {
            return { ...w, privKey: null, isValid: false };
          }
        }));

        const validWallets = decrypted.filter(w => w.isValid);
        if (validWallets.length < decrypted.length) {
          setMessage({ type: 'error', text: `${decrypted.length - validWallets.length} 个钱包私钥解密失败或无效，已跳过` });
        }

        const sourceAddresses = validWallets.map(w => w.address);
        const mappingRes = await batchQueryMapping(sourceAddresses);
        const mappingMap = Object.fromEntries((mappingRes.data || []).map(m => [m.sourceAddress.toLowerCase(), m.targetAddress]));

        const tasks = validWallets.map(w => {
          const mappingTo = mappingMap[w.address.toLowerCase()] || '';
          return {
            from: w.address, privKey: w.privKey,
            mappingTo, // 保留原始映射目标，切换模式时可恢复
            to: targetMode === 'unified' ? unifiedTarget : mappingTo,
            balance: '0', amount: '', status: 'pending', txHash: '', error: '', selected: true
          };
        });

        setTransferTasks(tasks);
        if (tasks.length > 0) {
          setMessage({ type: 'success', text: `成功加载 ${tasks.length} 个有效钱包` });
        }
      } else { setMessage({ type: 'error', text: res.msg }); }
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  };

  const fetchBalances = async (currentTasks) => {
    const rpcList = getRpcList();
    if (rpcList.length === 0 || currentTasks.length === 0) return;
    setFetchingBalances(true);

    // 尝试可用RPC
    let provider = null;
    let connectedRpc = '';

    for (const url of rpcList) {
      try {
        const p = new ethers.JsonRpcProvider(url);
        await p.getNetwork(); // 测试连接
        provider = p;
        connectedRpc = url;
        break;
      } catch (e) {
        console.warn(`RPC ${url} 无法连接，切换下一个...`);
      }
    }

    if (!provider) {
      setMessage({ type: 'error', text: '所有RPC节点均无法连接，请检查网络' });
      setFetchingBalances(false);
      return;
    }

    try {
      const updatedTasks = await Promise.all(currentTasks.map(async (task) => {
        try {
          if (tokenType === 'native') {
            const balance = await provider.getBalance(task.from);
            return { ...task, balance: ethers.formatEther(balance) };
          } else {
            const abi = ["function balanceOf(address) view returns (uint256)"];
            const contract = new ethers.Contract(tokenAddress, abi, provider);
            const balance = await contract.balanceOf(task.from);
            return { ...task, balance: ethers.formatUnits(balance, tokenDecimals) };
          }
        } catch (e) { return task; }
      }));
      setTransferTasks(updatedTasks);
    } finally { setFetchingBalances(false); }
  };

  const calculateAmount = (task) => {
    if (amountMode === 'fixed') return task.amount || batchAmount;
    if (amountMode === 'full') {
      if (task.balance === null) return '待检测';
      const b = parseFloat(task.balance);
      if (tokenType === 'native') return b > 0.001 ? (b - 0.001).toFixed(6) : '0';
      return b.toString();
    }
    if (amountMode === 'random') {
      const min = parseFloat(randomRange.min), max = parseFloat(randomRange.max);
      if (isNaN(min) || isNaN(max)) return '0';
      return (Math.random() * (max - min) + min).toFixed(6);
    }
    if (amountMode === 'remaining') {
      if (task.balance === null) return '待检测';
      const keep = parseFloat(remainAmount), bal = parseFloat(task.balance);
      return bal > keep ? (bal - keep).toFixed(6) : '0';
    }
    return task.amount;
  };

  const executeTransfer = async (index) => {
    const task = transferTasks[index];
    // ERC20 安全闸：精度(decimals)未确认时禁止转账，避免用错精度把金额算错（如把 1 USDT 当成 1e12）
    if (tokenType === 'erc20' && tokenInfoStatus !== 'ok') {
      updateTask(index, { status: 'error', error: '代币精度未获取，已阻止（请换网络/RPC 重试）' });
      return;
    }
    const rpcUrl = getActiveRpc();

    // 规范化地址，防止 checksum 错误
    let fromAddr, toAddr, tokenAddr;
    try {
      fromAddr = ethers.getAddress(task.from); // 虽然通常 loaded 时已是 correct，但安全起见
      toAddr = ethers.getAddress(task.to);
      if (tokenType === 'erc20') {
        tokenAddr = ethers.getAddress(tokenAddress);
      }
    } catch (e) {
      // 尝试 fallback: 如果只是大小写 checksum 失败，toLowerCase 再试一次
      try {
        if (!fromAddr) fromAddr = ethers.getAddress(task.from.toLowerCase());
        if (!toAddr) toAddr = ethers.getAddress(task.to.toLowerCase());
        if (tokenType === 'erc20' && !tokenAddr) tokenAddr = ethers.getAddress(tokenAddress.toLowerCase());
      } catch (e2) {
        updateTask(index, { status: 'error', error: '地址格式无效 (Checksum Error)' });
        return;
      }
    }

    if (!toAddr || !rpcUrl) {
      updateTask(index, { status: 'error', error: '无效配置或地址' });
      return;
    }

    updateTask(index, { status: 'processing', error: '' });

    let lastError;
    const rpcList = getRpcList();

    // 遍历 RPC 列表进行重试
    for (let i = 0; i < rpcList.length; i++) {
      const currentRpc = rpcList[i];
      try {
        const provider = new ethers.JsonRpcProvider(currentRpc);
        // 简单验证 Provider 是否可用（可选，也可以直接跑业务逻辑）
        // await provider.getNetwork(); 

        const wallet = new ethers.Wallet(task.privKey, provider);

        // 1. 查询余额 & 此处确保余额是最新的
        let balance;
        let balanceBigInt; // 保留 BigInt 以便后续精确计算
        if (tokenType === 'native') {
          balanceBigInt = await provider.getBalance(fromAddr);
          balance = ethers.formatEther(balanceBigInt);
          updateTask(index, { balance });
        } else {
          const abi = ["function balanceOf(address) view returns (uint256)"];
          const contract = new ethers.Contract(tokenAddr, abi, provider);
          balanceBigInt = await contract.balanceOf(fromAddr);
          balance = ethers.formatUnits(balanceBigInt, tokenDecimals);
          updateTask(index, { balance });
        }

        // 2. 获取 Gas 价格
        const feeData = await provider.getFeeData();

        // 处理 Gas 加注 (直接增加 Gwei)
        let finalMaxFee = feeData.maxFeePerGas;
        let finalPriority = feeData.maxPriorityFeePerGas;
        let finalGasPrice = feeData.gasPrice;

        const boostVal = parseFloat(gasBoost);
        if (!isNaN(boostVal) && boostVal > 0) {
          // 输入的是 Gwei，转换为 Wei
          const addAmount = ethers.parseUnits(boostVal.toString(), 'gwei');

          // 如果是 EIP-1559
          if (finalMaxFee) {
            finalMaxFee = finalMaxFee + addAmount;
            finalPriority = finalPriority + addAmount; // 优先费也增加，即刻生效
          }

          // 如果是 Legacy
          if (finalGasPrice) {
            finalGasPrice = finalGasPrice + addAmount;
          }
        }

        // 3. 预估 Gas Limit
        let gasLimit;
        let txRequest = {};

        try {
          if (tokenType === 'native') {
            // 使用 BigInt 0n 防止 potential type issues
            txRequest = { to: toAddr, value: 0n };
            gasLimit = await provider.estimateGas({ ...txRequest, from: fromAddr });
          } else {
            const contract = new ethers.Contract(tokenAddr, ["function transfer(address to, uint256 amount) public returns (bool)"], wallet);
            // ERC20: 使用 populateTransaction. 这里的 amount 1 (1 wei) 仅用于估算
            txRequest = await contract.transfer.populateTransaction(toAddr, 1n);
            gasLimit = await provider.estimateGas(txRequest);
          }

          // 给 10% 的缓冲
          gasLimit = (gasLimit * 110n) / 100n;
        } catch (err) {
          console.warn("Gas estimate failed, reverting to default:", err);
          // 估算失败的兜底默认值。ERC20 实际多在 4-6 万(USDT 约 41321)，
          // 用 50000 而非 100000：因 EVM 按 gasLimit×maxFeePerGas 预扣，
          // 默认过大会让 gas 币(ETH)余额刚好够的钱包被误判 insufficient funds。
          gasLimit = tokenType === 'native' ? 21000n : 50000n;
        }

        // 4. 计算转账金额
        let amountStr = task.amount || batchAmount;

        if (amountMode === 'full') {
          if (tokenType === 'native') {
            const gasPrice = finalMaxFee || finalGasPrice;
            if (!gasPrice) throw new Error('无法获取Gas价格');
            const gasCost = gasLimit * gasPrice;
            const maxSend = balanceBigInt - gasCost;
            if (maxSend <= 0n) throw new Error('余额不足以支付Gas费');
            amountStr = ethers.formatEther(maxSend);
          } else {
            amountStr = balance;
          }
        } else {
          amountStr = calculateAmount({ ...task, balance });
        }

        if (parseFloat(amountStr) <= 0) {
          throw new Error(`余额不足或金额无效: ${amountStr}`);
        }

        updateTask(index, { amount: amountStr });

        // 5. 发送前进行严格的余额检查
        const sendAmountBigInt = tokenType === 'native'
          ? ethers.parseEther(amountStr)
          : ethers.parseUnits(amountStr, tokenDecimals);

        const currentGasPriceVal = finalMaxFee || finalGasPrice;
        if (!currentGasPriceVal) throw new Error('无法获取Gas价格');
        const estimatedGasCost = gasLimit * currentGasPriceVal;

        if (tokenType === 'native') {
          const totalNeed = sendAmountBigInt + estimatedGasCost;
          if (balanceBigInt < totalNeed) {
            const missing = ethers.formatEther(totalNeed - balanceBigInt);
            throw new Error(`余额不足 (缺 ${parseFloat(missing).toFixed(6)} ETH/Native 来支付金额+Gas)`);
          }
        } else {
          // ERC20: 检查代币余额
          if (balanceBigInt < sendAmountBigInt) {
            const missing = ethers.formatUnits(sendAmountBigInt - balanceBigInt, tokenDecimals);
            throw new Error(`代币余额不足 (缺 ${missing} ${tokenSymbol})`);
          }
          // ERC20: 额外检查 ETH 余额是否足够支付 Gas (可选，为了更好体验)
          try {
            const nativeBal = await provider.getBalance(fromAddr);
            if (nativeBal < estimatedGasCost) {
              throw new Error(`ETH/Native余额不足以支付Gas费`);
            }
          } catch (ignore) {
            // 如果检查Gas余额失败，暂不阻断，依靠节点报错
          }
        }

        // 6. 发送交易
        let tx;
        const txOptions = {
          gasLimit: gasLimit,
          maxFeePerGas: finalMaxFee,
          maxPriorityFeePerGas: finalPriority,
          ...(finalGasPrice && !finalMaxFee ? { gasPrice: finalGasPrice } : {})
        };

        if (tokenType === 'native') {
          tx = await wallet.sendTransaction({
            to: toAddr,
            value: ethers.parseEther(amountStr),
            ...txOptions
          });
        } else {
          const contract = new ethers.Contract(tokenAddr, ["function transfer(address to, uint256 amount) public returns (bool)"], wallet);
          tx = await contract.transfer(toAddr, ethers.parseUnits(amountStr, tokenDecimals), txOptions);
        }
        updateTask(index, { txHash: tx.hash });

        // 关键修正：防止 tx.wait() 永久挂起导致页面转圈
        try {
          // 设置 120s (2分钟) 超时等待确认
          const waitPromise = tx.wait();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Wait Timeout')), 120000));

          await Promise.race([waitPromise, timeoutPromise]);
          updateTask(index, { status: 'success' });
        } catch (waitErr) {
          console.warn("Tx sent but wait failed/timeout:", waitErr);
          // 超时也标记为成功，因为交易已由 RPC 接收并返回 Hash
          updateTask(index, { status: 'success', error: '已发送(确认超时)' });
        }
        return; //以此切断重试循环

      } catch (e) {
        lastError = e;
        console.warn(`RPC ${currentRpc} failed, try next...`, e);

        // 关键业务逻辑错误不重试切换RPC
        if (e.message && (e.message.includes('余额不足') || e.message.includes('无效配置'))) {
          break;
        }
      }
    }

    // 如果循环结束仍未成功
    let finalMsg = lastError?.shortMessage || lastError?.message || 'Transaction Failed';
    if (finalMsg.includes('could not coalesce error')) finalMsg = '所有RPC节点均无响应';
    if (finalMsg.includes('bad address checksum')) finalMsg = '地址格式校验失败';

    updateTask(index, { status: 'error', error: finalMsg });
  };

  const executeAll = () => {
    const selected = transferTasks.filter(t => t.selected && t.status !== 'success');
    if (selected.length === 0) {
      setMessage({ type: 'error', text: '没有选中的待执行任务' });
      return;
    }
    // 统一目标（归集）模式：校验 + 确认预览
    if (targetMode === 'unified') {
      if (!unifiedTarget) {
        setMessage({ type: 'error', text: '请先在「目标设置」中勾选一个目标地址' });
        return;
      }
      const tgt = unifiedTarget.toLowerCase();
      if (selected.some(t => t.from.toLowerCase() === tgt)) {
        setMessage({ type: 'error', text: '目标地址不能是所选源之一（不能自己转给自己），请取消该源或更换目标' });
        return;
      }
      setShowConfirm(true); // 归集不可逆：先弹确认预览，核对后再执行
      return;
    }
    doExecuteAll();
  };

  const doExecuteAll = async () => {
    setShowConfirm(false);
    const ready = transferTasks.map((t, i) => t.selected && t.status !== 'success' && t.to ? i : -1).filter(i => i !== -1);
    if (ready.length === 0) {
      setMessage({ type: 'error', text: '没有选中的待执行任务（请检查目标地址是否已设置）' });
      return;
    }
    setLoading(true);

    const minSleep = parseFloat(sleepRange.min);
    const maxSleep = parseFloat(sleepRange.max);
    const shouldSleep = !isNaN(minSleep) && !isNaN(maxSleep) && maxSleep > minSleep;

    for (let k = 0; k < ready.length; k++) {
      const i = ready[k];
      await executeTransfer(i);

      // 如果开启了休眠，且不是最后一个任务，则进行等待
      if (shouldSleep && k < ready.length - 1) {
        const sleepTime = Math.random() * (maxSleep - minSleep) + minSleep;
        await new Promise(resolve => setTimeout(resolve, sleepTime * 1000));
      }
    }
    setLoading(false);
    setMessage({ type: 'success', text: '批量转账任务执行完毕' });
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
      '发送方': t.from,
      '接收方': t.to,
      '金额': t.amount,
      '资产': tokenType === 'native' ? '原生币' : tokenSymbol,
      '交易哈希': t.txHash || '',
      '错误信息': t.error || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transfer Results");
    XLSX.writeFile(wb, `transfer_results_${new Date().getTime()}.xlsx`);
  };

  const updateTask = (index, updates) => {
    setTransferTasks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // 统一目标模式：模式或目标变化时，同步所有任务的接收方
  useEffect(() => {
    setTransferTasks(prev => prev.map(t => ({
      ...t,
      to: targetMode === 'unified' ? unifiedTarget : (t.mappingTo || '')
    })));
  }, [targetMode, unifiedTarget]);

  const toggleSelectAll = (checked) => {
    setTransferTasks(prev => prev.map(t => ({ ...t, selected: checked })));
  };

  // 目标项目：拉取该项目地址供勾选（统一目标模式，纯勾选不解密，故 pwd:'1'）
  const loadTargetAddresses = async (proj) => {
    setLoadingTargets(true);
    setUnifiedTarget('');
    try {
      const res = await walletList({ project: proj, pwd: '1' });
      if (res.success) {
        setTargetAddrList((res.data || []).map(w => ({ address: w.address, remark: w.remark || '' })));
      } else {
        setTargetAddrList([]);
        setMessage({ type: 'error', text: res.msg || '加载目标地址失败' });
      }
    } catch (e) {
      setTargetAddrList([]);
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoadingTargets(false);
    }
  };
  const handleTargetProjectSelect = (p) => {
    setTargetProjectInput(p);
    setShowTargetDropdown(false);
    loadTargetAddresses(p);
  };

  // 当前网络下的常用代币（USDT/USDC）快捷项；自定义 RPC 时链未知，不展示以免填错地址
  const quickTokens = (!isCustomRpc && COMMON_TOKENS[network.chainId])
    ? Object.entries(COMMON_TOKENS[network.chainId]).map(([sym, addr]) => ({ sym, addr }))
    : [];

  return (
    <div className="transfer-page">
      <div className="transfer-header">
        <div className="title-section">
          <h1>EVM批量转账管理</h1>
          <p>支持多链原生币及 ERC20 代币的一对多灵活分发</p>
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

      <section className="setup-section">
        <div className="setup-card source-card">
          <div className="card-tag">STEP 1</div>
          <h3><Database size={18} /> 数据源与安全</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>源项目</label>
              <div className="project-autocomplete-container">
                <input
                  type="text"
                  placeholder="输入项目名称搜索..."
                  value={projectInput}
                  onChange={(e) => handleProjectInputChange(e.target.value)}
                  onFocus={() => setShowProjectDropdown(true)}
                />
                {showProjectDropdown && (
                  <div className="autocomplete-dropdown">
                    {getFilteredProjects().length > 0 ? (
                      getFilteredProjects().map(p => (
                        <div
                          key={p}
                          className="autocomplete-item"
                          onClick={() => handleProjectSelect(p)}
                        >
                          {p}
                        </div>
                      ))
                    ) : (
                      <div className="autocomplete-item no-result" style={{ cursor: 'default', color: 'var(--text-muted)' }}>无匹配项目</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button className="fetch-btn" onClick={handleFetchWallets} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              {loading ? '加载中...' : '加载钱包'}
            </button>
          </div>
        </div>

        <div className="setup-card target-card">
          <div className="card-tag">STEP 1.5</div>
          <h3><Coins size={18} /> 目标设置</h3>
          <div className="setup-grid">
            <div className="input-group full-row">
              <label>目标模式</label>
              <div className="type-toggle">
                <button className={targetMode === 'mapping' ? 'active' : ''} onClick={() => setTargetMode('mapping')}>按映射（各源各目标）</button>
                <button className={targetMode === 'unified' ? 'active' : ''} onClick={() => setTargetMode('unified')}>统一目标（多对一归集）</button>
              </div>
            </div>
            {targetMode === 'unified' && (
              <>
                <div className="input-group">
                  <label>目标项目</label>
                  <div className="project-autocomplete-container">
                    <input
                      type="text"
                      placeholder="输入目标项目名称搜索..."
                      value={targetProjectInput}
                      onChange={(e) => { setTargetProjectInput(e.target.value); setShowTargetDropdown(true); }}
                      onFocus={() => setShowTargetDropdown(true)}
                    />
                    {showTargetDropdown && (
                      <div className="autocomplete-dropdown">
                        {projects.filter(p => !targetProjectInput || p.toLowerCase().includes(targetProjectInput.toLowerCase())).length > 0 ? (
                          projects.filter(p => !targetProjectInput || p.toLowerCase().includes(targetProjectInput.toLowerCase())).map(p => (
                            <div key={p} className="autocomplete-item" onClick={() => handleTargetProjectSelect(p)}>{p}</div>
                          ))
                        ) : (
                          <div className="autocomplete-item no-result" style={{ cursor: 'default', color: 'var(--text-muted)' }}>无匹配项目</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="input-group full-row">
                  <label>选择目标地址（勾选，不可手输）</label>
                  {loadingTargets ? (
                    <div className="target-list-hint">加载中...</div>
                  ) : targetAddrList.length > 0 ? (
                    <div className="target-addr-list">
                      {targetAddrList.map(a => (
                        <label key={a.address} className={`target-addr-item ${unifiedTarget === a.address ? 'selected' : ''}`}>
                          <input type="radio" name="unifiedTarget" checked={unifiedTarget === a.address} onChange={() => setUnifiedTarget(a.address)} />
                          <span className="ta-remark">{a.remark || '(无备注)'}</span>
                          <span className="ta-addr">{a.address}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="target-list-hint">{targetProjectInput ? '该项目暂无地址，请先在「导入钱包」中导入收款地址' : '请先选择目标项目'}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="setup-card config-card">
          <div className="card-tag">STEP 2</div>
          <h3><Network size={18} /> 网络与资产</h3>
          <div className="setup-grid">
            <div className="input-group">
              <label>网络环境</label>
              <select onChange={handleNetworkChange}>
                {COMMON_NETWORKS.map(n => <option key={n.chainId} value={n.chainId}>{n.name}</option>)}
                <option value="custom">-- 自定义 RPC --</option>
              </select>
            </div>
            <div className="input-group">
              <label>代币类型</label>
              <div className="type-toggle">
                <button className={tokenType === 'native' ? 'active' : ''} onClick={() => setTokenType('native')}>原生币</button>
                <button className={tokenType === 'erc20' ? 'active' : ''} onClick={() => setTokenType('erc20')}>ERC20</button>
              </div>
            </div>
            {isCustomRpc && (
              <div className="input-group full-row">
                <label>RPC 节点地址</label>
                <input type="text" placeholder="https://..." value={customRpc} onChange={(e) => setCustomRpc(e.target.value)} />
              </div>
            )}
            {tokenType === 'erc20' && (
              <div className="input-group full-row">
                <label>合约地址</label>
                <div className="token-info-input">
                  <input type="text" placeholder="0x..." value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} />
                  {tokenSymbol && <span className="token-badge">{tokenSymbol} ({tokenDecimals})</span>}
                </div>
                {quickTokens.length > 0 && (
                  <div className="quick-token-row">
                    <span className="quick-token-label">常用代币</span>
                    {quickTokens.map(({ sym, addr }) => (
                      <button
                        key={sym}
                        type="button"
                        className={`quick-token-chip ${tokenAddress.toLowerCase() === addr.toLowerCase() ? 'active' : ''}`}
                        onClick={() => setTokenAddress(addr)}
                        title={addr}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="input-group">
              <label>任务随机休眠(秒)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="text" placeholder="Min" value={sleepRange.min} onChange={(e) => setSleepRange({ ...sleepRange, min: e.target.value })} style={{ width: '70px', textAlign: 'center' }} />
                <span style={{ color: 'var(--text-secondary)' }}>-</span>
                <input type="text" placeholder="Max" value={sleepRange.max} onChange={(e) => setSleepRange({ ...sleepRange, max: e.target.value })} style={{ width: '70px', textAlign: 'center' }} />
              </div>
            </div>

            <div className="input-group">
              <label>
                Gas加注 (Gwei)
                {currentGasPrice && <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginLeft: '8px' }}>当前: {currentGasPrice}</span>}
              </label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="例: 2 (增加2 Gwei)"
                  value={gasBoost}
                  onChange={(e) => setGasBoost(e.target.value)}
                  style={{ width: '120px' }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tasks-section">
        <div className="tasks-container">
          <div className="tasks-header">
            <div className="execution-modes">
              <div className="mode-tabs">
                <button className={amountMode === 'fixed' ? 'active' : ''} onClick={() => setAmountMode('fixed')}><WalletIcon size={14} /> 固定</button>
                <button className={amountMode === 'full' ? 'active' : ''} onClick={() => setAmountMode('full')}><CheckCircle size={14} /> 全额</button>
                <button className={amountMode === 'random' ? 'active' : ''} onClick={() => setAmountMode('random')}><Dice5 size={14} /> 随机</button>
                <button className={amountMode === 'remaining' ? 'active' : ''} onClick={() => setAmountMode('remaining')}><MinusCircle size={14} /> 剩余</button>
              </div>

              <div className="mode-params">
                {amountMode === 'fixed' && <input type="text" placeholder="金额" value={batchAmount} onChange={(e) => setBatchAmount(e.target.value)} />}
                {amountMode === 'random' && (
                  <div className="range-box">
                    <input type="text" placeholder="Min" value={randomRange.min} onChange={(e) => setRandomRange({ ...randomRange, min: e.target.value })} />
                    <span>-</span>
                    <input type="text" placeholder="Max" value={randomRange.max} onChange={(e) => setRandomRange({ ...randomRange, max: e.target.value })} />
                  </div>
                )}
                {amountMode === 'remaining' && <input type="text" placeholder="保留" value={remainAmount} onChange={(e) => setRemainAmount(e.target.value)} />}

                <div className="task-actions">
                  <button className="query-balance-btn" onClick={() => fetchBalances(transferTasks)} disabled={fetchingBalances || transferTasks.length === 0}>
                    <RefreshCw size={16} className={fetchingBalances ? 'spin' : ''} /> {fetchingBalances ? '查询中...' : '余额查询'}
                  </button>
                  <button className="retry-btn" onClick={retryFailed} disabled={loading || !transferTasks.some(t => t.selected && t.status === 'error')}>
                    <RotateCcw size={16} /> 重试失败
                  </button>
                  <button className="run-all-btn" onClick={executeAll} disabled={loading || transferTasks.length === 0}>
                    <Send size={16} /> 批量执行
                  </button>
                </div>
              </div>
            </div>
          </div>

          {targetMode === 'unified' && unifiedTarget && (
            <div className="unified-target-banner">
              <ArrowRight size={16} /> 全部归集至：<span className="utb-addr">{unifiedTarget}</span>
            </div>
          )}

          <div className="task-grid-view">
            {transferTasks.length > 0 ? (
              <div className="task-table-wrapper">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th width="40">
                        <input
                          type="checkbox"
                          checked={transferTasks.length > 0 && transferTasks.every(t => t.selected)}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th width="80">状态</th>
                      <th>发送方 (余额)</th>
                      <th width="40"></th>
                      <th>接收方</th>
                      <th width="150">转账金额</th>
                      <th width="120">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferTasks.map((task, index) => (
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
                            {task.status === 'pending' && '等待'}
                          </div>
                          {task.status === 'error' && task.error && (
                            <div
                              className="error-reason-text"
                              title={task.error}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                navigator.clipboard.writeText(task.error);
                                setMessage({ type: 'success', text: '错误信息已复制' });
                              }}
                            >
                              {task.error}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="wallet-info">
                            <span className="addr-mono">{task.from}</span>
                            <span className="bal-text">
                              {task.status === 'pending' ? '' : `${parseFloat(task.balance).toFixed(4)} ${tokenType === 'native' ? 'ETH' : tokenSymbol}`}
                            </span>
                          </div>
                        </td>
                        <td><ArrowRight size={14} className="sep-icon" /></td>
                        <td>
                          {targetMode === 'unified' ? (
                            <span className="addr-mono unified-to" title={task.to}>{task.to || '未选目标'}</span>
                          ) : (
                            <input
                              type="text"
                              className="inline-addr-input"
                              value={task.to}
                              onChange={(e) => updateTask(index, { to: e.target.value })}
                              placeholder="目标地址"
                            />
                          )}
                        </td>
                        <td>
                          <div className="amount-cell">
                            {amountMode === 'fixed' ? (
                              <input type="text" value={task.amount || batchAmount} onChange={(e) => updateTask(index, { amount: e.target.value })} />
                            ) : (
                              <span className="auto-val">{calculateAmount(task)}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="row-actions">
                            {task.txHash && <a href={`${getActiveRpc()?.includes('sepolia') ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'}/tx/${task.txHash}`} target="_blank" rel="noreferrer" className="tx-tag">TX</a>}
                            <button className="send-single-btn" onClick={() => executeTransfer(index)} disabled={task.status === 'processing'}>
                              发送
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="tasks-placeholder">
                <div className="empty-icon"><Database size={48} /></div>
                <p>请完成 STEP 1 加载钱包数据</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3><AlertCircle size={18} /> 确认归集（不可逆）</h3>
            <div className="confirm-body">
              <div className="confirm-row"><span>源钱包</span><b>{transferTasks.filter(t => t.selected && t.status !== 'success').length} 个</b></div>
              <div className="confirm-row"><span>目标地址</span><b className="confirm-target">{unifiedTarget}</b></div>
              <div className="confirm-row"><span>金额模式</span><b>{({ fixed: '固定', full: '全额', random: '随机', remaining: '剩余' })[amountMode]}{amountMode === 'fixed' && batchAmount ? ` ${batchAmount}` : ''}</b></div>
              <div className="confirm-sources-label">将从以下源转出：</div>
              <div className="confirm-sources">
                {transferTasks.filter(t => t.selected && t.status !== 'success').map((t, i) => (
                  <div key={i} className="cs-row">{t.from}</div>
                ))}
              </div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="confirm-ok" onClick={doExecuteAll}>确认归集</button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`toast-msg ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
