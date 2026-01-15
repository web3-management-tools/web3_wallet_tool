# Web3 钱包管理工具

一个完整的 Web3 钱包管理系统，包含前端和后端两个子项目，支持 EVM 兼容链（以太坊等）和 Solana 链的钱包管理、交易所集成、转账分发等功能。

## 项目概述

- **web3_manager**: 基于 React + Vite 的前端管理系统，提供钱包创建、导入、转账、交易所管理、余额查询等可视化界面
- **web3_service**: 基于 Flask 的后端服务，提供 RESTful API 接口，支持 EVM 兼容链和 Solana 链的钱包管理

### 核心功能

- **钱包管理**: 批量创建/导入 EVM 和 Solana 钱包，查询钱包信息
- **钱包映射**: 管理源地址到目标地址的映射关系
- **交易所集成**: 支持 Binance、OKX、Bitget、Gate.io、Bybit 等主流交易所的 API 管理和提现操作
- **转账功能**: 多链转账和钱包分发
- **余额查询**: 批量查询钱包余额，支持原生币和 ERC20 代币
- **安全保障**: 
  - 私钥和助记词双层 AES 加密存储
  - 前端强制要求使用无痕模式（隐私模式）
  - 传输层数据加密

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.12+
- MySQL 8.0+
- Docker & Docker Compose（可选，用于容器化部署）

### 方式一：Docker 部署（推荐）

#### 1. 启动后端服务

```bash
cd web3_service

# 配置环境变量（复制 .env.example 到 .env）
cp .env.example .env

# 编辑 .env 文件，配置数据库连接等信息
notepad .env  # Windows
# 或
vim .env      # Linux/Mac

# 一键部署
./deploy.sh deploy  # Linux/Mac
# 或
deploy.sh deploy    # Windows

# 查看服务状态
./deploy.sh status

# 查看日志
./deploy.sh logs
```

#### 2. 启动前端应用

```bash
cd web3_manager

# 配置环境变量（复制 .env.development.example 到 .env.development）
cp .env.development.example .env.development

# 编辑 .env.development 文件，配置 API 地址和加密密钥
notepad .env.development  # Windows

# 启动服务
docker-compose up -d --build

# 访问 http://localhost:5343
```

### 方式二：本地开发

#### 1. 启动后端服务

```bash
cd web3_service

# 创建虚拟环境（可选但推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息

# 初始化数据库（首次运行）
mysql -u root -p < sql.sql

# 启动服务
python app.py
```

服务将在 `http://localhost:3000` 启动（默认端口 3000，可在 .env 中修改）

#### 2. 启动前端应用

```bash
cd web3_manager

# 安装依赖
npm install

# 配置环境变量
cp .env.development.example .env.development
# 编辑 .env.development 文件，配置 API 地址和加密密钥

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

## 环境配置

### 后端环境变量 (web3_service/.env)

创建 `web3_service/.env` 文件，配置以下内容：

```env
# MySQL 数据库配置
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=lumao

# Flask 应用配置
FLASK_HOST=0.0.0.0
FLASK_PORT=3000

# 加密密码（用于加密私钥和助记词）
PWD_DECRYPT_KEY=jf324!@423fdQW

# 日志级别
LOG_LEVEL=INFO
```

**重要配置说明：**

- `MYSQL_PASSWORD`: 请修改为你的 MySQL 实际密码
- `PWD_DECRYPT_KEY`: 加密密钥，用于加解密私钥和助记词，**请妥善保管**，丢失将无法恢复私钥
- `FLASK_PORT`: 后端服务端口，默认 3000，可根据需要修改

### 前端环境变量 (web3_manager/.env.development)

创建 `web3_manager/.env.development` 文件，配置以下内容：

```env
# API 地址（指向后端服务）
VITE_APP_API_BASE_URL=http://localhost:3000

# 加密密钥（必须与后端 PWD_DECRYPT_KEY 完全一致）
VITE_APP_PWD_DECRYPT_KEY=jf324!@423fdQW
```

**重要配置说明：**

- `VITE_APP_API_BASE_URL`: 后端 API 地址，确保与后端服务的地址和端口一致
- `VITE_APP_PWD_DECRYPT_KEY`: 必须与后端的 `PWD_DECRYPT_KEY` 完全一致，否则无法正确加解密数据

### 数据库初始化

首次运行需要初始化数据库：

```bash
# 方式一：使用 MySQL 命令行
mysql -u root -p < web3_service/sql.sql

# 方式二：登录 MySQL 后执行
mysql -u root -p
use lumao;
source web3_service/sql.sql;
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
  - Solana: solders 0.23.0, mnemonic 0.21
- **交易所**: CCXT 4.5.32
- **跨域**: Flask-CORS

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

## 常见问题

### 1. 端口被占用

修改 `.env` 文件中的 `FLASK_PORT`（后端）或 `VITE_APP_API_BASE_URL`（前端）

### 2. 数据库连接失败

检查 `web3_service/.env` 中的 MySQL 配置是否正确，确保 MySQL 服务已启动

### 3. 加密解密失败

确保前端和后端的 `PWD_DECRYPT_KEY` 完全一致

### 4. Docker 权限问题（Linux）

```bash
sudo usermod -aG docker $USER
# 重新登录后生效
```

### 5. 查看容器日志

```bash
cd web3_service
docker compose logs -f web3_service
```

## 重要提示

1. **密码管理**: 加密密码 `PWD_DECRYPT_KEY` 丢失将无法解密私钥和助记词，请妥善保管
2. **数据备份**: 定期备份数据库
3. **安全配置**: 生产环境必须使用强密码和 HTTPS
4. **私钥保护**: 永远不要将私钥或助记词提交到版本控制系统
5. **密钥同步**: 前后端的 `PWD_DECRYPT_KEY` 必须保持一致

## 许可证

MIT
