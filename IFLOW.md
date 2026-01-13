# Web3 钱包管理工具

## 项目概述

这是一个完整的 Web3 钱包管理系统，包含前端和后端两个子项目：

- **web3_manager**: 基于 React + Vite 的前端管理系统，提供钱包创建、导入、转账、交易所管理等可视化界面
- **web3_service**: 基于 Flask 的后端服务，提供 RESTful API 接口，支持 EVM 兼容链（以太坊等）和 Solana 链的钱包管理

### 核心功能

- **钱包管理**: 批量创建/导入 EVM 和 Solana 钱包，查询钱包信息
- **钱包映射**: 管理源地址到目标地址的映射关系
- **交易所集成**: 支持 Binance、OKX、Bitget 等主流交易所的 API 管理和提现操作
- **转账功能**: 多链转账和钱包分发
- **安全保障**: 
  - 私钥和助记词双层 AES 加密存储
  - 前端强制要求使用无痕模式（隐私模式）
  - 传输层数据加密

## 项目结构

```
web3_wallet_tool/
├── web3_manager/          # 前端项目（React + Vite）
│   ├── src/
│   │   ├── api/          # API 接口封装
│   │   ├── components/   # 公共组件
│   │   ├── pages/        # 页面组件
│   │   └── utils/        # 工具函数
│   ├── package.json
│   └── vite.config.js
│
└── web3_service/          # 后端项目（Flask）
    ├── app.py            # Flask 应用入口
    ├── service_wallet.py # 钱包业务逻辑
    ├── service_exchange_withdraw.py # 交易所提现逻辑
    ├── utils_*.py        # 工具模块
    ├── db_model.py       # 数据库模型
    ├── requirements.txt
    └── docker-compose.yml
```

## 技术栈

### 前端 (web3_manager)
- **框架**: React 19.2.0
- **构建工具**: Vite 7.2.4
- **UI 库**: Lucide React（图标）
- **HTTP 客户端**: Axios
- **加密**: CryptoJS
- **Web3 库**: Ethers.js 6.16.0
- **数据处理**: XLSX

### 后端 (web3_service)
- **框架**: Flask 3.0.3
- **数据库**: MySQL 8.0
- **ORM**: SQLAlchemy 2.0.9
- **加密**: Cryptography 42.0.5
- **钱包库**:
  - EVM: hdwallet 2.2.1
  - Solana: solders 0.4.0, mnemonic 0.21
- **交易所**: CCXT 4.5.32
- **跨域**: Flask-CORS

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.12+
- MySQL 8.0+
- Docker & Docker Compose（可选，用于容器化部署）

### 后端服务启动

#### 方式一：Docker 部署（推荐）

```bash
cd web3_service

# 一键部署
chmod +x deploy.sh
./deploy.sh deploy

# 查看服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs
```

#### 方式二：本地开发

```bash
cd web3_service

# 安装依赖
pip install -r requirements.txt

# 配置环境变量（复制 .env.example 到 .env）
cp .env.example .env

# 启动服务
python app.py
```

服务将在 `http://localhost:3000` 启动（默认端口 3000，可在 .env 中修改）

### 前端应用启动

#### 方式一：Docker 部署

```bash
cd web3_manager

# 启动服务
docker-compose up -d --build

# 访问 http://localhost:5343
```

#### 方式二：本地开发

```bash
cd web3_manager

# 安装依赖
npm install

# 配置环境变量（复制 .env.development.example 到 .env.development）
cp .env.development.example .env.development

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

## 环境配置

### 后端环境变量 (web3_service/.env)

```env
# MySQL 数据库配置
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=1q2w3e4r5t
MYSQL_DATABASE=lumao

# Flask 应用配置
FLASK_HOST=0.0.0.0
FLASK_PORT=3000

# 日志级别
LOG_LEVEL=INFO
```

### 前端环境变量 (web3_manager/.env.development)

```env
# API 地址
VITE_APP_API_BASE_URL=http://localhost:3000

# 加密密钥（必须与后端一致）
VITE_APP_PWD_DECRYPT_KEY=jf324!@423fdQW
```

**重要**: `VITE_APP_PWD_DECRYPT_KEY` 必须与后端配置的 `PWD_DECRYPT_KEY` 完全一致，否则无法正确加解密数据。

## 核心功能说明

### 1. 钱包管理

#### 创建钱包
- 支持 EVM（以太坊）和 Solana 钱包批量创建
- 自动生成地址、私钥、助记词
- 使用 BIP44 标准生成密钥

#### 导入钱包
- 支持批量导入已有钱包
- 格式：`地址,私钥,助记词`
- 私钥和助记词在传输前会加密

#### 查询钱包
- 支持按地址、项目查询
- 返回加密后的私钥和助记词
- 前端需要使用 `PWD_DECRYPT_KEY` 解密

### 2. 钱包映射

- 管理源地址到目标地址的一对一映射
- 支持批量导入和查询
- 用于转账时的目标地址配置

### 3. 交易所管理

#### 支持的交易所
- Binance
- OKX
- Bitget
- Gate.io
- Bybit

#### 功能
- API Key 管理（加密存储）
- 查询账户余额
- 提现操作
- 查询提现手续费

### 4. 转账功能

- 多链转账
- 钱包分发
- 基于钱包映射关系自动获取目标地址

## 安全机制

### 1. 双层加密

私钥和助记词使用双层 AES 加密：

```
原始数据 → AES加密(密码) → AES加密(密码@tea) → 数据库存储
```

### 2. 传输加密

- 所有 `pwd` 参数在传输前必须使用 AES 加密
- 查询接口返回的私钥和助记词已加密
- 前端需要使用 `PWD_DECRYPT_KEY` 解密

### 3. 前端安全

- 强制要求使用无痕模式（隐私模式）
- 检测浏览器隐私模式状态
- 非隐私模式会显示安全提醒页

### 4. 数据库安全

- 敏感数据加密存储
- 使用强密码和访问控制
- 建议生产环境使用 HTTPS

## 数据库表结构

### wallet 表
```sql
CREATE TABLE wallet (
  id INT PRIMARY KEY AUTO_INCREMENT,
  `index` INT,
  address VARCHAR(255),
  public_key TEXT,
  private_key TEXT,        -- 加密存储
  phrase TEXT,             -- 加密存储
  project VARCHAR(255),
  remark TEXT
);
```

### wallet_mapping 表
```sql
CREATE TABLE wallet_mapping (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_address VARCHAR(255) UNIQUE,
  target_address VARCHAR(255),
  project VARCHAR(255),
  remark TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### exchange_info 表
```sql
CREATE TABLE exchange_info (
  id INT PRIMARY KEY AUTO_INCREMENT,
  platform VARCHAR(50),
  name VARCHAR(255) UNIQUE,
  apikey TEXT,             -- 加密存储
  secret TEXT,             -- 加密存储
  password TEXT,           -- 加密存储
  ip VARCHAR(50)
);
```

## API 接口

详细 API 文档请参考 `web3_service/API文档.md`

### 主要接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/wallet/projects` | GET | 获取项目列表 |
| `/wallet/list` | POST | 查询钱包列表 |
| `/wallet/create` | POST | 批量创建钱包 |
| `/wallet/insert` | POST | 批量导入钱包 |
| `/wallet/mapping/batch-import` | POST | 批量导入映射 |
| `/exchange/names` | GET | 获取交易所列表 |
| `/exchange/withdraw` | POST | 交易所提现 |
| `/exchange/balance` | POST | 查询余额 |

## 开发规范

### 前端开发

1. **组件结构**
   - 页面组件放在 `src/pages/` 目录
   - 公共组件放在 `src/components/` 目录
   - 每个组件包含 `.jsx` 和 `.css` 文件

2. **API 调用**
   - 所有 API 调用封装在 `src/api/` 目录
   - 使用统一的错误处理机制
   - 数据加解密使用 `src/utils/crypto.js`

3. **样式规范**
   - 使用 CSS Modules 或独立 CSS 文件
   - 遵循现有设计风格（深色主题）
   - 使用 Lucide React 图标库

4. **状态管理**
   - 使用 React Hooks（useState, useEffect）
   - 使用自定义事件进行组件间通信

### 后端开发

1. **代码结构**
   - 路由定义在 `app.py`
   - 业务逻辑在 `service_*.py`
   - 工具函数在 `utils_*.py`

2. **日志规范**
   - 使用 Python logging 模块
   - 统一日志格式：`[时间] [级别] 模块:行号 - 消息`
   - Windows 下使用 UTF-8 编码

3. **错误处理**
   - 使用 `response_invoke.py` 统一响应格式
   - 成功：`{"code": 20000, "data": {}, "msg": "ok"}`
   - 失败：`{"code": -1, "data": {}, "msg": "错误信息"}`

4. **数据库操作**
   - 使用 SQLAlchemy ORM
   - 工具函数封装在 `utils_db.py`

## 常见问题

### 1. 端口被占用

修改 `.env` 文件中的 `FLASK_PORT`（后端）或 `VITE_APP_API_BASE_URL`（前端）

### 2. 数据库连接失败

检查 `web3_service/.env` 中的 MySQL 配置是否正确

### 3. 加密解密失败

确保前端和后端的 `PWD_DECRYPT_KEY` 完全一致

### 4. Docker 权限问题

```bash
# Linux 下可能需要
sudo usermod -aG docker $USER
```

### 5. 查看容器日志

```bash
cd web3_service
docker compose logs -f web3_service
```

## 测试

### 前端测试

```bash
cd web3_manager
npm run lint    # 代码检查
npm run build   # 构建生产版本
npm run preview # 预览生产版本
```

### 后端测试

```bash
cd web3_service
# 使用 curl 测试 API
curl http://localhost:3000/wallet/projects
```

## 部署

### 生产环境部署

1. **后端部署**
   ```bash
   cd web3_service
   # 修改 .env 为生产环境配置
   docker-compose up -d --build
   ```

2. **前端部署**
   ```bash
   cd web3_manager
   npm run build
   # 将 dist 目录部署到 Nginx 或其他静态服务器
   ```

3. **Nginx 配置示例**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           root /path/to/web3_manager/dist;
           try_files $uri $uri/ /index.html;
       }
       
       location /api/ {
           proxy_pass http://localhost:3000/;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 重要提示

1. **密码管理**: 加密密码 `pwd` 丢失将无法解密私钥和助记词，请妥善保管
2. **数据备份**: 定期备份数据库
3. **安全配置**: 生产环境必须使用强密码和 HTTPS
4. **私钥保护**: 永远不要将私钥或助记词提交到版本控制系统
5. **密钥同步**: 前后端的 `PWD_DECRYPT_KEY` 必须保持一致

## 许可证

MIT