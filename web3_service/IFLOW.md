# Web3 钱包服务

## 项目概述

这是一个基于 Flask 的 Web3 钱包管理服务,支持 EVM 兼容链(以太坊等)和 Solana 链的钱包创建、管理和查询功能。提供 RESTful API 接口,用于批量生成钱包、导入钱包、查询钱包信息等操作。

## 技术栈

- **后端框架**: Flask
- **数据库**: MySQL (SQLAlchemy ORM)
- **加密**: AES 加密算法
- **钱包库**: 
  - EVM: hdwallet (BIP44)
  - Solana: solders, mnemonic
- **跨域**: Flask-CORS

## 项目结构

```
web3_service/
├── app.py                 # Flask 应用入口,定义 API 路由
├── service_wallet.py      # 钱包业务逻辑层
├── db_model.py           # 数据库模型定义
├── utils_db.py           # 数据库操作工具
├── utils_encrypt.py      # 加密/解密工具
├── utils_wallet_evm.py   # EVM 钱包生成工具
├── utils_wallet_sol.py   # Solana 钱包生成工具
├── response_invoke.py    # 统一响应格式
└── sql.sql              # 数据库初始化脚本
```

## 数据库配置

数据库连接配置在 `db_model.py` 中:

```python
DB_URI = "mysql+pymysql://root:1q2w3e4r5t@127.0.0.1:3306/lumao"
```

**数据表结构**:

### wallet 表
- `id`: 主键,自增
- `index`: 钱包序号
- `address`: 钱包地址
- `public_key`: 公钥
- `private_key`: 加密后的私钥
- `phrase`: 加密后的助记词
- `project`: 项目标识
- `remark`: 备注

### exchange_info 表
- `id`: 主键,自增
- `apikey`: API 密钥
- `secret`: 密钥
- `password`: 密码
- `ip`: IP 地址
- `platform`: 交易平台

## API 接口文档

### 钱包项目管理

#### 获取钱包项目列表
```
GET /wallet/projects
```

**响应示例**:
```json
{
  "code": 20000,
  "data": ["project1", "project2"],
  "msg": "ok"
}
```

### 钱包查询

#### 查询钱包列表
```
POST /wallet/list
Content-Type: application/json

{
  "address": "0x...",    // 可选
  "project": "project1",  // 可选
  "pwd": "encryption_password"
}
```

#### 查询单个钱包
```
GET /wallet/one?address=0x...&pwd=encryption_password
```

#### 管理员查询钱包私钥
```
GET /admin/wallets/by-address/{address}
```

**响应示例**:
```json
{
  "code": 20000,
  "data": {
    "address": "0x...",
    "private_key": "0x..."
  },
  "msg": "ok"
}
```

### 钱包创建与导入

#### 批量导入钱包
```
POST /wallet/insert
Content-Type: application/json

{
  "walletList": [
    "address1,privateKey1,mnemonic1",
    "address2,privateKey2,mnemonic2"
  ],
  "project": "project1",
  "remark": "batch import",
  "pwd": "encryption_password"
}
```

#### 批量创建钱包
```
POST /wallet/create
Content-Type: application/json

{
  "type": "evm",          // evm 或 sol
  "number": 10,           // 创建数量
  "project": "project1",
  "remark": "auto generate",
  "pwd": "encryption_password"
}
```

## 核心功能实现

### 1. 钱包生成

#### EVM 钱包 (utils_wallet_evm.py)
- 使用 BIP44 标准生成助记词
- 支持以太坊主网
- 生成地址、私钥和助记词

#### Solana 钱包 (utils_wallet_sol.py)
- 使用 BIP44 路径: `m/44'/501'/0'/0'`
- 基于助记词生成密钥对
- 返回公钥地址和私钥

### 2. 加密机制

采用双层 AES 加密:

1. **第一层**: 使用密码加密原始数据
2. **第二层**: 使用 `密码 + "@tea"` 再次加密

**加密流程**:
```
原始数据 → AES加密(密码) → AES加密(密码@tea) → 存储
```

**解密流程**:
```
存储数据 → AES解密(密码@tea) → AES解密(密码) → 原始数据
```

### 3. 数据库操作

主要功能:
- 项目列表查询
- 钱包地址/项目查询
- 钱包去重插入
- 项目序号管理

## 安全注意事项

1. **密码管理**: 加密密码需要妥善保管,丢失密码将无法解密私钥
2. **数据库安全**: 生产环境需使用强密码和访问控制
3. **传输安全**: 建议部署 HTTPS
4. **私钥保护**: 私钥和助记词在数据库中加密存储

## 运行项目

### 安装依赖

```bash
pip install flask flask-cors sqlalchemy pymysql cryptography hdwallet solders mnemonic
```

### 启动服务

**方式 1**: 直接运行
```bash
python app.py
```

**方式 2**: Flask 命令
```bash
flask run --host=127.0.0.1 --port=3000
```

服务将在 `http://127.0.0.1:3000` 启动

### 数据库初始化

执行 `sql.sql` 文件中的 SQL 语句创建数据表结构。

## 开发建议

1. **配置文件**: 建议将数据库配置提取到环境变量或配置文件中
2. **日志记录**: 添加详细的日志记录便于问题排查
3. **异常处理**: 完善异常处理机制
4. **API 认证**: 生产环境建议添加 API 认证机制
5. **输入验证**: 加强参数验证和过滤
6. **单元测试**: 为核心功能编写单元测试

## 响应格式

所有 API 统一使用以下响应格式:

**成功响应**:
```json
{
  "code": 20000,
  "data": {},
  "msg": "ok"
}
```

**失败响应**:
```json
{
  "code": -1,
  "data": {},
  "msg": "错误信息"
}
```