# coding:utf-8
'''
    Authorize: llq
    le: utils_wallet_evm.py
    Date: 2024/7/15-19:44
'''
from hdwallet import BIP44HDWallet
from hdwallet.cryptocurrencies import EthereumMainnet
from hdwallet.utils import generate_mnemonic


def createAccountsOutSeedMulit(count):
    '''
    生成短语种子钱包
    :param count: 钱包数量
    :param fileName: 文件名
    :param seed_length: 短语长度
    :param seed: 已有短语
    :return:
    '''
    walletInfoList = []
    for i in range(count):
        # 没有助记词,生成助记词
        strength = int(128 * (12 / 12))
        mnemonic = generate_mnemonic(language="english", strength=strength)
        bip44_hdwallet: BIP44HDWallet = BIP44HDWallet(cryptocurrency=EthereumMainnet)
        # Get Ethereum BIP44HDWallet from mnemonic
        bip44_hdwallet.from_mnemonic(
            mnemonic=mnemonic, language="english"  # , passphrase=PASSPHRASE
        )
        address = bip44_hdwallet.address()
        privateKey = bip44_hdwallet.private_key()

        # Clean default BIP44 derivation indexes/paths
        bip44_hdwallet.clean_derivation()
        walletInfoList.append(f"{address},{privateKey},{mnemonic}")

    return walletInfoList
