# coding:utf-8
'''
    Authorize: llq
    le: utils_wallet_sol.py
    Date: 2024/7/15-19:39
'''
from hdwallet.utils import generate_mnemonic
import mnemonic
from solders.keypair import Keypair

def create_sol_wallet(num):
    walletInfoList = []
    for i in range(0, num):
        strength = int(128 * (12 / 12))
        mnemonic = generate_mnemonic(language="english", strength=strength)
        wallet = create_address(phrase=mnemonic)
        address = wallet[0]
        privateKey = wallet[1]
        walletInfoList.append(f"{address},{privateKey},{mnemonic}")
    return walletInfoList


def create_address(phrase):
    # 通过短语创建钱包
    mnemo = mnemonic.Mnemonic("english")
    seed = mnemo.to_seed(phrase)
    keypair = Keypair.from_seed_and_derivation_path(seed, "m/44'/501'/0'/0'")#"m/44'/501'/1'/0'"
    public_key = str(keypair.pubkey())
    private_key = str(keypair)
    return [public_key, private_key]
