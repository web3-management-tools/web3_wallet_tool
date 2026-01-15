# coding:utf-8
'''
Author: llq
Date: 2024/7/13-15:22
'''
import os

import db_model
import logging
import sys
from db_model import Wallet
from db_model import WalletMapping
from db_model import ExchangeInfo
from sqlalchemy import create_engine, Column, Integer, String, update, or_
from sqlalchemy.orm import sessionmaker, declarative_base
from db_model import DB_URI
from datetime import datetime

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG if os.getenv('LOG_LEVEL') == 'DEBUG' else logging.INFO)

# 确保Windows控制台使用UTF-8编码
if sys.platform == 'win32':
    from logging import StreamHandler
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
    logger.addHandler(handler)


def getDbEngine():
    '''
    数据库链接
    '''
    engine = create_engine(DB_URI)  # , echo=True
    db_model.Base.metadata.create_all(engine)
    return engine


def queryAllProjectList():
    '''
    查询所有的项目列表
    :return:
    '''
    logger.debug('[queryAllProjectList] 开始查询所有项目')
    session = sessionmaker(getDbEngine())()
    result = session.query(Wallet.project).group_by(Wallet.project).all()
    session.close()
    logger.debug(f'[queryAllProjectList] 查询到 {len(result)} 个项目')
    return result


def queryProjectLastIndex(project):
    '''
    获取项目最新的index
    :param project:
    :return:
    '''
    logger.debug(f'[queryProjectLastIndex] 查询项目 {project} 的最后索引')
    session = sessionmaker(getDbEngine())()
    try:
        result = session.query(Wallet.index).filter(
            Wallet.project == project
        ).order_by(Wallet.index.desc()).limit(1).scalar()
        last_index = result if result is not None else 0
        logger.debug(f'[queryProjectLastIndex] 项目 {project} 的最后索引: {last_index}')
        return last_index
    finally:
        session.close()


def queryWalletByAddressOrProject(address, project):
    '''
    根据项目和地址查询钱包
    :param address:
    :param project:
    :return:
    '''
    logger.debug(f'[queryWalletByAddressOrProject] address={address}, project={project}')
    session = sessionmaker(getDbEngine())()
    result = session.query(Wallet).filter(or_(Wallet.address == address, Wallet.project == project)).all()
    session.close()
    logger.debug(f'[queryWalletByAddressOrProject] 查询到 {len(result)} 个钱包')
    return result


def queryWalletByAddress(address):
    '''
    根据地址查询钱包信息
    '''
    logger.debug(f'[queryWalletByAddress] 查询地址 {address}')
    session = sessionmaker(getDbEngine())()
    result = session.query(Wallet).filter(Wallet.address == address).limit(1).all()
    session.close()
    if len(result) > 0:
        logger.debug(f'[queryWalletByAddress] 找到钱包: {address[:10]}...')
        return result[0]
    logger.debug(f'[queryWalletByAddress] 未找到钱包')
    return None


def checkWalletIsExist(address, project):
    '''
    判断钱包是否已存在
    :param address:
    :param project:
    :return:
    '''
    logger.debug(f'[checkWalletIsExist] 检查钱包是否存在: address={address}, project={project}')
    session = sessionmaker(getDbEngine())()
    result = session.query(Wallet).filter(Wallet.address == address).filter(
        Wallet.project == project).limit(1).all()
    session.close()
    if len(result) > 0:
        logger.debug(f'[checkWalletIsExist] 钱包已存在')
        return result[0]
    logger.debug(f'[checkWalletIsExist] 钱包不存在')
    return None


def batchQueryExistingAddresses(project, addresses):
    '''
    批量查询已存在的钱包地址
    :param project: 项目名称
    :param addresses: 地址列表
    :return: 已存在的地址集合
    '''
    if not addresses:
        logger.debug('[batchQueryExistingAddresses] 地址列表为空')
        return set()
    
    logger.debug(f'[batchQueryExistingAddresses] 批量查询 {len(addresses)} 个地址，项目={project}')
    session = sessionmaker(getDbEngine())()
    try:
        result = session.query(Wallet.address).filter(
            Wallet.project == project,
            Wallet.address.in_(addresses)
        ).all()
        existing_set = {row[0] for row in result}
        logger.debug(f'[batchQueryExistingAddresses] 找到 {len(existing_set)} 个已存在的地址')
        return existing_set
    finally:
        session.close()


def batchInsertWallets(wallet_data_list):
    '''
    批量插入钱包记录
    :param wallet_data_list: 钱包数据列表，每项包含 index, address, public_key, private_key, phrase, project, remark
    :return: 插入数量
    '''
    if not wallet_data_list:
        logger.debug('[batchInsertWallets] 钱包数据列表为空')
        return 0
    
    logger.info(f'[batchInsertWallets] 批量插入 {len(wallet_data_list)} 个钱包')
    session = sessionmaker(getDbEngine())()
    try:
        # 使用 bulk_insert_mappings 批量插入
        session.bulk_insert_mappings(Wallet, wallet_data_list)
        session.commit()
        logger.info(f'[batchInsertWallets] 成功插入 {len(wallet_data_list)} 个钱包')
        return len(wallet_data_list)
    except Exception as e:
        logger.error(f'[batchInsertWallets] 插入失败: {e}')
        session.rollback()
        raise e
    finally:
        session.close()


def insertWallet(index, address, private, phrase, project, remark, public=None):
    '''
    添加钱包
    :param address:
    :param private:
    :param phrase:
    :param project:
    :param remark:
    :param public:pro_stark 需要
    :return:
    '''
    logger.debug(f'[insertWallet] 插入钱包: address={address}, project={project}, index={index}')
    db_wallet = checkWalletIsExist(address, project)
    if db_wallet is not None:
        logger.debug(f'[insertWallet] 钱包已存在，跳过')
        return
    session = sessionmaker(getDbEngine())()
    try:
        wallet = Wallet(
            index=index,
            address=address,
            public_key=public,
            private_key=private,
            phrase=phrase,
            project=project,
            remark=remark)
        session.add(wallet)
        session.commit()
        logger.debug(f'[insertWallet] 钱包插入成功')
    except Exception as e:
        logger.error(f'[insertWallet] 插入失败: {e}')
        session.rollback()
        raise e
    finally:
        session.close()


def batchInsertWalletMapping(mappingList, project, remark):
    '''
    批量导入钱包映射
    :param mappingList: [{"sourceAddress": "xxx", "targetAddress": "xxx"}, ...]
    :param project: 项目名称
    :param remark: 备注
    :return: 成功导入数量
    '''
    if not mappingList:
        logger.debug('[batchInsertWalletMapping] 映射列表为空')
        return 0
    
    logger.info(f'[batchInsertWalletMapping] 批量导入 {len(mappingList)} 个映射')
    session = sessionmaker(getDbEngine())()
    now = datetime.now()
    
    try:
        # 1. 收集所有源地址
        source_addresses = [item.get('sourceAddress') for item in mappingList if item.get('sourceAddress')]
        if not source_addresses:
            logger.debug('[batchInsertWalletMapping] 无有效源地址')
            return 0
        
        # 2. 批量查询已存在的源地址
        existing_records = session.query(WalletMapping).filter(
            WalletMapping.source_address.in_(source_addresses)
        ).all()
        
        # 3. 构建已存在地址的字典 {source_address: record}
        existing_dict = {r.source_address: r for r in existing_records}
        
        # 4. 分离需要插入和更新的记录
        to_insert = []
        to_update = []
        
        for item in mappingList:
            source_address = item.get('sourceAddress')
            target_address = item.get('targetAddress')
            
            if not source_address or not target_address:
                continue
            
            if source_address in existing_dict:
                # 更新已存在的记录
                record = existing_dict[source_address]
                record.target_address = target_address
                record.project = project
                record.remark = remark
                record.updated_at = now
                to_update.append(record)
            else:
                # 新增记录
                to_insert.append({
                    'source_address': source_address,
                    'target_address': target_address,
                    'project': project,
                    'remark': remark,
                    'created_at': now,
                    'updated_at': now
                })
        
        # 5. 批量插入新记录
        if to_insert:
            session.bulk_insert_mappings(WalletMapping, to_insert)
        
        # 6. 提交事务
        session.commit()
        
        total_count = len(to_insert) + len(to_update)
        logger.info(f'[batchInsertWalletMapping] 成功导入 {total_count} 条（新增{len(to_insert)}，更新{len(to_update)}）')
        return total_count
    
    except Exception as e:
        logger.error(f'[batchInsertWalletMapping] 导入失败: {e}')
        session.rollback()
        raise e
    finally:
        session.close()


def queryWalletMappingBySourceAddresses(sourceAddresses):
    '''
    根据源地址列表批量查询钱包映射
    :param sourceAddresses: 源地址列表 ["addr1", "addr2", ...]
    :return: [{"sourceAddress": "xxx", "targetAddress": "xxx"}, ...]
    '''
    if not sourceAddresses:
        logger.debug('[queryWalletMappingBySourceAddresses] 地址列表为空')
        return []
    
    logger.debug(f'[queryWalletMappingBySourceAddresses] 批量查询 {len(sourceAddresses)} 个映射')
    session = sessionmaker(getDbEngine())()
    result = session.query(WalletMapping).filter(
        WalletMapping.source_address.in_(sourceAddresses)
    ).all()
    session.close()
    
    mapping_list = []
    for item in result:
        mapping_list.append({
            "sourceAddress": item.source_address,
            "targetAddress": item.target_address,
            "project": item.project,
            "remark": item.remark
        })
    
    logger.debug(f'[queryWalletMappingBySourceAddresses] 返回 {len(mapping_list)} 条')
    return mapping_list


def queryWalletMappingBySourceAddress(sourceAddress):
    '''
    根据单个源地址查询钱包映射
    :param sourceAddress: 源地址
    :return: {"sourceAddress": "xxx", "targetAddress": "xxx"} or None
    '''
    logger.debug(f'[queryWalletMappingBySourceAddress] 查询 {sourceAddress}')
    session = sessionmaker(getDbEngine())()
    result = session.query(WalletMapping).filter(
        WalletMapping.source_address == sourceAddress
    ).first()
    session.close()

    if result:
        logger.debug(f'[queryWalletMappingBySourceAddress] 找到映射')
        return {
            "sourceAddress": result.source_address,
            "targetAddress": result.target_address,
            "project": result.project,
            "remark": result.remark
        }
    logger.debug(f'[queryWalletMappingBySourceAddress] 未找到映射')
    return None


def queryProjectStatistics():
    '''
    查询所有项目的统计信息
    :return: [{"project": "项目名", "count": 钱包数量}, ...] 和总钱包数
    '''
    logger.debug('[queryProjectStatistics] 查询项目统计信息')
    session = sessionmaker(getDbEngine())()
    try:
        from sqlalchemy import func

        # 使用 SQL 的 COUNT() 和 GROUP BY 高效统计每个项目的钱包数量
        result = session.query(
            Wallet.project,
            func.count(Wallet.id).label('count')
        ).group_by(Wallet.project).all()

        # 构建返回数据
        project_stats = []
        total_count = 0
        for row in result:
            project_stats.append({
                "project": row.project,
                "count": row.count
            })
            total_count += row.count

        logger.debug(f'[queryProjectStatistics] 查询到 {len(project_stats)} 个项目，总钱包数: {total_count}')
        return project_stats, total_count
    finally:
        session.close()


# ==================== 交易所信息相关 ====================

def queryAllExchangeNames():
    '''
    查询所有交易所名称和平台
    :return: 交易所信息列表，包含 name 和 platform
    '''
    logger.debug('[queryAllExchangeNames] 开始查询所有交易所名称')
    session = sessionmaker(getDbEngine())()
    try:
        result = session.query(ExchangeInfo.name, ExchangeInfo.platform).filter(
            ExchangeInfo.name.isnot(None)
        ).distinct().all()
        exchanges = [{'name': row[0], 'platform': row[1]} for row in result if row[0]]
        logger.debug(f'[queryAllExchangeNames] 查询到 {len(exchanges)} 个交易所')
        return exchanges
    finally:
        session.close()


def queryExchangeByName(name):
    '''
    根据名称查询交易所信息
    :param name: 交易所名称
    :return: 交易所信息或None
    '''
    logger.debug(f'[queryExchangeByName] 查询交易所: name={name}')
    session = sessionmaker(getDbEngine())()
    try:
        result = session.query(ExchangeInfo).filter(
            ExchangeInfo.name == name
        ).first()
        if result:
            logger.debug(f'[queryExchangeByName] 找到交易所: {name}')
            return {
                "id": result.id,
                "platform": result.platform,
                "apikey": result.apikey,
                "secret": result.secret,
                "password": result.password,
                "ip": result.ip,
                "name": result.name
            }
        logger.debug(f'[queryExchangeByName] 未找到交易所: {name}')
        return None
    finally:
        session.close()


def insertExchange(platform, apikey, secret, password, ip, name):
    '''
    新增交易所信息
    :param platform: 平台名称 (binance, okx, bitget)
    :param apikey: API密钥
    :param secret: 密钥
    :param password: 密码
    :param ip: IP地址
    :param name: 名称
    :return: 新增的交易所信息
    '''
    logger.debug(f'[insertExchange] 新增交易所: name={name}, platform={platform}')
    session = sessionmaker(getDbEngine())()
    try:
        exchange = ExchangeInfo(
            platform=platform,
            apikey=apikey,
            secret=secret,
            password=password,
            ip=ip,
            name=name
        )
        session.add(exchange)
        session.commit()
        logger.debug(f'[insertExchange] 新增交易所成功: {name}')
        return {
            "id": exchange.id,
            "platform": platform,
            "apikey": apikey,
            "secret": secret,
            "password": password,
            "ip": ip,
            "name": name
        }
    except Exception as e:
        logger.error(f'[insertExchange] 新增失败: {e}')
        session.rollback()
        raise e
    finally:
        session.close()


def updateExchange(name, platform, apikey, secret, password, ip):
    '''
    更新交易所信息
    :param name: 交易所名称（用于定位）
    :param platform: 平台名称
    :param apikey: API密钥
    :param secret: 密钥
    :param password: 密码
    :param ip: IP地址
    :return: 更新的记录数
    '''
    logger.debug(f'[updateExchange] 更新交易所: name={name}')
    session = sessionmaker(getDbEngine())()
    try:
        result = session.query(ExchangeInfo).filter(
            ExchangeInfo.name == name
        ).first()
        
        if not result:
            logger.debug(f'[updateExchange] 交易所不存在: {name}')
            return 0
        
        if platform:
            result.platform = platform
        if apikey:
            result.apikey = apikey
        if secret:
            result.secret = secret
        if password:
            result.password = password
        if ip:
            result.ip = ip
        
        session.commit()
        logger.debug(f'[updateExchange] 更新成功: {name}')
        return 1
    except Exception as e:
        logger.error(f'[updateExchange] 更新失败: {e}')
        session.rollback()
        raise e
    finally:
        session.close()


def deleteExchange(name):
    '''
    删除交易所信息
    :param name: 交易所名称
    :return: 删除的记录数
    '''
    logger.debug(f'[deleteExchange] 删除交易所: name={name}')
    session = sessionmaker(getDbEngine())()
    try:
        result = session.query(ExchangeInfo).filter(
            ExchangeInfo.name == name
        ).delete()
        session.commit()
        logger.debug(f'[deleteExchange] 删除 {result} 条记录')
        return result
    except Exception as e:
        logger.error(f'[deleteExchange] 删除失败: {e}')
        session.rollback()
        raise e
    finally:
        session.close()
