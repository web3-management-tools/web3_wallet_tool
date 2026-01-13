# Web3_service 智能体开发指南

本文档为在该代码库工作的 AI 智能体提供开发规范。

## 项目概述

基于 Flask 的 Web3 钱包管理服务，支持 EVM 和 Solana 钱包，使用 MySQL 持久化存储。

## 构建、运行和测试命令

### 运行应用程序

```bash
# 开发服务器
python app.py

# 或通过 Flask CLI
flask run --host=0.0.0.0 --port=3000
```

### 安装依赖

```bash
pip install -r requirements.txt
```

### 数据库配置

环境变量（默认值如下）：
- `MYSQL_HOST=127.0.0.1`
- `MYSQL_PORT=3306`
- `MYSQL_USER=root`
- `MYSQL_PASSWORD=1q2w3e4r5t`
- `MYSQL_DATABASE=lumao`

## 代码风格规范

### 文件结构

- 单模块文件结构（无 `src/` 布局）
- 主入口：`app.py`
- 业务逻辑：`service_*.py`
- 工具类：`utils_*.py`
- 数据库模型：`db_model.py`

### 命名规范

| 元素 | 规范 | 示例 |
|------|------|------|
| 类名 | PascalCase | `Wallet`、`ExchangeInfo`、`AlchemyJsonEncoder` |
| 函数名 | camelCase | `getWalletProjects`、`walletList`、`oneWallet` |
| 变量名 | snake_case | `private_key`、`public_key`、`wallet_list` |
| 常量名 | UPPER_SNAKE_CASE | `DB_URI`、`MYSQL_HOST` |
| 表名 | snake_case | `wallet`、`exchange_info` |

### 导入规范

```python
# 标准库优先
import json
import os

# 第三方库导入
from flask import Flask, request, jsonify
from flask_cors import CORS

# 本地导入（使用绝对路径，不使用相对路径）
import service_wallet
import utils_db
from db_model import Wallet
```

### 类型提示

函数签名必须使用类型提示：

```python
from typing import List, Dict, Optional, Any

def walletList(address: Optional[str], project: Optional[str], pwd: str) -> List[Dict[str, Any]]:
    ...

def getWalletProjects() -> List[str]:
    ...
```

### 文档字符串

面向用户的 API 使用中文编写文档字符串：

```python
def getWalletProjects():
    '''
    获取钱包的项目列表
    :return: 项目名称列表
    '''
    ...
```

### 异常处理

禁止使用裸的 `except:` 子句，必须捕获具体异常：

```python
# 正确做法
try:
    result = utils_encrypt.decrypt(content, password)
    return result
except (ValueError, TypeError) as e:
    return None

# 错误做法
try:
    ...
except:
    return None
```

### 响应格式

所有 API 响应必须使用标准化格式：

```python
# 成功响应
resp = {
    "code": 20000,
    "data": {...},
    "msg": "ok"
}

# 失败响应
resp = {
    "code": -1,
    "data": {...},
    "msg": "错误描述"
}
```

使用辅助函数：
```python
from response_invoke import resp_invoke_ok, resp_invoke_fail
```

### 数据库会话

必须显式关闭会话：

```python
from sqlalchemy.orm import sessionmaker

session = sessionmaker(getDbEngine())()
try:
    result = session.query(Wallet).filter(...).all()
    return result
finally:
    session.close()
```

### 安全性

- 禁止记录或暴露私钥、助记词、密码
- 使用 `utils_encrypt.encrypt()` 对静态敏感数据加密
- 仅在内存中需要操作时解密

### 测试规范

新增测试时：
- 放在 `tests/` 目录
- 使用 `pytest` 作为测试框架
- 运行单个测试：`pytest tests/test_wallet.py::test_walletList`
- 模拟外部服务和数据库连接

### 其他规范

- 所有 Python 文件使用 `# coding:utf-8` 头部
- 保持函数简洁，控制在 50 行以内
- 所有配置使用环境变量
- 复杂业务逻辑添加中文注释

## API 文档

所有 API 接口文档请参考 [API文档.md](./API文档.md)

---

## 数据库表结构

### wallet 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| index | int | 钱包序号 |
| address | string | 钱包地址 |
| public_key | string | 公钥 |
| private_key | string | 加密后的私钥 |
| phrase | string | 加密后的助记词 |
| project | string | 项目名称 |
| remark | string | 备注 |

### wallet_mapping 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| source_address | string | 源地址（唯一索引） |
| target_address | string | 目标地址 |
| project | string | 项目名称 |
| remark | string | 备注 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间
