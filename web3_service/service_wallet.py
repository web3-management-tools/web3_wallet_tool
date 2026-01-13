# coding:utf-8
'''
Author: llq
Date: 2024/7/13-15:27
'''

import json
import logging
import os
import sys

import utils_db
import utils_encrypt
import utils_wallet_evm
import utils_wallet_sol
from db_model import AlchemyJsonEncoder

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG if os.getenv('LOG_LEVEL') == 'DEBUG' else logging.INFO)

# 确保Windows控制台使用UTF-8编码
if sys.platform == 'win32':
    from logging import StreamHandler
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
    logger.addHandler(handler)


def getWalletProjects():
    '''
    获取钱包的项目
    :return:
    '''
    logger.info('[getWalletProjects] 获取所有钱包项目')
    result = utils_db.queryAllProjectList()
    if len(result) == 0:
        logger.debug('[getWalletProjects] 没有项目')
        return []

    return_list = []
    for project in result:
        return_list.append(project[0])

    logger.info(f'[getWalletProjects] 返回 {len(return_list)} 个项目')
    return return_list


def walletList(address, project, pwd):
    '''
    获取钱包列表
    :param address:
    :param project:
    :return:
    '''
    logger.info(f'[walletList] 查询钱包: address={address}, project={project}')
    
    if address is None and project is None:
        logger.warning('[walletList] address和project都为空')
        return []
    
    result = utils_db.queryWalletByAddressOrProject(address, project)
    logger.info(f'[walletList] 数据库查询到 {len(result)} 个钱包')
    
    resultList = []

    for wallet in result:
        try:
            # 先用pwd解密，再用PWD_DECRYPT_KEY加密传输
            logger.debug(f'[walletList] 解密钱包: {wallet.address[:10]}...')
            decrypted_private_key = utils_encrypt.decrypt(wallet.private_key, pwd)
            decrypted_phrase = utils_encrypt.decrypt(wallet.phrase, pwd)
            
            encrypted_private_key = utils_encrypt.encrypt_private_key(decrypted_private_key)
            encrypted_phrase = utils_encrypt.encrypt_private_key(decrypted_phrase)
            
            resultList.append({
                "index": wallet.index,
                "address": wallet.address,
                "publicKey": wallet.public_key,
                "privateKey": encrypted_private_key,
                "phrase": encrypted_phrase,
                "project": wallet.project,
                "remark": wallet.remark
            })
        except Exception as e:
            logger.error(f'[walletList] 处理钱包失败: {wallet.address}, 错误: {e}')
            continue

    logger.info(f'[walletList] 返回 {len(resultList)} 个钱包')
    return resultList


def oneWallet(address, pwd):
    '''
    查询单个钱包
    :param address: 钱包地址
    :param pwd: 解密密钥
    :return: 钱包信息或None
    '''
    logger.info(f'[oneWallet] 查询单个钱包: {address}')
    
    if address is None:
        logger.warning('[oneWallet] 地址为空')
        return None
    
    result = utils_db.queryWalletByAddress(address)
    if result is None:
        logger.warning(f'[oneWallet] 未找到钱包: {address}')
        return None
    
    try:
        logger.debug(f'[oneWallet] 解密钱包: {address[:10]}...')
        # 先用pwd解密，再用PWD_DECRYPT_KEY加密传输
        decrypted_private_key = utils_encrypt.decrypt(result.private_key, pwd)
        decrypted_phrase = utils_encrypt.decrypt(result.phrase, pwd)
        
        encrypted_private_key = utils_encrypt.encrypt_private_key(decrypted_private_key)
        encrypted_phrase = utils_encrypt.encrypt_private_key(decrypted_phrase)
        
        wallet_info = {
            "index": result.index,
            "address": result.address,
            "publicKey": result.public_key,
            "privateKey": encrypted_private_key,
            "phrase": encrypted_phrase,
            "project": result.project,
            "remark": result.remark
        }
        
        logger.info(f'[oneWallet] 找到钱包: {address[:10]}...')
        return wallet_info
    except Exception as e:
        logger.error(f'[oneWallet] 处理钱包失败: {address}, 错误: {e}')
        return None


def insertWalletList(walletList, project, remark, pwd, encrypted=True):
    '''
    批量导入钱包
    :param walletList: 钱包列表，格式：["地址,私钥,助记词", ...]
    :param project: 项目名称
    :param remark: 备注
    :param pwd: 解密/加密密钥
    :param encrypted: 私钥是否已加密（默认true），false表示私钥是明文的
    :return: True
    '''
    logger.info(f'[insertWalletList] 批量导入钱包: project={project}, encrypted={encrypted}, 数量={len(walletList) if walletList else 0}')
    
    if not walletList:
        logger.debug('[insertWalletList] 钱包列表为空')
        return True
    
    baseIndex = utils_db.queryProjectLastIndex(project)
    logger.debug(f'[insertWalletList] 项目 {project} 的最后索引: {baseIndex}')
    
    # 解析所有钱包数据
    wallet_data_list = []
    addresses = []
    skip_count = 0
    
    for (index, item) in enumerate(walletList):
        try:
            parts = item.split(',')
            address = parts[0].strip()
            
            if len(address) < 2:
                skip_count += 1
                continue
            
            private = None
            phrase = None
            
            if encrypted:
                # 前端传入的私钥是用PWD_DECRYPT_KEY加密的，需要先解密
                if len(parts) > 1 and parts[1].strip():
                    encrypted_private = parts[1].strip()
                    org_private = utils_encrypt.decrypt_private_key(encrypted_private)
                    private = utils_encrypt.encrypt(org_private, pwd) if org_private else None
                    logger.debug(f'[insertWalletList] 解密私钥: {address[:10]}...')
                
                # 处理助记词
                if len(parts) > 2 and parts[2].strip():
                    encrypted_phrase = parts[2].strip()
                    org_phrase = utils_encrypt.decrypt_private_key(encrypted_phrase)
                    phrase = utils_encrypt.encrypt(org_phrase, pwd) if org_phrase else None
            else:
                # 私钥是明文的，直接加密存储
                if len(parts) > 1 and parts[1].strip():
                    private = utils_encrypt.encrypt(parts[1].strip(), pwd)
                
                # 处理助记词
                if len(parts) > 2 and parts[2].strip():
                    phrase = utils_encrypt.encrypt(parts[2].strip(), pwd)
            
            walletIndex = baseIndex + 1 + index
            
            wallet_data_list.append({
                'index': walletIndex,
                'address': address,
                'public_key': None,
                'private_key': private,
                'phrase': phrase,
                'project': project,
                'remark': remark
            })
            addresses.append(address)
        except Exception as e:
            logger.error(f'[insertWalletList] 处理钱包失败: {item[:50]}..., 错误: {e}')
            skip_count += 1
            continue
    
    logger.info(f'[insertWalletList] 解析完成: 总数={len(walletList)}, 有效={len(wallet_data_list)}, 跳过={skip_count}')
    
    if not wallet_data_list:
        logger.debug('[insertWalletList] 没有有效钱包数据')
        return True
    
    # 批量查询已存在的地址
    existing_addresses = utils_db.batchQueryExistingAddresses(project, addresses)
    logger.debug(f'[insertWalletList] 已有地址数量: {len(existing_addresses)}')
    
    # 过滤掉已存在的地址
    new_wallet_data = [w for w in wallet_data_list if w['address'] not in existing_addresses]
    logger.debug(f'[insertWalletList] 新增地址数量: {len(new_wallet_data)}')
    
    if not new_wallet_data:
        logger.info('[insertWalletList] 所有钱包都已存在')
        return True
    
    # 批量插入
    utils_db.batchInsertWallets(new_wallet_data)
    
    logger.info(f'[insertWalletList] 批量导入完成: 新增 {len(new_wallet_data)} 个钱包')
    return True


def createWalletList(walletType, walletNum, project, remark, pwd):
    '''
    批量创建钱包
    :param walletType: 钱包类型（evm/sol）
    :param walletNum: 创建数量
    :param project: 项目名称
    :param remark: 备注
    :param pwd: 加密密钥
    :return: True
    '''
    logger.info(f'[createWalletList] 创建钱包: type={walletType}, number={walletNum}, project={project}')
    
    walletList = []
    if walletType == "evm":
        logger.debug(f'[createWalletList] 创建 {walletNum} 个EVM钱包')
        walletList = utils_wallet_evm.createAccountsOutSeedMulit(walletNum)
    elif walletType == "sol":
        logger.debug(f'[createWalletList] 创建 {walletNum} 个Solana钱包')
        walletList = utils_wallet_sol.create_sol_wallet(walletNum)
    else:
        logger.error(f'[createWalletList] 未知钱包类型: {walletType}')
        return False

    # 传入encrypted=False，因为walletList中的私钥是明文的
    result = insertWalletList(walletList, project, remark, pwd, encrypted=False)
    
    logger.info(f'[createWalletList] 创建完成: {result}')
    return result


def batchImportWalletMapping(mappingList, project, remark):
    '''
    批量导入钱包映射
    :param mappingList: [{"sourceAddress": "xxx", "targetAddress": "xxx"}, ...]
    :param project: 项目名称
    :param remark: 备注
    :return: {"successCount": 数量}
    '''
    logger.info(f'[batchImportWalletMapping] 批量导入映射: project={project}, 数量={len(mappingList) if mappingList else 0}')
    
    success_count = utils_db.batchInsertWalletMapping(mappingList, project, remark)
    
    logger.info(f'[batchImportWalletMapping] 成功导入 {success_count} 条')
    return {"successCount": success_count}


def batchQueryWalletMapping(sourceAddresses):
    '''
    批量查询钱包映射
    :param sourceAddresses: 源地址列表
    :return: [{"sourceAddress": "xxx", "targetAddress": "xxx"}, ...]
    '''
    logger.debug(f'[batchQueryWalletMapping] 批量查询: 数量={len(sourceAddresses) if sourceAddresses else 0}')
    
    result = utils_db.queryWalletMappingBySourceAddresses(sourceAddresses)
    
    logger.debug(f'[batchQueryWalletMapping] 返回 {len(result)} 条')
    return result


def oneWalletMapping(sourceAddress):
    '''
    查询单个钱包映射
    :param sourceAddress: 源地址
    :return: {"sourceAddress": "xxx", "targetAddress": "xxx"} or None
    '''
    logger.debug(f'[oneWalletMapping] 查询: {sourceAddress}')

    result = utils_db.queryWalletMappingBySourceAddress(sourceAddress)

    logger.debug(f'[oneWalletMapping] 返回: {"找到" if result else "未找到"}')
    return result


def getProjectStatistics():
    '''
    获取项目统计信息
    :return: {"projects": [{"project": "项目名", "count": 数量}], "total": 总钱包数}
    '''
    logger.info('[getProjectStatistics] 获取项目统计信息')

    project_stats, total_count = utils_db.queryProjectStatistics()

    result = {
        "projects": project_stats,
        "total": total_count
    }

    logger.info(f'[getProjectStatistics] 返回 {len(project_stats)} 个项目，总钱包数: {total_count}')
    return result


# ==================== 交易所信息相关 ====================

def getExchangeNames():
    '''
    获取所有交易所名称列表
    :return: 名称列表
    '''
    logger.info('[getExchangeNames] 获取所有交易所名称')
    names = utils_db.queryAllExchangeNames()
    logger.info(f'[getExchangeNames] 返回 {len(names)} 个交易所')
    return names


def getExchangeByName(name, pwd):
    '''
    根据名称查询交易所信息
    :param name: 交易所名称
    :param pwd: 解密密钥
    :return: 交易所信息（敏感数据加密传输）
    '''
    logger.info(f'[getExchangeByName] 查询交易所: name={name}')

    result = utils_db.queryExchangeByName(name)
    if not result:
        logger.warning(f'[getExchangeByName] 未找到交易所: {name}')
        return None

    try:
        # 解密数据库中的敏感数据，再用 PWD_DECRYPT_KEY 加密传输
        decrypted_apikey = utils_encrypt.decrypt(result['apikey'], pwd) if result['apikey'] else None
        decrypted_secret = utils_encrypt.decrypt(result['secret'], pwd) if result['secret'] else None
        decrypted_password = utils_encrypt.decrypt(result['password'], pwd) if result['password'] else None

        # 使用 PWD_DECRYPT_KEY 加密后传输
        encrypted_apikey = utils_encrypt.encrypt_private_key(decrypted_apikey) if decrypted_apikey else None
        encrypted_secret = utils_encrypt.encrypt_private_key(decrypted_secret) if decrypted_secret else None
        encrypted_password = utils_encrypt.encrypt_private_key(decrypted_password) if decrypted_password else None

        exchange_info = {
            "id": result['id'],
            "platform": result['platform'],
            "apikey": encrypted_apikey,
            "secret": encrypted_secret,
            "password": encrypted_password,
            "ip": result['ip'],
            "name": result['name']
        }

        logger.info(f'[getExchangeByName] 返回交易所信息: {name}')
        return exchange_info
    except Exception as e:
        logger.error(f'[getExchangeByName] 处理失败: {name}, 错误: {e}')
        return None


def insertExchange(platform, apikey, secret, password, ip, name, pwd):
    '''
    新增交易所信息
    :param platform: 平台名称
    :param apikey: API密钥（前端用 PWD_DECRYPT_KEY 加密传输）
    :param secret: 密钥（前端用 PWD_DECRYPT_KEY 加密传输）
    :param password: 密码（前端用 PWD_DECRYPT_KEY 加密传输）
    :param ip: IP地址
    :param name: 名称
    :param pwd: 解密密钥
    :return: 新增结果
    '''
    logger.info(f'[insertExchange] 新增交易所: name={name}, platform={platform}')

    # 解密前端传来的敏感数据
    decrypted_apikey = utils_encrypt.decrypt_private_key(apikey) if apikey else None
    decrypted_secret = utils_encrypt.decrypt_private_key(secret) if secret else None
    decrypted_password = utils_encrypt.decrypt_private_key(password) if password else None

    # 用 pwd 加密存储
    encrypted_apikey = utils_encrypt.encrypt(decrypted_apikey, pwd) if decrypted_apikey else None
    encrypted_secret = utils_encrypt.encrypt(decrypted_secret, pwd) if decrypted_secret else None
    encrypted_password = utils_encrypt.encrypt(decrypted_password, pwd) if decrypted_password else None

    result = utils_db.insertExchange(platform, encrypted_apikey, encrypted_secret, encrypted_password, ip, name)

    logger.info(f'[insertExchange] 新增成功: {name}')
    return result


def updateExchange(name, platform, apikey, secret, password, ip, pwd):
    '''
    更新交易所信息
    :param name: 交易所名称（用于定位）
    :param platform: 平台名称
    :param apikey: API密钥
    :param secret: 密钥
    :param password: 密码
    :param ip: IP地址
    :param pwd: 解密密钥
    :return: 更新结果
    '''
    logger.info(f'[updateExchange] 更新交易所: name={name}')

    # 如果有新数据，则解密并重新加密
    new_apikey = None
    new_secret = None
    new_password = None
    new_ip = ip
    new_platform = platform

    if apikey:
        decrypted_apikey = utils_encrypt.decrypt_private_key(apikey)
        new_apikey = utils_encrypt.encrypt(decrypted_apikey, pwd) if decrypted_apikey else None

    if secret:
        decrypted_secret = utils_encrypt.decrypt_private_key(secret)
        new_secret = utils_encrypt.encrypt(decrypted_secret, pwd) if decrypted_secret else None

    if password:
        decrypted_password = utils_encrypt.decrypt_private_key(password)
        new_password = utils_encrypt.encrypt(decrypted_password, pwd) if decrypted_password else None

    result = utils_db.updateExchange(name, new_platform, new_apikey, new_secret, new_password, new_ip)

    logger.info(f'[updateExchange] 更新完成: {name}, 影响行数: {result}')
    return result


def deleteExchange(name):
    '''
    删除交易所信息
    :param name: 交易所名称
    :return: 删除结果
    '''
    logger.info(f'[deleteExchange] 删除交易所: name={name}')
    result = utils_db.deleteExchange(name)
    logger.info(f'[deleteExchange] 删除完成: {name}, 影响行数: {result}')
    return result
