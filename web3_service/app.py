# -*- coding: utf-8 -*-
import sys
import os

# Windows下强制使用UTF-8编码（必须在所有其他import之前）
if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    # 设置控制台代码页为UTF-8
    import subprocess
    try:
        subprocess.run(['chcp', '65001'], shell=True, capture_output=True)
    except:
        pass

from flask import Flask, request, jsonify
from flask_cors import CORS
import service_wallet
import service_exchange_withdraw
import response_invoke
import utils_encrypt
import logging
from datetime import datetime
from logging import StreamHandler
import io

# 配置日志
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s:%(lineno)d - %(message)s'

# 创建logger
logger = logging.getLogger(__name__)
logger.setLevel(LOG_LEVEL)

# 确保Windows下日志使用UTF-8编码
if sys.platform == 'win32':
    # 创建一个使用UTF-8编码的字符串流作为日志输出
    class UTF8StreamHandler(StreamHandler):
        def __init__(self):
            super().__init__(sys.stdout)
            self.stream = io.TextIOWrapper(
                sys.stdout.buffer,
                encoding='utf-8',
                errors='replace',
                line_buffering=True
            )
    
    handler = UTF8StreamHandler()
else:
    handler = StreamHandler(sys.stdout)

handler.setFormatter(logging.Formatter(LOG_FORMAT))
logger.addHandler(handler)

# 禁用Flask的自动编码转换
app = Flask(__name__)

# 确保Flask使用UTF-8
app.config['JSON_AS_ASCII'] = False
app.config['JSON_SORT_KEYS'] = False
app.config['RESTFUL_JSON'] = {'ensure_ascii': False}

CORS(app)

# 请求处理前后添加编码设置
@app.before_request
def before_request():
    # 强制设置请求编码为UTF-8
    if request.content_type and 'application/json' in request.content_type:
        request.charset = 'utf-8'

# 响应处理，确保中文不乱码
@app.after_request
def after_request(response):
    if response.mimetype == 'application/json':
        # 确保响应头指定UTF-8编码
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response


# ================钱包相关======================>>>>

@app.route('/wallet/projects')
def walletProjects():
    logger.info('[walletProjects] Get wallet project list')
    result = service_wallet.getWalletProjects()
    logger.info('[walletProjects] Return %d projects', len(result))
    resp = response_invoke.resp_invoke_ok(result)
    return jsonify(resp)


@app.route('/wallet/project/stats')
def walletProjectStats():
    logger.info('[walletProjectStats] Get project statistics')
    result = service_wallet.getProjectStatistics()
    logger.info('[walletProjectStats] Return %d projects, total wallets: %d', len(result['projects']), result['total'])
    resp = response_invoke.resp_invoke_ok(result)
    return jsonify(resp)


@app.route('/wallet/list', methods=['POST'])
def walletList():
    logger.info('[walletList] Request start')
    data = request.get_json(silent=True) or {}
    address = data.get('address')
    project = data.get('project')
    pwd = data.get('pwd')
    logger.info('[walletList] address=%s, project=%s, pwd_len=%d', address, project, len(pwd) if pwd else 0)
    
    # 解密pwd
    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[walletList] pwd decrypt success, len=%d', len(pwd_decrypted) if pwd_decrypted else 0)

    result = service_wallet.walletList(address, project, pwd_decrypted)
    logger.info('[walletList] Return %d wallets', len(result))

    resp = response_invoke.resp_invoke_ok(result)
    return jsonify(resp)


@app.route('/wallet/one', methods=['GET'])
def walletOne():
    logger.info('[walletOne] Request start')
    address = request.args.get('address')
    pwd = request.args.get('pwd')
    logger.info('[walletOne] address=%s, pwd_len=%d', address, len(pwd) if pwd else 0)
    
    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[walletOne] pwd decrypt success')
    
    result = service_wallet.oneWallet(address, pwd_decrypted)
    logger.info('[walletOne] Return %s', 'Found wallet' if result else 'Not found')

    resp = response_invoke.resp_invoke_ok(result)
    return jsonify(resp)


@app.route('/wallet/insert', methods=['POST'])
def insertWalletList():
    logger.info('[insertWalletList] Request start')
    data = request.get_json(silent=True) or {}
    wallet_list = data.get('walletList', [])
    project = data.get('project')
    remark = data.get('remark')
    pwd = data.get('pwd')
    logger.info('[insertWalletList] project=%s, remark=%s, wallet_count=%d, pwd_len=%d', project, remark, len(wallet_list), len(pwd) if pwd else 0)
    
    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[insertWalletList] pwd decrypt success')

    result = service_wallet.insertWalletList(wallet_list, project, remark, pwd_decrypted)
    logger.info('[insertWalletList] insert result=%s', result)
    return response_invoke.resp_invoke_ok(result)


@app.route('/wallet/create', methods=['POST'])
def createWalletList():
    logger.info('[createWalletList] Request start')
    data = request.get_json(silent=True) or {}
    wallet_type = data.get('type')
    wallet_num = int(data.get('number'))
    pwd = data.get('pwd')
    project = data.get('project')
    remark = data.get('remark')
    logger.info('[createWalletList] type=%s, number=%d, project=%s, remark=%s, pwd_len=%d', wallet_type, wallet_num, project, remark, len(pwd) if pwd else 0)
    
    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[createWalletList] pwd decrypt success')

    result = service_wallet.createWalletList(wallet_type, wallet_num, project, remark, pwd_decrypted)
    logger.info('[createWalletList] create result=%s', result)
    return response_invoke.resp_invoke_ok(result)


@app.route('/admin/wallets/by-address/<address>', methods=['GET'])
def walletQueryByAddress(address):
    logger.info('[walletQueryByAddress] Request start, address=%s', address)
    pwd = request.args.get('pwd', '')
    logger.info('[walletQueryByAddress] pwd_len=%d', len(pwd) if pwd else 0)
    
    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[walletQueryByAddress] pwd decrypt success')
    
    result = service_wallet.oneWallet(address, pwd_decrypted)
    if result:
        logger.info('[walletQueryByAddress] Found wallet: %s...', address[:10])
    else:
        logger.warning('[walletQueryByAddress] Wallet not found: %s', address)
    
    info = {
        "address": result['address'],
        "private_key": result['privateKey']
    }
    resp = response_invoke.resp_invoke_ok(info)
    return jsonify(resp)


# <<<<================钱包相关======================

# ================钱包映射相关======================>>>>

@app.route('/wallet/mapping/batch-import', methods=['POST'])
def batchImportWalletMapping():
    logger.info('[batchImportWalletMapping] Request start')
    data = request.get_json(silent=True) or {}
    mapping_list = data.get('mappingList', [])
    project = data.get('project', '')
    remark = data.get('remark', '')
    logger.info('[batchImportWalletMapping] mapping_count=%d, project=%s', len(mapping_list), project)

    result = service_wallet.batchImportWalletMapping(mapping_list, project, remark)
    logger.info('[batchImportWalletMapping] Success import %d records', result['successCount'])
    return response_invoke.resp_invoke_ok(result)


@app.route('/wallet/mapping/batch-query', methods=['POST'])
def batchQueryWalletMapping():
    logger.info('[batchQueryWalletMapping] Request start')
    data = request.get_json(silent=True) or {}
    source_addresses = data.get('sourceAddresses', [])
    logger.info('[batchQueryWalletMapping] query_count=%d', len(source_addresses))

    result = service_wallet.batchQueryWalletMapping(source_addresses)
    logger.info('[batchQueryWalletMapping] Return %d records', len(result))
    return response_invoke.resp_invoke_ok(result)


@app.route('/wallet/mapping/one', methods=['GET'])
def oneWalletMapping():
    logger.info('[oneWalletMapping] Request start')
    source_address = request.args.get('sourceAddress')
    logger.info('[oneWalletMapping] sourceAddress=%s', source_address)

    result = service_wallet.oneWalletMapping(source_address)
    logger.info('[oneWalletMapping] Return %s', 'Found' if result else 'Not found')
    return response_invoke.resp_invoke_ok(result)


# <<<<================钱包映射相关======================

# ================交易所信息相关======================>>>>

@app.route('/exchange/names', methods=['GET'])
def exchangeNames():
    logger.info('[exchangeNames] Request start')
    result = service_wallet.getExchangeNames()
    logger.info('[exchangeNames] Return %d exchanges', len(result))
    resp = response_invoke.resp_invoke_ok(result)
    return jsonify(resp)


@app.route('/exchange/one', methods=['GET'])
def exchangeOne():
    logger.info('[exchangeOne] Request start')
    name = request.args.get('name')
    pwd = request.args.get('pwd')
    logger.info('[exchangeOne] name=%s, pwd_len=%d', name, len(pwd) if pwd else 0)

    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[exchangeOne] pwd decrypt success')

    result = service_wallet.getExchangeByName(name, pwd_decrypted)
    logger.info('[exchangeOne] Return %s', 'Found exchange' if result else 'Not found')

    resp = response_invoke.resp_invoke_ok(result)
    return jsonify(resp)


@app.route('/exchange/insert', methods=['POST'])
def insertExchange():
    logger.info('[insertExchange] Request start')
    data = request.get_json(silent=True) or {}
    platform = data.get('platform')
    apikey = data.get('apikey')
    secret = data.get('secret')
    password = data.get('password')
    ip = data.get('ip')
    name = data.get('name')
    pwd = data.get('pwd')
    logger.info('[insertExchange] name=%s, platform=%s, pwd_len=%d', name, platform, len(pwd) if pwd else 0)

    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[insertExchange] pwd decrypt success')

    result = service_wallet.insertExchange(platform, apikey, secret, password, ip, name, pwd_decrypted)
    logger.info('[insertExchange] insert result=%s', result)
    return response_invoke.resp_invoke_ok(result)


@app.route('/exchange/update', methods=['POST'])
def updateExchange():
    logger.info('[updateExchange] Request start')
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    platform = data.get('platform')
    apikey = data.get('apikey')
    secret = data.get('secret')
    password = data.get('password')
    ip = data.get('ip')
    pwd = data.get('pwd')
    logger.info('[updateExchange] name=%s, platform=%s, pwd_len=%d', name, platform, len(pwd) if pwd else 0)

    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[updateExchange] pwd decrypt success')

    result = service_wallet.updateExchange(name, platform, apikey, secret, password, ip, pwd_decrypted)
    logger.info('[updateExchange] update result=%s', result)
    return response_invoke.resp_invoke_ok(result)


@app.route('/exchange/delete', methods=['POST'])
def deleteExchange():
    logger.info('[deleteExchange] Request start')
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    logger.info('[deleteExchange] name=%s', name)

    result = service_wallet.deleteExchange(name)
    logger.info('[deleteExchange] delete result=%s', result)
    return response_invoke.resp_invoke_ok(result)


# <<<<================交易所信息相关======================

# ================交易所提现相关======================>>>>

@app.route('/exchange/withdraw', methods=['POST'])
def exchangeWithdraw():
    logger.info('[exchangeWithdraw] Request start')
    data = request.get_json(silent=True) or {}
    exchange_name = data.get('exchange')
    pwd = data.get('pwd')
    to_address = data.get('toAddress')
    network = data.get('network')
    coin = data.get('coin')
    amount = data.get('amount')

    logger.info('[exchangeWithdraw] exchange=%s, toAddress=%s..., network=%s, coin=%s, amount=%s',
                exchange_name, to_address[:10] if to_address else '', network, coin, amount)

    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[exchangeWithdraw] pwd decrypt success')

    result = service_exchange_withdraw.withdraw(exchange_name, pwd_decrypted, to_address, network, coin, amount)
    logger.info('[exchangeWithdraw] withdraw result=%s', result)

    if result['success']:
        return response_invoke.resp_invoke_ok(result['data'])
    else:
        return response_invoke.resp_invoke_fail(result['msg'])


@app.route('/exchange/withdraw/fee', methods=['POST'])
def getWithdrawFee():
    logger.info('[getWithdrawFee] Request start')
    data = request.get_json(silent=True) or {}
    exchange_name = data.get('exchange')
    pwd = data.get('pwd')
    coin = data.get('coin')
    network = data.get('network')

    logger.info('[getWithdrawFee] exchange=%s, coin=%s, network=%s', exchange_name, coin, network)

    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[getWithdrawFee] pwd decrypt success')

    result = service_exchange_withdraw.get_withdraw_fee(exchange_name, pwd_decrypted, coin, network)
    logger.info('[getWithdrawFee] result=%s', result)

    if result['success']:
        return response_invoke.resp_invoke_ok(result['data'])
    else:
        return response_invoke.resp_invoke_fail(result['msg'])


@app.route('/exchange/balance', methods=['POST'])
def getExchangeBalance():
    logger.info('[getExchangeBalance] Request start')
    data = request.get_json(silent=True) or {}
    exchange_name = data.get('exchange')
    pwd = data.get('pwd')
    coin = data.get('coin')

    logger.info('[getExchangeBalance] exchange=%s, coin=%s', exchange_name, coin)

    pwd_decrypted = utils_encrypt.decrypt_pwd(pwd)
    logger.info('[getExchangeBalance] pwd decrypt success')

    result = service_exchange_withdraw.get_balance(exchange_name, pwd_decrypted, coin)
    logger.info('[getExchangeBalance] result=%s', result)

    if result['success']:
        return response_invoke.resp_invoke_ok(result['data'])
    else:
        return response_invoke.resp_invoke_fail(result['msg'])


# <<<<================交易所提现相关======================


# <<<<================钱包映射相关======================

@app.route('/')
def hello_world():
    return 'Hello World!'


if __name__ == '__main__':
    logger.info('Start Web3 Wallet Service')
    app.run(host='0.0.0.0', port=3000)
