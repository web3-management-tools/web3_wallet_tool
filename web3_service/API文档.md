# Web3钱包服务API文档

## 基础信息
- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`
- **CORS**: 已启用，支持跨域请求
- **响应格式**: 所有接口统一返回JSON格式

## 通用响应格式

### 成功响应
```json
{
  "code": 20000,
  "data": {},
  "msg": "ok"
}
```

### 失败响应
```json
{
  "code": -1,
  "data": {},
  "msg": "错误信息"
}
```

---

## 1. 钱包项目管理

### 1.1 获取钱包项目列表

**接口信息**
- **URL**: `/wallet/projects`
- **Method**: `GET`
- **描述**: 获取所有钱包项目列表

**请求参数**
无

**响应示例**
```json
{
  "code": 20000,
  "data": ["project1", "project2", "project3"],
  "msg": "ok"
}
```

---

### 1.2 获取项目统计信息

**接口信息**
- **URL**: `/wallet/project/stats`
- **Method**: `GET`
- **描述**: 获取所有项目的钱包统计信息，包括每个项目的钱包数量和总钱包数

**请求参数**
无

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "projects": [
      {
        "project": "project1",
        "count": 100
      },
      {
        "project": "project2",
        "count": 50
      }
    ],
    "total": 150
  },
  "msg": "ok"
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| projects | array | 项目统计列表 |
| projects[].project | string | 项目名称 |
| projects[].count | integer | 该项目的钱包数量 |
| total | integer | 所有项目的钱包总数 |

---

## 2. 钱包查询

### 2.1 查询钱包列表

**接口信息**
- **URL**: `/wallet/list`
- **Method**: `POST`
- **描述**: 根据条件查询钱包列表，支持解密私钥和助记词

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| address | string | 否 | 钱包地址，精确查询 |
| project | string | 否 | 项目标识 |
| pwd | string | 是 | 加密密码，用于解密私钥和助记词。**注意：pwd需要使用AES加密后传输，密钥配置在前端环境变量`PWD_DECRYPT_KEY`中** |

**pwd加密传输说明**
```javascript
import CryptoJS from 'crypto-js';

const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY; // 从环境变量获取

// 前端pwd加密方法（必须与后端配置一致）
function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}
```

**请求示例**
```json
{
  "address": "0x1234567890abcdef...",
  "project": "project1",
  "pwd": "U2FsdGVkX1+..."  // 加密后的pwd
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": [
    {
      "index": 1,
      "address": "0x1234567890abcdef...",
      "publicKey": "0xpublickey...",
      "privateKey": "U2FsdGVkX1+...",  // 加密后的私钥，需要使用PWD_DECRYPT_KEY解密
      "phrase": "U2FsdGVkX1+...",       // 加密后的助记词，需要使用PWD_DECRYPT_KEY解密
      "project": "project1",
      "remark": "batch import"
    }
  ],
  "msg": "ok"
}
```

> **重要**: `privateKey`和`phrase`字段返回的是使用`PWD_DECRYPT_KEY`加密后的数据，前端需要使用相同的密钥解密后才能得到原始私钥和助记词。

---

### 2.2 查询单个钱包

**接口信息**
- **URL**: `/wallet/one`
- **Method**: `GET`
- **描述**: 根据钱包地址查询单个钱包详情

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| address | string | 是 | 钱包地址 |
| pwd | string | 是 | 加密密码。**注意：pwd需要使用AES加密后传输** |

**pwd加密传输说明**
```javascript
import CryptoJS from 'crypto-js';

const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY;

function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}
```

**请求示例**
```
GET /wallet/one?address=0x1234567890abcdef...&pwd=U2FsdGVkX1+...
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "index": 1,
    "address": "0x1234567890abcdef...",
    "publicKey": "0xpublickey...",
    "privateKey": "U2FsdGVkX1+...",  // 加密后的私钥
    "phrase": "U2FsdGVkX1+...",       // 加密后的助记词
    "project": "project1",
    "remark": "auto generate"
  },
  "msg": "ok"
}
```

> **重要**: `privateKey`和`phrase`字段返回的是使用`PWD_DECRYPT_KEY`加密后的数据。

---

## 3. 钱包创建与导入

### 3.1 批量导入钱包

**接口信息**
- **URL**: `/wallet/insert`
- **Method**: `POST`
- **描述**: 批量导入已有钱包（地址、私钥、助记词）

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| walletList | array | 是 | 钱包列表，格式：`["地址,加密私钥,加密助记词", ...]`，**私钥和助记词需要使用PWD_DECRYPT_KEY加密后传输** |
| project | string | 是 | 项目标识 |
| remark | string | 否 | 备注信息 |
| pwd | string | 是 | 加密密码，用于加密私钥和助记词。**注意：pwd需要使用AES加密后传输** |

**walletList格式说明**
```
["地址1,加密私钥1,加密助记词1", "地址2,加密私钥2,加密助记词2"]
```

> **重要**: 私钥和助记词在传输前需要使用`PWD_DECRYPT_KEY`进行AES加密。

**pwd加密传输说明**
```javascript
import CryptoJS from 'crypto-js';

const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY;

function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}
```

**请求示例**
```json
{
  "walletList": [
    "0xaddress1,U2FsdGVkX1+privatekey1,U2FsdGVkX1+phrase1",
    "0xaddress2,U2FsdGVkX1+privatekey2,U2FsdGVkX1+phrase2"
  ],
  "project": "project1",
  "remark": "batch import",
  "pwd": "U2FsdGVkX1+..."  // 加密后的pwd
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": true,
  "msg": "ok"
}
```

---

### 3.2 批量创建钱包

**接口信息**
- **URL**: `/wallet/create`
- **Method**: `POST`
- **描述**: 批量创建新钱包（自动生成地址、私钥、助记词）

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 是 | 钱包类型：`evm`（以太坊）或 `sol`（Solana） |
| number | integer | 是 | 创建数量 |
| project | string | 是 | 项目标识 |
| remark | string | 否 | 备注信息 |
| pwd | string | 是 | 加密密码。**注意：pwd需要使用AES加密后传输** |

**pwd加密传输说明**
```javascript
import CryptoJS from 'crypto-js';

const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY;

function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}
```

**请求示例**
```json
{
  "type": "evm",
  "number": 10,
  "project": "project1",
  "remark": "auto generate",
  "pwd": "U2FsdGVkX1+..."  // 加密后的pwd
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": true,
  "msg": "ok"
}
```

---

## 4. 钱包映射管理

### 4.1 批量导入钱包映射

**接口信息**
- **URL**: `/wallet/mapping/batch-import`
- **Method**: `POST`
- **描述**: 批量导入源地址到目标地址的映射关系，支持更新已存在的映射

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| mappingList | array | 是 | 映射关系列表 |
| project | string | 否 | 项目名称 |
| remark | string | 否 | 备注信息 |

**mappingList 格式**
```json
[
  {"sourceAddress": "源地址1", "targetAddress": "目标地址1"},
  {"sourceAddress": "源地址2", "targetAddress": "目标地址2"}
]
```

**请求示例**
```json
{
  "mappingList": [
    {"sourceAddress": "0xSource1...", "targetAddress": "0xTarget1..."},
    {"sourceAddress": "0xSource2...", "targetAddress": "0xTarget2..."}
  ],
  "project": "项目名称",
  "remark": "备注信息"
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "successCount": 2
  },
  "msg": "ok"
}
```

> **注意**: 如果源地址已存在，则更新其对应的目标地址信息。

---

### 4.2 批量查询钱包映射

**接口信息**
- **URL**: `/wallet/mapping/batch-query`
- **Method**: `POST`
- **描述**: 根据源地址列表批量查询对应的目标地址

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sourceAddresses | array | 是 | 源地址列表 |

**请求示例**
```json
{
  "sourceAddresses": [
    "0xSource1...",
    "0xSource2...",
    "0xSource3..."
  ]
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": [
    {
      "sourceAddress": "0xSource1...",
      "targetAddress": "0xTarget1...",
      "project": "项目名称",
      "remark": "备注"
    },
    {
      "sourceAddress": "0xSource2...",
      "targetAddress": "0xTarget2...",
      "project": "项目名称",
      "remark": "备注"
    }
  ],
  "msg": "ok"
}
```

> **注意**: 只返回数据库中存在的源地址对应的映射关系。

---

### 4.3 查询单个钱包映射

**接口信息**
- **URL**: `/wallet/mapping/one`
- **Method**: `GET`
- **描述**: 根据源地址查询对应的目标地址

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| sourceAddress | string | 是 | 源地址 |

**请求示例**
```
GET /wallet/mapping/one?sourceAddress=0xSource1...
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "sourceAddress": "0xSource1...",
    "targetAddress": "0xTarget1...",
    "project": "项目名称",
    "remark": "备注"
  },
  "msg": "ok"
}
```

**未找到**
```json
{
  "code": 20000,
  "data": null,
  "msg": "ok"
}
```

---

## 5. 交易所信息管理

### 5.1 获取交易所名称列表

**接口信息**
- **URL**: `/exchange/names`
- **Method**: `GET`
- **描述**: 获取所有已配置的交易所名称和平台列表

**请求参数**
无

**响应示例**
```json
{
  "code": 20000,
  "data": [
    {
      "name": "binance_main",
      "platform": "binance"
    },
    {
      "name": "okx_trading",
      "platform": "okx"
    },
    {
      "name": "bitget_spot",
      "platform": "bitget"
    }
  ],
  "msg": "ok"
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| data[].name | string | 交易所名称（唯一标识） |
| data[].platform | string | 平台名称（binance, okx, bitget, gate, bybit） |

---

### 5.2 查询单个交易所信息

**接口信息**
- **URL**: `/exchange/one`
- **Method**: `GET`
- **描述**: 根据名称查询单个交易所详情，敏感数据（apikey、secret、password）会使用 `PWD_DECRYPT_KEY` 加密后返回

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 交易所名称 |
| pwd | string | 是 | 加密密码。**注意：pwd需要使用AES加密后传输** |

**pwd加密传输说明**
```javascript
import CryptoJS from 'crypto-js';

const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY;

function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}
```

**请求示例**
```
GET /exchange/one?name=binance_main&pwd=U2FsdGVkX1+...
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "id": 1,
    "platform": "binance",
    "apikey": "U2FsdGVkX1+...",  // 加密后的apikey
    "secret": "U2FsdGVkX1+...",  // 加密后的secret
    "password": "U2FsdGVkX1+...", // 加密后的password
    "ip": "1.2.3.4",
    "name": "binance_main"
  },
  "msg": "ok"
}
```

> **重要**: `apikey`、`secret`、`password` 字段返回的是使用 `PWD_DECRYPT_KEY` 加密后的数据，前端需要使用相同的密钥解密后才能得到原始值。

---

### 5.3 新增交易所信息

**接口信息**
- **URL**: `/exchange/insert`
- **Method**: `POST`
- **描述**: 新增交易所API配置信息，敏感数据需要先使用 `PWD_DECRYPT_KEY` 加密后传输

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| platform | string | 是 | 平台名称：`binance`、`okx`、`bitget` |
| name | string | 是 | 交易所名称（唯一标识） |
| apikey | string | 是 | API密钥，**需要使用PWD_DECRYPT_KEY加密后传输** |
| secret | string | 是 | 密钥，**需要使用PWD_DECRYPT_KEY加密后传输** |
| password | string | 否 | 密码，**需要使用PWD_DECRYPT_KEY加密后传输** |
| ip | string | 否 | IP地址 |
| pwd | string | 是 | 加密密码，**需要使用AES加密后传输** |

**请求示例**
```json
{
  "platform": "binance",
  "name": "binance_main",
  "apikey": "U2FsdGVkX1+...",  // 加密后的apikey
  "secret": "U2FsdGVkX1+...",  // 加密后的secret
  "password": "U2FsdGVkX1+...", // 加密后的password
  "ip": "1.2.3.4",
  "pwd": "U2FsdGVkX1+..."  // 加密后的pwd
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "id": 1,
    "platform": "binance",
    "apikey": "U2FsdGVkX1+...",
    "secret": "U2FsdGVkX1+...",
    "password": "U2FsdGVkX1+...",
    "ip": "1.2.3.4",
    "name": "binance_main"
  },
  "msg": "ok"
}
```

---

### 5.4 更新交易所信息

**接口信息**
- **URL**: `/exchange/update`
- **Method**: `POST`
- **描述**: 更新交易所API配置信息，只传入需要更新的字段，不传入的字段保持不变

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 交易所名称（用于定位要更新的记录） |
| platform | string | 否 | 平台名称 |
| apikey | string | 否 | API密钥，**需要使用PWD_DECRYPT_KEY加密后传输** |
| secret | string | 否 | 密钥，**需要使用PWD_DECRYPT_KEY加密后传输** |
| password | string | 否 | 密码，**需要使用PWD_DECRYPT_KEY加密后传输** |
| ip | string | 否 | IP地址 |
| pwd | string | 是 | 加密密码，**需要使用AES加密后传输** |

**请求示例**
```json
{
  "name": "binance_main",
  "platform": "binance",
  "apikey": "U2FsdGVkX1+...",  // 新的加密后的apikey
  "secret": "U2FsdGVkX1+...",  // 新的加密后的secret
  "pwd": "U2FsdGVkX1+..."
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": 1,
  "msg": "ok"
}
```

> **注意**: 返回的 `data` 字段表示更新的记录数量。

---

### 5.5 删除交易所信息

**接口信息**
- **URL**: `/exchange/delete`
- **Method**: `POST`
- **描述**: 删除指定名称的交易所配置

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 交易所名称 |

**请求示例**
```json
{
  "name": "binance_main"
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": 1,
  "msg": "ok"
}
```

> **注意**: 返回的 `data` 字段表示删除的记录数量。

---

## 6. 交易所提现相关

### 6.1 交易所提现

**接口信息**
- **URL**: `/exchange/withdraw`
- **Method**: `POST`
- **描述**: 从交易所提数字货币到指定地址

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| exchange | string | 是 | 交易所名称（数据库中配置的name） |
| pwd | string | 是 | 加密密码。**注意：pwd需要使用AES加密后传输** |
| toAddress | string | 是 | 目标地址 |
| network | string | 是 | 提现网络（BSC, ETH, TRC20, ARB, AVAX等） |
| coin | string | 是 | 代币符号（USDT, ETH, BTC等） |
| amount | number | 是 | 提现金额 |

**支持的交易所和平台**
- Binance
- Bitget
- OKX
- Gate.io
- Bybit


**请求示例**
```json
{
  "exchange": "binance_main",
  "pwd": "U2FsdGVkX1+...",
  "toAddress": "0x1234567890abcdef...",
  "network": "BSC",
  "coin": "USDT",
  "amount": 100
}
```

**成功响应示例**
```json
{
  "code": 20000,
  "data": {
    "exchange": "Binance",
    "txid": "withdraw123456",
    "withdraw_id": "withdraw123456",
    "amount": 100,
    "coin": "USDT",
    "network": "BSC",
    "to_address": "0x1234567890abcdef...",
    "status": "pending",
    "raw_response": {}
  },
  "msg": "ok"
}
```

**失败响应示例**
```json
{
  "code": -1,
  "data": null,
  "msg": "余额不足: Insufficient funds"
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| data.exchange | string | 交易所名称 |
| data.txid | string | 提现交易ID |
| data.withdraw_id | string | 提现ID |
| data.amount | number | 提现金额 |
| data.coin | string | 代币符号 |
| data.network | string | 提现网络 |
| data.to_address | string | 目标地址 |
| data.status | string | 提现状态 |
| msg | string | 状态信息 |

---

### 6.2 查询提现手续费

**接口信息**
- **URL**: `/exchange/withdraw/fee`
- **Method**: `POST`
- **描述**: 查询指定币种和网络的提现手续费

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| exchange | string | 是 | 交易所名称 |
| pwd | string | 是 | 加密密码。**注意：pwd需要使用AES加密后传输** |
| coin | string | 是 | 代币符号 |
| network | string | 是 | 提现网络 |

**请求示例**
```json
{
  "exchange": "binance_main",
  "pwd": "U2FsdGVkX1+...",
  "coin": "USDT",
  "network": "BSC"
}
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "coin": "USDT",
    "network": "BSC",
    "fee": "1",
    "min_withdraw": "5",
    "enabled": true
  },
  "msg": "ok"
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| data.coin | string | 代币符号 |
| data.network | string | 网络名称 |
| data.fee | string | 提现手续费 |
| data.min_withdraw | string | 最小提现金额 |
| data.enabled | boolean | 是否启用该网络提现 |

---

### 6.3 查询账户余额

**接口信息**
- **URL**: `/exchange/balance`
- **Method**: `POST`
- **描述**: 查询交易所账户余额

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| exchange | string | 是 | 交易所名称 |
| pwd | string | 是 | 加密密码。**注意：pwd需要使用AES加密后传输** |
| coin | string | 否 | 代币符号，不传则返回所有余额 |

**请求示例**
```json
{
  "exchange": "binance_main",
  "pwd": "U2FsdGVkX1+...",
  "coin": "USDT"
}
```

**响应示例（指定币种）**
```json
{
  "code": 20000,
  "data": {
    "coin": "USDT",
    "free": 1000.5,
    "used": 0,
    "total": 1000.5
  },
  "msg": "ok"
}
```

**响应示例（所有余额）**
```json
{
  "code": 20000,
  "data": [
    {
      "coin": "USDT",
      "total": 1000.5,
      "free": 1000.5,
      "used": 0
    },
    {
      "coin": "BTC",
      "total": 0.5,
      "free": 0.5,
      "used": 0
    }
  ],
  "msg": "ok"
}
```

**响应字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| data.coin | string | 代币符号 |
| data.free | number | 可用余额 |
| data.used | number | 冻结余额 |
| data.total | number | 总余额 |

---

## 7. 管理员接口

### 7.1 查询钱包私钥（管理员）

**接口信息**
- **URL**: `/admin/wallets/by-address/{address}`
- **Method**: `GET`
- **描述**: 管理员专用接口，查询钱包地址和私钥

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| address | string | 是 | 路径参数，钱包地址 |
| pwd | string | 是 | 查询参数，**pwd需要使用AES加密后传输** |

**pwd加密传输说明**
```javascript
import CryptoJS from 'crypto-js';

const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY;

function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}
```

**请求示例**
```
GET /admin/wallets/by-address/0x1234567890abcdef...?pwd=U2FsdGVkX1+...
```

**响应示例**
```json
{
  "code": 20000,
  "data": {
    "address": "0x1234567890abcdef...",
    "private_key": "U2FsdGVkX1+..."  // 加密后的私钥，需要使用PWD_DECRYPT_KEY解密
  },
  "msg": "ok"
}
```

> **重要**: `private_key`字段返回的是使用`PWD_DECRYPT_KEY`加密后的数据。

---

## 8. 系统接口

### 8.1 健康检查

**接口信息**
- **URL**: `/`
- **Method**: `GET`
- **描述**: 服务健康检查

**响应示例**
```
Hello World!
```

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 20000 | 请求成功 |
| -1 | 请求失败，具体原因见msg字段 |

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
| updated_at | timestamp | 更新时间 |

### exchange_info 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 主键 |
| platform | string | 平台名称（binance, okx, bitget） |
| name | string | 交易所名称（唯一标识） |
| apikey | string | 加密后的API密钥 |
| secret | string | 加密后的密钥 |
| password | string | 加密后的密码 |
| ip | string | IP地址 |

---

## 注意事项

1. **密码安全**：所有涉及`pwd`参数的接口，密码用于AES加密/解密私钥和助记词
2. **pwd加密传输**：为了传输安全，**所有接口的`pwd`参数必须先使用AES加密后再传输**。前端需要：
   - 在环境变量中配置 `PWD_DECRYPT_KEY`（需与后端一致）
   - 发送请求前使用 `CryptoJS.AES.encrypt()` 对pwd进行加密
   - 后端收到请求后会使用相同的密钥解密
3. **私钥加密传输**：
   - **查询接口返回的私钥**：后端会使用`PWD_DECRYPT_KEY`对私钥进行加密后返回
   - **导入接口传入的私钥**：前端需要先使用`PWD_DECRYPT_KEY`对私钥进行加密后再传输
   - 前端收到加密私钥后，需要使用`PWD_DECRYPT_KEY`解密才能得到原始私钥
4. **特殊字符处理**：GET请求中的密码如果包含特殊字符（@、#、$等），需要进行URL编码
5. **数据加密**：数据库中存储的私钥和助记词使用`pwd`加密存储
6. **项目标识**：`project`字段用于区分不同的钱包项目，查询时可用于筛选
7. **映射关系**：`wallet_mapping`表用于存储一对一的地址映射关系，source_address 字段已建立唯一索引

---

## 使用示例

### 前端pwd加密工具函数

```javascript
import CryptoJS from 'crypto-js';

// 从环境变量获取密钥（需与后端PWD_DECRYPT_KEY一致）
const PWD_DECRYPT_KEY = process.env.REACT_APP_PWD_DECRYPT_KEY || 'your_secure_pwd_decrypt_key';

/**
 * 加密pwd（必须与后端配置一致）
 * @param {string} pwd 原始密码
 * @returns {string} 加密后的密码
 */
export function encryptPwd(pwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(pwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}

/**
 * 解密pwd（仅用于调试或验证）
 * @param {string} encryptedPwd 加密后的密码
 * @returns {string} 原始密码
 */
export function decryptPwd(encryptedPwd) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const decrypted = CryptoJS.AES.decrypt(encryptedPwd, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * 加密私钥/助记词（用于导入钱包时传输）
 * @param {string} content 原始私钥或助记词
 * @returns {string} 加密后的内容
 */
export function encryptPrivateKey(content) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const encrypted = CryptoJS.AES.encrypt(content, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString(CryptoJS.enc.Base64);
}

/**
 * 解密私钥/助记词（用于查询钱包后获得原始数据）
 * @param {string} encryptedContent 加密后的私钥或助记词
 * @returns {string} 原始内容
 */
export function decryptPrivateKey(encryptedContent) {
  const key = CryptoJS.SHA256(PWD_DECRYPT_KEY);
  const iv = CryptoJS.enc.Utf8.parse('0000000000000000');
  const decrypted = CryptoJS.AES.decrypt(encryptedContent, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}
```

### 创建钱包并查询

```bash
# 1. 创建10个EVM钱包（pwd需要先加密）
# 假设原始密码是 "mysecretkey"，加密后为 "U2FsdGVkX1+..."

curl -X POST http://localhost:3000/wallet/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "evm",
    "number": 10,
    "project": "myproject",
    "pwd": "U2FsdGVkX1+..."  // 加密后的密码
  }'

# 2. 查询项目下的所有钱包
curl -X POST http://localhost:3000/wallet/list \
  -H "Content-Type: application/json" \
  -d '{
    "project": "myproject",
    "pwd": "U2FsdGVkX1+..."  // 加密后的密码
  }'

# 3. 查询单个钱包私钥（管理员）
curl "http://localhost:3000/admin/wallets/by-address/0x123...?pwd=U2FsdGVkX1+..."
```

### 钱包映射操作

```bash
# 1. 批量导入地址映射
curl -X POST http://localhost:3000/wallet/mapping/batch-import \
  -H "Content-Type: application/json" \
  -d '{
    "mappingList": [
      {"sourceAddress": "0xSource1...", "targetAddress": "0xTarget1..."},
      {"sourceAddress": "0xSource2...", "targetAddress": "0xTarget2..."}
    ],
    "project": "myproject",
    "remark": "批量导入映射"
  }'

# 2. 批量查询映射
curl -X POST http://localhost:3000/wallet/mapping/batch-query \
  -H "Content-Type: application/json" \
  -d '{
    "sourceAddresses": ["0xSource1...", "0xSource2..."]
  }'

# 3. 查询单个映射
curl "http://localhost:3000/wallet/mapping/one?sourceAddress=0xSource1..."
```
