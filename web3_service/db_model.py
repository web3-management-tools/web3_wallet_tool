import json
import os

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine, Column, Integer, String, TIMESTAMP, Float
from sqlalchemy.orm import Query

MYSQL_HOST = os.getenv('MYSQL_HOST', '127.0.0.1')
MYSQL_PORT = os.getenv('MYSQL_PORT', '3306')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '1q2w3e4r5t')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'lumao')

DB_URI = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}"
Base = declarative_base()


class Wallet(Base):
    __tablename__ = 'wallet'
    id = Column(Integer, primary_key=True, autoincrement=True)
    index = Column(Integer)
    address = Column(String(50))
    public_key = Column(String(256))
    private_key = Column(String(256))
    phrase = Column(String(256))
    project = Column(String(50))
    remark = Column(String(50))


class ExchangeInfo(Base):
    __tablename__ = 'exchange_info'

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String(20))
    apikey = Column(String(200))
    secret = Column(String(200))
    password = Column(String(100))
    ip = Column(String(100))
    name = Column(String(50))


class WalletMapping(Base):
    '''
    钱包一对一代表
    source_address: 源地址
    target_address: 目标地址
    '''
    __tablename__ = 'wallet_mapping'

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_address = Column(String(100), unique=True, nullable=False, index=True)
    target_address = Column(String(100), nullable=False)
    project = Column(String(50))
    remark = Column(String(100))
    created_at = Column(TIMESTAMP)
    updated_at = Column(TIMESTAMP)


class AlchemyJsonEncoder(json.JSONEncoder):
    def default(self, obj):
        # 判断是否是Query
        if isinstance(obj, Query):
            # 定义一个字典数组
            fields = []
            # 定义一个字典对象
            record = {}
            # 检索结果集的行记录
            for rec in obj.all():
                # 检索记录中的成员
                for field in [x for x in dir(rec) if
                              # 过滤属性
                              not x.startswith('_')
                              # 过滤掉方法属性
                              and hasattr(rec.__getattribute__(x), '__call__') == False
                              # 过滤掉不需要的属性
                              and x != 'metadata']:
                    data = rec.__getattribute__(field)
                    try:
                        record[field] = data
                    except TypeError:
                        record[field] = None
                fields.append(record)
            # 返回字典数组
            return fields
        # 其他类型的数据按照默认的方式序列化成JSON
        return json.JSONEncoder.default(self, obj)