import apiClient from './index';

/**
 * 交易所提现
 * @param {Object} params 提现参数
 * @param {string} params.exchange 交易所名称
 * @param {string} params.pwd 加密密码
 * @param {string} params.toAddress 目标地址
 * @param {string} params.network 提现网络
 * @param {string} params.coin 代币符号
 * @param {number} params.amount 提现金额
 */
export async function withdraw(params) {
  const { exchange, pwd, toAddress, network, coin, amount } = params;
  return apiClient.post('/exchange/withdraw', {
    exchange,
    pwd,
    toAddress,
    network,
    coin,
    amount
  });
}

/**
 * 获取交易所名称列表
 */
export function getExchangeNames() {
  return apiClient.get('/exchange/names');
}

/**
 * 查询单个交易所信息
 * @param {string} name 交易所名称
 * @param {string} pwd 加密密码
 */
export function getExchangeOne(name, pwd) {
  return apiClient.get('/exchange/one', {
    params: { name, pwd }
  });
}

/**
 * 新增交易所信息
 * @param {Object} data 交易所数据
 */
export function insertExchange(data) {
  return apiClient.post('/exchange/insert', data);
}

/**
 * 更新交易所信息
 * @param {Object} data 更新数据
 */
export function updateExchange(data) {
  return apiClient.post('/exchange/update', data);
}

/**
 * 删除交易所信息
 * @param {string} name 交易所名称
 */
export function deleteExchange(name) {
  return apiClient.post('/exchange/delete', { name });
}

/**
 * 获取项目地址列表
 */
export function getProjectAddresses() {
  return apiClient.get('/wallet/projects');
}

export default {
  withdraw,
  getExchangeNames,
  getExchangeOne,
  insertExchange,
  updateExchange,
  deleteExchange,
  getProjectAddresses
};
