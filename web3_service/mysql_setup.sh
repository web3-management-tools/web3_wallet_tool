#!/bin/bash
# MySQL 配置脚本

echo "配置 MySQL 远程访问..."

# 修改 MySQL 配置文件
sudo sed -i 's/bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf

# 重启 MySQL
sudo systemctl restart mysql
sleep 5

# 创建远程访问用户和数据库
sudo mysql -e "CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'Root@123456';"
sudo mysql -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;"
sudo mysql -e "FLUSH PRIVILEGES;"
sudo mysql -e "CREATE DATABASE IF NOT EXISTS lumao;"

echo "MySQL 配置完成！"
echo "远程访问用户: root"
echo "密码: Root@123456"
echo "数据库: lumao"
echo "端口: 3306"