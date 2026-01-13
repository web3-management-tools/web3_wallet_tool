#!/bin/bash

# Web3 Wallet Service 一键部署脚本
# 支持 Linux/macOS/Windows (WSL)

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_NAME="web3_service"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# 打印彩色日志
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 打印横幅
print_banner() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Web3 Wallet Service 一键部署脚本                ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# 检查Docker是否安装
check_docker() {
    log_info "检查 Docker 环境..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        echo "   Ubuntu/Debian: sudo apt-get install docker.io docker-compose"
        echo "   CentOS/RHEL: sudo yum install docker docker-compose"
        echo "   MacOS/Windows: https://www.docker.com/products/docker-desktop"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi

    # 检查Docker服务状态
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker 服务"
        exit 1
    fi

    log_success "Docker 环境检查通过"
}

# 检查必要的文件
check_files() {
    log_info "检查必要的文件..."

    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "找不到 $COMPOSE_FILE 文件"
        exit 1
    fi

    if [ ! -f "Dockerfile" ]; then
        log_error "找不到 Dockerfile 文件"
        exit 1
    fi

    if [ ! -f "requirements.txt" ]; then
        log_error "找不到 requirements.txt 文件"
        exit 1
    fi

    log_success "必要文件检查通过"
}

# 配置环境变量
setup_env() {
    log_info "配置环境变量..."

    if [ ! -f "$ENV_FILE" ]; then
        log_warning "未找到 .env 文件，正在创建默认配置..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "已从 .env.example 创建 .env 文件"
        else
            log_error "无法创建 .env 文件"
            exit 1
        fi
    else
        log_success "使用现有的 .env 文件"
    fi
}

# 停止已有容器
stop_containers() {
    log_info "停止已有容器..."

    if docker compose -f "$COMPOSE_FILE" down &> /dev/null || docker-compose -f "$COMPOSE_FILE" down &> /dev/null; then
        log_success "已停止已有容器"
    else
        log_info "没有运行中的容器或停止失败（这可能是正常的）"
    fi
}

# 清理旧镜像（可选）
cleanup_images() {
    if [ "$1" == "--clean" ]; then
        log_warning "清理旧的 Web3 Service 镜像..."
        docker rmi web3_service-web3_service 2>/dev/null || true
        docker rmi web3_service 2>/dev/null || true
        log_success "镜像清理完成"
    fi
}

# 构建并启动容器
start_containers() {
    log_info "构建并启动容器..."

    # 使用 docker compose 或 docker-compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # 构建镜像
    log_info "构建 Docker 镜像..."
    if ! $COMPOSE_CMD -f "$COMPOSE_FILE" build --no-cache; then
        log_error "镜像构建失败"
        exit 1
    fi
    log_success "镜像构建完成"

    # 启动容器
    log_info "启动容器..."
    if ! $COMPOSE_CMD -f "$COMPOSE_FILE" up -d; then
        log_error "容器启动失败"
        exit 1
    fi
    log_success "容器启动完成"
}

# 等待服务就绪
wait_for_services() {
    log_info "等待服务就绪..."

    MAX_WAIT=60
    WAIT_COUNT=0

    # 等待 MySQL 就绪
    log_info "等待 MySQL 服务就绪..."
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        if docker exec web3_mysql mysqladmin ping -h localhost -u root -p"${MYSQL_ROOT_PASSWORD:-1q2w3e4r5t}" &> /dev/null; then
            log_success "MySQL 服务已就绪"
            break
        fi
        sleep 2
        WAIT_COUNT=$((WAIT_COUNT + 2))
        echo -n "."
    done
    echo ""

    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log_warning "MySQL 服务启动超时，请检查日志"
    fi

    # 等待 Flask 服务就绪
    log_info "等待 Flask 服务就绪..."
    WAIT_COUNT=0
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        if curl -s http://localhost:${FLASK_PORT:-3000}/ &> /dev/null; then
            log_success "Flask 服务已就绪"
            break
        fi
        sleep 2
        WAIT_COUNT=$((WAIT_COUNT + 2))
        echo -n "."
    done
    echo ""

    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log_warning "Flask 服务启动超时，请检查日志"
    fi
}

# 查看服务状态
show_status() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    服务状态                               ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # 使用 docker compose 或 docker-compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    $COMPOSE_CMD -f "$COMPOSE_FILE" ps

    echo ""
    echo -e "${BLUE}服务地址:${NC}"
    echo "   Web3 Service: http://localhost:${FLASK_PORT:-3000}"
    echo "   健康检查: http://localhost:${FLASK_PORT:-3000}/"

    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo "   查看日志: docker compose logs -f web3_service"
    echo "   停止服务: docker compose down"
    echo "   重启服务: docker compose restart web3_service"
    echo ""
}

# 查看日志
show_logs() {
    echo -e "${BLUE}正在查看日志 (按 Ctrl+C 退出)...${NC}"

    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    $COMPOSE_CMD -f "$COMPOSE_FILE" logs -f
}

# 停止服务
stop_service() {
    log_info "停止服务..."

    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    $COMPOSE_CMD -f "$COMPOSE_FILE" down
    log_success "服务已停止"
}

# 帮助信息
show_help() {
    echo "用法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "   deploy     部署并启动服务（默认）"
    echo "   start      启动服务"
    echo "   stop       停止服务"
    echo "   restart    重启服务"
    echo "   logs       查看日志"
    echo "   status     查看服务状态"
    echo "   clean      清理并重新部署"
    echo ""
    echo "选项:"
    echo "   --clean    清理旧镜像（与 deploy 或 clean 命令配合使用）"
    echo "   --help     显示帮助信息"
    echo ""
    echo "示例:"
    echo "   $0 deploy              # 部署并启动服务"
    echo "   $0 deploy --clean      # 清理旧镜像后部署"
    echo "   $0 logs                # 查看实时日志"
    echo "   $0 clean --clean       # 清理并重新部署"
}

# 主函数
main() {
    print_banner

    COMMAND="deploy"
    CLEAN_FLAG=false

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            deploy|start|stop|restart|logs|status|clean)
                COMMAND="$1"
                shift
                ;;
            --clean)
                CLEAN_FLAG=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 执行命令
    case $COMMAND in
        deploy)
            check_docker
            check_files
            setup_env
            stop_containers
            cleanup_images $CLEAN_FLAG
            start_containers
            wait_for_services
            show_status
            ;;
        start)
            check_docker
            if docker compose version &> /dev/null; then
                COMPOSE_CMD="docker compose"
            else
                COMPOSE_CMD="docker-compose"
            fi
            $COMPOSE_CMD -f "$COMPOSE_FILE" up -d
            show_status
            ;;
        stop)
            stop_service
            ;;
        restart)
            if docker compose version &> /dev/null; then
                COMPOSE_CMD="docker compose"
            else
                COMPOSE_CMD="docker-compose"
            fi
            $COMPOSE_CMD -f "$COMPOSE_FILE" restart
            show_status
            ;;
        logs)
            show_logs
            ;;
        status)
            check_docker
            show_status
            ;;
        clean)
            check_docker
            stop_containers
            cleanup_images true
            log_success "清理完成"
            ;;
    esac
}

# 运行主函数
main "$@"
