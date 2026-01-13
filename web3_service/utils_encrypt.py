# coding:utf-8
'''
Author: llq
Date: 2024/7/13-15:27
'''

from Crypto.Cipher import AES
import base64
import hashlib
import os
import logging
import sys

# 从环境变量加载PWD解密密钥
PWD_DECRYPT_KEY = os.getenv('PWD_DECRYPT_KEY', 'jf324!@423fdQW')

# 配置日志
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG if os.getenv('LOG_LEVEL') == 'DEBUG' else logging.INFO)

# 确保Windows控制台使用UTF-8编码
if sys.platform == 'win32':
    from logging import StreamHandler
    handler = StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('[%(levelname)s] %(message)s'))
    logger.addHandler(handler)


def decrypt_pwd(encrypted_pwd):
    '''
    解密前端传来的pwd
    :param encrypted_pwd: 加密后的pwd
    :return: 解密后的pwd
    '''
    if encrypted_pwd is None or encrypted_pwd == '':
        logger.debug('[decrypt_pwd] pwd为空，直接返回')
        return encrypted_pwd
    
    try:
        logger.debug(f'[decrypt_pwd] 开始解密，encrypted长度={len(encrypted_pwd)}')
        result = aes_decrypt(encrypted_pwd, PWD_DECRYPT_KEY)
        logger.debug(f'[decrypt_pwd] 解密成功，result长度={len(result)}')
        return result
    except Exception as e:
        logger.error(f'[decrypt_pwd] 解密失败: {e}，返回原始值')
        # 如果解密失败，返回原始pwd（兼容旧接口）
        return encrypted_pwd


def encrypt_pwd(pwd):
    '''
    加密pwd（用于测试或内部使用）
    :param pwd: 原始pwd
    :return: 加密后的pwd
    '''
    if not pwd:
        logger.debug('[encrypt_pwd] pwd为空，直接返回')
        return pwd
    
    try:
        logger.debug(f'[encrypt_pwd] 开始加密，pwd长度={len(pwd)}')
        result = aes_encrypt(pwd, PWD_DECRYPT_KEY)
        logger.debug(f'[encrypt_pwd] 加密成功，result长度={len(result)}')
        return result
    except Exception as e:
        logger.error(f'[encrypt_pwd] 加密失败: {e}')
        return pwd


def encrypt_private_key(private_key):
    '''
    加密私钥用于传输（使用PWD_DECRYPT_KEY）
    :param private_key: 原始私钥
    :return: 加密后的私钥
    '''
    try:
        if not private_key:
            logger.debug('[encrypt_private_key] 私钥为空，直接返回')
            return private_key
        
        logger.debug(f'[encrypt_private_key] 开始加密，私钥长度={len(private_key)}')
        result = aes_encrypt(private_key, PWD_DECRYPT_KEY)
        logger.debug(f'[encrypt_private_key] 加密成功，result长度={len(result)}')
        return result
    except Exception as e:
        logger.error(f'[encrypt_private_key] 加密失败: {e}')
        return private_key


def decrypt_private_key(encrypted_private_key):
    '''
    解密前端传来的私钥（使用PWD_DECRYPT_KEY）
    :param encrypted_private_key: 加密后的私钥
    :return: 解密后的私钥
    '''
    if encrypted_private_key is None or encrypted_private_key == '':
        logger.debug('[decrypt_private_key] 私钥为空，直接返回')
        return encrypted_private_key
    
    try:
        logger.debug(f'[decrypt_private_key] 开始解密，encrypted长度={len(encrypted_private_key)}')
        result = aes_decrypt(encrypted_private_key, PWD_DECRYPT_KEY)
        logger.debug(f'[decrypt_private_key] 解密成功，result长度={len(result)}')
        return result
    except Exception as e:
        logger.error(f'[decrypt_private_key] 解密失败: {e}，返回原始值')
        # 如果解密失败，返回原始私钥（兼容旧接口）
        return encrypted_private_key


# 加密
def aes_encrypt(raw, password):
    # 补全16位
    BS = 16
    pad = lambda s: s + (BS - len(s) % BS) * chr(BS - len(s) % BS)
    raw = pad(raw)

    # 计算密钥
    key = hashlib.sha256(password.encode()).digest()

    # 加密
    iv = b'0000000000000000'
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(raw.encode('utf-8'))

    # base64编码并返回结果
    return base64.b64encode(encrypted).decode('utf-8')


# 解密
def aes_decrypt(encrypted, password):
    # base64解码
    encrypted = base64.b64decode(encrypted)

    # 计算密钥
    key = hashlib.sha256(password.encode()).digest()

    # 解密
    iv = b'0000000000000000'
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(encrypted).decode('utf-8')

    # 去除填充
    unpad = lambda s: s[:-ord(s[-1])]
    decrypted = unpad(decrypted)

    # 返回解密结果
    return decrypted


# 加密
def encrypt(content, password):
    logger.debug(f'[encrypt] 加密内容，长度={len(content)}')
    aes_content = aes_encrypt(content, password)
    result = aes_encrypt(aes_content, password + "@tea")
    logger.debug(f'[encrypt] 加密完成，result长度={len(result)}')
    return result


# 解密
def decrypt(content, password):
    try:
        logger.debug(f'[decrypt] 解密内容，长度={len(content) if content else 0}')
        tea = aes_decrypt(content, password + "@tea")
        result = aes_decrypt(tea, password)
        logger.debug(f'[decrypt] 解密完成，result长度={len(result)}')
        return result
    except Exception as e:
        logger.error(f'[decrypt] 解密失败: {e}')
        return None

