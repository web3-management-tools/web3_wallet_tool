# coding:utf-8
'''
Author: llq
Date: 2024/7/13-15:27
Description: 交易所提现服务 - 支持 Binance, Bitget, OKX, Gate, Bybit
'''

import ccxt
import logging
import os
import sys

import utils_db
import utils_encrypt

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG if os.getenv('LOG_LEVEL') == 'DEBUG' else logging.INFO)

if sys.platform == 'win32':
    from logging import StreamHandler
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
    logger.addHandler(handler)


# 交易所ID到ccxt交易所类的映射
EXCHANGE_MAP = {
    'binance': 'binance',
    'bitget': 'bitget',
    'okx': 'okx',
    'gate': 'gate',
    'bybit': 'bybit'
}

# 交易所名称显示映射
EXCHANGE_NAMES = {
    'binance': 'Binance',
    'bitget': 'Bitget',
    'okx': 'OKX',
    'gate': 'Gate.io',
    'bybit': 'Bybit'
}

def parse_proxy(proxy_str):
    '''
    解析代理配置
    支持格式:
    - ip:port:user:pwd
    - user:pwd@ip:port
    :param proxy_str: 代理配置字符串
    :return: 代理URL或None
    '''
    if not proxy_str:
        return None

    proxy_str = proxy_str.strip()

    # 格式1: user:pwd@ip:port
    if '@' in proxy_str:
        try:
            auth, host = proxy_str.split('@')
            user, pwd = auth.split(':')
            ip, port = host.split(':')
            return f'http://{user}:{pwd}@{ip}:{port}'
        except:
            pass

    # 格式2: ip:port:user:pwd
    parts = proxy_str.split(':')
    if len(parts) == 4:
        ip, port, user, pwd = parts
        return f'http://{user}:{pwd}@{ip}:{port}'

    # 格式3: ip:port (无认证)
    if len(parts) == 2:
        return f'http://{proxy_str}'

    return None


def get_exchange_client(platform, api_key, secret, password=None, proxy_ip=None):
    '''
    创建交易所客户端
    :param platform: 平台名称 (binance, bitget, okx, gate, bybit)
    :param api_key: API密钥
    :param secret: 密钥
    :param password: 密码（部分交易所需要）
    :param proxy_ip: 代理IP配置
    :return: ccxt交易所对象
    '''
    logger.info(f'[get_exchange_client] 创建 {EXCHANGE_NAMES.get(platform, platform)} 客户端')

    # 解析代理配置
    proxy_url = parse_proxy(proxy_ip)
    if proxy_url:
        logger.info(f'[get_exchange_client] 使用代理: {proxy_url[:50]}...')

    try:
        common_params = {
            'apiKey': api_key,
            'secret': secret,
            'enableRateLimit': True,
        }

        # 添加代理配置（使用 proxies 而不是 proxy，避免 URL 拼接问题）
        if proxy_url:
            common_params['proxies'] = {
                'http': proxy_url,
                'https': proxy_url
            }

        if platform == 'binance':
            client = ccxt.binance({
                **common_params,
                'options': {
                    'defaultType': 'spot',
                }
            })
        elif platform == 'bitget':
            client = ccxt.bitget({
                **common_params,
                'password': password or '',
            })
        elif platform == 'okx':
            client = ccxt.okx({
                **common_params,
                'password': password or '',
            })
        elif platform == 'gate':
            client = ccxt.gate({
                **common_params,
            })
        elif platform == 'bybit':
            client = ccxt.bybit({
                **common_params,
            })
        else:
            logger.error(f'[get_exchange_client] 不支持的平台: {platform}')
            return None

        logger.info(f'[get_exchange_client] {EXCHANGE_NAMES.get(platform, platform)} 客户端创建成功')
        return client

    except Exception as e:
        logger.error(f'[get_exchange_client] 创建客户端失败: {e}')
        return None


def withdraw(exchange_name, pwd, to_address, network, coin, amount):
    '''
    交易所提现
    :param exchange_name: 交易所名称（数据库中的name）
    :param pwd: 解密密钥
    :param to_address: 目标地址
    :param network: 提现网络
    :param coin: 代币符号（如 USDT, ETH）
    :param amount: 提现金额
    :return: 提现结果
    '''
    logger.info(f'[withdraw] 开始提现: exchange={exchange_name}, to={to_address[:10]}..., network={network}, coin={coin}, amount={amount}')

    # 1. 查询交易所信息
    exchange_info = utils_db.queryExchangeByName(exchange_name)
    if not exchange_info:
        logger.error(f'[withdraw] 未找到交易所: {exchange_name}')
        return {'success': False, 'msg': f'未找到交易所: {exchange_name}', 'data': None}

    platform = exchange_info['platform'].lower()
    if platform not in EXCHANGE_MAP:
        logger.error(f'[withdraw] 不支持的平台: {platform}')
        return {'success': False, 'msg': f'不支持的平台: {platform}', 'data': None}

    # 2. 解密敏感信息
    try:
        api_key = utils_encrypt.decrypt(exchange_info['apikey'], pwd) if exchange_info['apikey'] else None
        secret = utils_encrypt.decrypt(exchange_info['secret'], pwd) if exchange_info['secret'] else None
        password = utils_encrypt.decrypt(exchange_info['password'], pwd) if exchange_info['password'] else None

        if not api_key or not secret:
            logger.error(f'[withdraw] API密钥或密钥为空')
            return {'success': False, 'msg': 'API密钥配置不完整', 'data': None}

    except Exception as e:
        logger.error(f'[withdraw] 解密失败: {e}')
        return {'success': False, 'msg': '解密失败', 'data': None}

    # 3. 创建交易所客户端
    proxy_ip = exchange_info.get('ip')
    client = get_exchange_client(platform, api_key, secret, password, proxy_ip)
    if not client:
        return {'success': False, 'msg': '创建交易所客户端失败', 'data': None}

    try:
        # 4. 执行提现
        # CCXT withdraw 方法签名: withdraw(code, amount, address, tag=None, params={})
        # network 参数需要通过 params 字典传递，键名为 'network'
        params = {'network': network}

        if platform == 'binance':
            # Binance 提现
            response = client.withdraw(
                code=coin,
                amount=amount,
                address=to_address,
                tag=None,  # 大部分代币不需要tag
                params=params
            )

        elif platform == 'bitget':
            # Bitget 提现 (必须提供 network 参数)
            response = client.withdraw(
                code=coin,
                amount=amount,
                address=to_address,
                tag=None,
                params=params
            )

        elif platform == 'okx':
            # OKX 提现
            response = client.withdraw(
                code=coin,
                amount=amount,
                address=to_address,
                tag=None,
                params=params
            )

        elif platform == 'gate':
            # Gate 提现
            response = client.withdraw(
                code=coin,
                amount=amount,
                address=to_address,
                tag=None,
                params=params
            )

        elif platform == 'bybit':
            # Bybit 提现
            response = client.withdraw(
                code=coin,
                amount=amount,
                address=to_address,
                tag=None,
                params=params
            )

        else:
            return {'success': False, 'msg': f'不支持的平台: {platform}', 'data': None}

        logger.info(f'[withdraw] 提现成功: {response}')
        return {
            'success': True,
            'msg': '提现成功',
            'data': {
                'exchange': EXCHANGE_NAMES.get(platform, platform),
                'txid': response.get('id', response.get('txid', '')),
                'withdraw_id': response.get('id', ''),
                'amount': amount,
                'coin': coin,
                'network': network,
                'to_address': to_address,
                'status': response.get('status', 'pending'),
                'raw_response': response
            }
        }

    except ccxt.InsufficientFunds as e:
        logger.error(f'[withdraw] 余额不足: {e}')
        return {'success': False, 'msg': f'余额不足: {str(e)}', 'data': None}

    except ccxt.NetworkError as e:
        logger.error(f'[withdraw] 网络错误: {e}')
        return {'success': False, 'msg': f'网络错误: {str(e)}', 'data': None}

    except ccxt.ExchangeError as e:
        logger.error(f'[withdraw] 交易所错误: {e}')
        return {'success': False, 'msg': f'交易所错误: {str(e)}', 'data': None}

    except Exception as e:
        logger.error(f'[withdraw] 提现失败: {e}')
        return {'success': False, 'msg': f'提现失败: {str(e)}', 'data': None}

    finally:
        # 关闭连接
        try:
            client.close()
        except:
            pass


def get_withdraw_fee(exchange_name, pwd, coin, network):
    '''
    获取提现手续费
    :param exchange_name: 交易所名称
    :param pwd: 解密密钥
    :param coin: 代币符号
    :param network: 提现网络
    :return: 手续费信息
    '''
    logger.info(f'[get_withdraw_fee] 查询手续费: exchange={exchange_name}, coin={coin}, network={network}')

    # 1. 查询交易所信息
    exchange_info = utils_db.queryExchangeByName(exchange_name)
    if not exchange_info:
        logger.error(f'[get_withdraw_fee] 未找到交易所: {exchange_name}')
        return {'success': False, 'msg': f'未找到交易所: {exchange_name}', 'data': None}

    platform = exchange_info['platform'].lower()
    if platform not in EXCHANGE_MAP:
        logger.error(f'[get_withdraw_fee] 不支持的平台: {platform}')
        return {'success': False, 'msg': f'不支持的平台: {platform}', 'data': None}

    # 2. 解密敏感信息
    try:
        api_key = utils_encrypt.decrypt(exchange_info['apikey'], pwd) if exchange_info['apikey'] else None
        secret = utils_encrypt.decrypt(exchange_info['secret'], pwd) if exchange_info['secret'] else None
        password = utils_encrypt.decrypt(exchange_info['password'], pwd) if exchange_info['password'] else None

        if not api_key or not secret:
            logger.error(f'[get_withdraw_fee] API密钥或密钥为空')
            return {'success': False, 'msg': 'API密钥配置不完整', 'data': None}

    except Exception as e:
        logger.error(f'[get_withdraw_fee] 解密失败: {e}')
        return {'success': False, 'msg': '解密失败', 'data': None}

    # 3. 创建交易所客户端
    proxy_ip = exchange_info.get('ip')
    client = get_exchange_client(platform, api_key, secret, password, proxy_ip)
    if not client:
        return {'success': False, 'msg': '创建交易所客户端失败', 'data': None}

    try:
        # 4. 查询提现费用
        if platform == 'binance':
            # Binance 需要查询网络信息
            networks = client.fetch_networks(coin)
            if network in networks:
                network_info = networks[network]
                return {
                    'success': True,
                    'data': {
                        'coin': coin,
                        'network': network,
                        'fee': network_info.get('withdrawFee', 'N/A'),
                        'min_withdraw': network_info.get('withdrawMin', 'N/A'),
                        'enabled': network_info.get('enabled', False)
                    }
                }
            else:
                return {'success': False, 'msg': f'未找到网络: {network}', 'data': None}

        elif platform == 'bitget':
            # Bitget 查询币种信息
            currencies = client.fetch_currencies()
            if coin in currencies:
                currency = currencies[coin]
                networks = currency.get('networks', {})
                if network in networks:
                    network_info = networks[network]
                    return {
                        'success': True,
                        'data': {
                            'coin': coin,
                            'network': network,
                            'fee': network_info.get('fee', 'N/A'),
                            'min_withdraw': network_info.get('limits', {}).get('withdraw', {}).get('min', 'N/A')
                        }
                    }
                else:
                    return {'success': False, 'msg': f'未找到网络: {network}', 'data': None}
            else:
                return {'success': False, 'msg': f'未找到币种: {coin}', 'data': None}

        elif platform == 'okx':
            # OKX 查询币种信息
            currencies = client.fetch_currencies()
            if coin in currencies:
                currency = currencies[coin]
                networks = currency.get('networks', {})
                for net_code, network_info in networks.items():
                    if network.upper() in net_code.upper():
                        return {
                            'success': True,
                            'data': {
                                'coin': coin,
                                'network': network,
                                'fee': network_info.get('fee', 'N/A'),
                                'min_withdraw': network_info.get('limits', {}).get('withdraw', {}).get('min', 'N/A')
                            }
                        }
                return {'success': False, 'msg': f'未找到网络: {network}', 'data': None}
            else:
                return {'success': False, 'msg': f'未找到币种: {coin}', 'data': None}

        elif platform == 'gate':
            # Gate 查询币种信息
            currencies = client.fetch_currencies()
            if coin in currencies:
                currency = currencies[coin]
                networks = currency.get('networks', {})
                if network in networks:
                    network_info = networks[network]
                    return {
                        'success': True,
                        'data': {
                            'coin': coin,
                            'network': network,
                            'fee': network_info.get('fee', 'N/A'),
                            'min_withdraw': network_info.get('limits', {}).get('withdraw', {}).get('min', 'N/A')
                        }
                    }
                else:
                    return {'success': False, 'msg': f'未找到网络: {network}', 'data': None}
            else:
                return {'success': False, 'msg': f'未找到币种: {coin}', 'data': None}

        elif platform == 'bybit':
            # Bybit 查询币种信息
            currencies = client.fetch_currencies()
            if coin in currencies:
                currency = currencies[coin]
                networks = currency.get('networks', {})
                for net_code, network_info in networks.items():
                    if network.upper() in net_code.upper():
                        return {
                            'success': True,
                            'data': {
                                'coin': coin,
                                'network': network,
                                'fee': network_info.get('fee', 'N/A'),
                                'min_withdraw': network_info.get('limits', {}).get('withdraw', {}).get('min', 'N/A')
                            }
                        }
                return {'success': False, 'msg': f'未找到网络: {network}', 'data': None}
            else:
                return {'success': False, 'msg': f'未找到币种: {coin}', 'data': None}

        else:
            return {'success': False, 'msg': f'不支持的平台: {platform}', 'data': None}

    except Exception as e:
        logger.error(f'[get_withdraw_fee] 查询失败: {e}')
        return {'success': False, 'msg': f'查询失败: {str(e)}', 'data': None}

    finally:
        try:
            client.close()
        except:
            pass


def get_balance(exchange_name, pwd, coin=None):
    '''
    获取交易所账户余额
    :param exchange_name: 交易所名称
    :param pwd: 解密密钥
    :param coin: 代币符号（可选，不传则返回所有）
    :return: 余额信息
    '''
    logger.info(f'[get_balance] 查询余额: exchange={exchange_name}, coin={coin}')

    # 1. 查询交易所信息
    exchange_info = utils_db.queryExchangeByName(exchange_name)
    if not exchange_info:
        logger.error(f'[get_balance] 未找到交易所: {exchange_name}')
        return {'success': False, 'msg': f'未找到交易所: {exchange_name}', 'data': None}

    platform = exchange_info['platform'].lower()
    if platform not in EXCHANGE_MAP:
        logger.error(f'[get_balance] 不支持的平台: {platform}')
        return {'success': False, 'msg': f'不支持的平台: {platform}', 'data': None}

    # 2. 解密敏感信息
    try:
        api_key = utils_encrypt.decrypt(exchange_info['apikey'], pwd) if exchange_info['apikey'] else None
        secret = utils_encrypt.decrypt(exchange_info['secret'], pwd) if exchange_info['secret'] else None
        password = utils_encrypt.decrypt(exchange_info['password'], pwd) if exchange_info['password'] else None

        if not api_key or not secret:
            logger.error(f'[get_balance] API密钥或密钥为空')
            return {'success': False, 'msg': 'API密钥配置不完整', 'data': None}

    except Exception as e:
        logger.error(f'[get_balance] 解密失败: {e}')
        return {'success': False, 'msg': '解密失败', 'data': None}

    # 3. 创建交易所客户端
    proxy_ip = exchange_info.get('ip')
    client = get_exchange_client(platform, api_key, secret, password, proxy_ip)
    if not client:
        return {'success': False, 'msg': '创建交易所客户端失败', 'data': None}

    try:
        # 4. 查询余额
        balances = client.fetch_balance()

        if coin:
            # 返回指定币种余额
            if coin in balances.get('free', {}) or coin in balances.get('used', {}):
                free = balances.get('free', {}).get(coin, 0)
                used = balances.get('used', {}).get(coin, 0)
                total = free + used
                return {
                    'success': True,
                    'data': {
                        'coin': coin,
                        'free': free,
                        'used': used,
                        'total': total
                    }
                }
            else:
                return {
                    'success': True,
                    'data': {
                        'coin': coin,
                        'free': 0,
                        'used': 0,
                        'total': 0
                    }
                }
        else:
            # 返回所有余额
            result = []
            for currency, balance in balances.get('total', {}).items():
                if balance and balance > 0:
                    result.append({
                        'coin': currency,
                        'total': balance,
                        'free': balances.get('free', {}).get(currency, 0),
                        'used': balances.get('used', {}).get(currency, 0)
                    })
            return {
                'success': True,
                'data': result
            }

    except Exception as e:
        logger.error(f'[get_balance] 查询失败: {e}')
        return {'success': False, 'msg': f'查询失败: {str(e)}', 'data': None}

    finally:
        try:
            client.close()
        except:
            pass
