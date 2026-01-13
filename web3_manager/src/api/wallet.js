import apiClient from './index';
import { encryptPrivateKey, encryptPhrase } from '../utils/crypto';

/**
 * 获取钱包项目列表
 */
export function getWalletProjects() {
  return apiClient.get('/wallet/projects');
}

/**
 * 获取项目统计信息
 */
export function getProjectStats() {
  return apiClient.get('/wallet/project/stats');
}

/**
 * 查询钱包列表
 * @param {Object} params 查询参数
 * @param {string} params.address 钱包地址（可选）
 * @param {string} params.project 项目标识（可选）
 * @param {string} params.pwd 密码（自动加密）
 */
export function walletList(params) {
  return apiClient.post('/wallet/list', params);
}

/**
 * 查询单个钱包
 * @param {string} address 钱包地址
 * @param {string} pwd 密码（自动加密）
 */
export function oneWallet(address, pwd) {
  return apiClient.get('/wallet/one', {
    params: { address, pwd }
  });
}

/**
 * 批量导入钱包
 * @param {Object} data 导入数据
 * @param {string[]} data.walletList 钱包列表，格式：["地址,加密私钥,加密助记词", ...]
 * @param {string} data.project 项目标识
 * @param {string} data.remark 备注
 * @param {string} data.pwd 密码（自动加密）
 * @param {boolean} data.autoEncrypt 是否自动加密私钥（默认true）
 */
export async function insertWalletList(data) {
  // ImportWallet 已经在调用前加密过了，这里不再重复加密
  // 如果需要自动加密私钥（由调用方控制）
  if (data.autoEncrypt === true) {
    // 注意：如果 autoEncrypt 为 true，调用方应该传入未加密的数据
    // 但 ImportWallet 已经加密过了，所以这里不处理
  }
  return apiClient.post('/wallet/insert', data);
}

/**
 * 批量创建钱包
 * @param {Object} data 创建数据
 * @param {string} data.type 钱包类型（evm/sol）
 * @param {number} data.number 创建数量
 * @param {string} data.project 项目标识
 * @param {string} data.remark 备注
 * @param {string} data.pwd 密码（自动加密）
 */
export function createWalletList(data) {
  return apiClient.post('/wallet/create', data);
}

/**
 * 批量导入钱包映射
 * @param {Object} data 映射数据
 * @param {Array} data.mappingList 映射关系列表
 * @param {string} data.project 项目名称
 * @param {string} data.remark 备注信息
 */
export function batchImportMapping(data) {
  return apiClient.post('/wallet/mapping/batch-import', data);
}

/**
 * 批量查询钱包映射
 * @param {Array} sourceAddresses 源地址列表
 */
export function batchQueryMapping(sourceAddresses) {
  return apiClient.post('/wallet/mapping/batch-query', { sourceAddresses });
}

/**
 * 查询单个钱包映射
 * @param {string} sourceAddress 源地址
 */
export function oneMapping(sourceAddress) {
  return apiClient.get('/wallet/mapping/one', {
    params: { sourceAddress }
  });
}

/**
 * 管理员查询钱包私钥
 * @param {string} address 钱包地址
 * @param {string} pwd 密码（自动加密）
 */
export function adminGetWalletByAddress(address, pwd) {
  return apiClient.get(`/admin/wallets/by-address/${address}`, {
    params: { pwd }
  });
}

export default {
  getWalletProjects,
  walletList,
  oneWallet,
  insertWalletList,
  createWalletList,
  batchImportMapping,
  batchQueryMapping,
  oneMapping,
  adminGetWalletByAddress
};
