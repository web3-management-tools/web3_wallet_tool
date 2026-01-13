# Docker 一键部署指南

本指南介绍如何使用 Docker Compose 同时启动前后端两个项目。

## 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- MySQL 8.0+（可以本地运行，也可以使用 Docker）

## 快速启动

### 1. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env

# 根据实际情况修改 .env 文件中的配置
# 主要是 MySQL 连接信息和端口配置
```

### 2. 启动服务

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 访问服务

启动成功后，可以通过以下地址访问：

- **前端管理界面**: http://localhost:5343
- **后端 API 服务**: http://localhost:3000
- **健康检查**: http://localhost:3000/

## 服务说明

### web3_service（后端服务）

- **端口**: 3000（可通过 `FLASK_PORT` 修改）
- **功能**: 提供 RESTful API 接口，处理钱包管理、交易所操作等业务逻辑
- **健康检查**: 自动检查服务是否正常运行

### web3_manager（前端服务）

- **端口**: 5343（可通过 `MANAGER_PORT` 修改）
- **功能**: 提供 Web 管理界面，用户通过浏览器访问
- **依赖**: 等待后端服务健康检查通过后才启动

### 网络

两个服务运行在同一个 Docker 网络 `web3_network` 中，可以通过服务名称相互访问。

## 常用命令

### 查看服务状态

```bash
docker-compose ps
```

### 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f web3_service

# 只查看前端日志
docker-compose logs -f web3_manager
```

### 重启服务

```bash
# 重启所有服务
docker-compose restart

# 重启指定服务
docker-compose restart web3_service
```

### 停止服务

```bash
# 停止所有服务
docker-compose stop

# 停止指定服务
docker-compose stop web3_manager
```

### 删除服务

```bash
# 停止并删除所有服务容器
docker-compose down

# 停止并删除所有服务容器和数据卷（慎用）
docker-compose down -v
```

### 重新构建

```bash
# 重新构建并启动
docker-compose up -d --build

# 只重新构建指定服务
docker-compose build web3_service
docker-compose up -d web3_service
```

### 进入容器

```bash
# 进入后端容器
docker-compose exec web3_service bash

# 进入前端容器
docker-compose exec web3_manager sh
```

## 数据持久化

后端服务的 MySQL 数据存储在 `./web3_service/mysql_data` 目录中，该目录已挂载到容器内，确保数据不会因容器重启而丢失。

## 故障排查

### 1. 端口被占用

如果端口 3000 或 5343 被占用，修改 `.env` 文件中的端口配置：

```env
FLASK_PORT=3001
MANAGER_PORT=5344
```

### 2. 数据库连接失败

检查 `.env` 文件中的 MySQL 配置是否正确，确保 MySQL 服务正在运行。

### 3. 前端无法访问后端

检查后端服务是否正常启动：

```bash
docker-compose logs web3_service
```

### 4. 查看容器详细信息

```bash
docker-compose ps
docker inspect web3_service
docker inspect web3_manager
```

## 生产环境部署建议

1. **使用反向代理**: 使用 Nginx 或 Traefik 作为反向代理，配置 SSL 证书
2. **环境变量安全**: 不要将敏感信息提交到版本控制，使用 Docker Secrets 或环境变量文件
3. **资源限制**: 在 docker-compose.yml 中添加资源限制
4. **日志管理**: 配置日志驱动和日志轮转
5. **监控告警**: 集成 Prometheus + Grafana 进行监控

## 示例配置

### 添加资源限制

```yaml
services:
  web3_service:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  web3_manager:
    # ... 其他配置
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
```

### 添加日志配置

```yaml
services:
  web3_service:
    # ... 其他配置
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## 注意事项

1. 首次启动需要构建镜像，可能需要较长时间
2. 确保 MySQL 服务在启动后端服务前已经运行
3. 前端服务会等待后端服务健康检查通过后才启动
4. 修改代码后需要重新构建镜像：`docker-compose up -d --build`
5. 生产环境建议使用正式的 MySQL 容器或外部 MySQL 服务