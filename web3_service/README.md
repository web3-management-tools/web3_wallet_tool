# Web3 Wallet Service

基于 Flask 的 Web3 钱包管理服务，支持 EVM 兼容链和 Solana 链。

## 技术栈

- **后端框架**: Flask
- **数据库**: MySQL 8.0
- **加密**: AES 加密算法
- **钱包库**: hdwallet (EVM), solders (Solana)
- **容器化**: Docker + Docker Compose

## 快速部署

### 方式一：Linux/macOS/WSL 一键部署

```bash
# 1. 进入项目目录
cd web3_service

# 2. 设置执行权限
chmod +x deploy.sh

# 3. 部署并启动服务
./deploy.sh deploy

# 4. 查看服务状态
./deploy.sh status
```

### 方式二：手动 Docker 部署

```bash
# 1. 构建并启动容器
docker compose up -d --build

# 2. 查看日志
docker compose logs -f web3_service

# 3. 查看服务状态
docker compose ps
```

## 部署脚本命令

```bash
./deploy.sh deploy              # 部署并启动服务
./deploy.sh start               # 启动服务
./deploy.sh stop                # 停止服务
./deploy.sh restart             # 重启服务
./deploy.sh logs                # 查看实时日志
./deploy.sh status              # 查看服务状态
./deploy.sh clean               # 清理并重新部署

# 清理旧镜像后部署
./deploy.sh deploy --clean
./deploy.sh clean --clean
```

## 服务地址

| 服务 | 地址 |
|------|------|
| Web3 Service | http://localhost:3000 |
| 健康检查 | http://localhost:3000/ |

## 环境变量配置

在 `.env` 文件中配置：

```env
# MySQL数据库配置
MYSQL_ROOT_PASSWORD=1q2w3e4r5t
MYSQL_DATABASE=lumao
MYSQL_PORT=3306

# Flask应用配置
FLASK_HOST=0.0.0.0
FLASK_PORT=3000

# 日志级别 (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO
```

## API 接口

详见 [API文档.md](API文档.md)

## 数据持久化

- **MySQL 数据**: 存储在 Docker 卷 `mysql_data` 中
- **钱包数据**: 存储在 `./mysql_data` 目录

## 常见问题

### 1. 端口被占用

修改 `.env` 中的 `FLASK_PORT` 或 `MYSQL_PORT`。

### 2. Docker 权限问题

```bash
# Linux 下可能需要
sudo usermod -aG docker $USER
```

### 3. 查看容器日志

```bash
# 查看所有日志
docker compose logs

# 只看 web3_service 日志
docker compose logs web3_service

# 实时查看
docker compose logs -f web3_service
```

### 4. 重置数据库

```bash
# 停止服务并删除数据卷
docker compose down -v

# 重新部署
./deploy.sh deploy --clean
```

## 开发模式运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py
```

## License

MIT
