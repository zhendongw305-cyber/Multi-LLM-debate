#!/bin/bash
# Check if mysql-vigrodong is running
if ! docker ps --filter "name=mysql-vigrodong" --format '{{.Names}}' | grep -q "mysql-vigrodong"; then
    echo "❌ 错误: 容器 'mysql-vigrodong' 没有在运行。"
    echo "正在尝试启动容器..."
    docker start mysql-vigrodong
else
    echo "✅ 容器 'mysql-vigrodong' 正在运行。"
fi

# Check port mapping
MAPPED_PORT=$(docker inspect mysql-vigrodong --format='{{(index (index .NetworkSettings.Ports "3306/tcp") 0).HostPort}}' 2>/dev/null)
if [ "$MAPPED_PORT" == "3306" ]; then
    echo "✅ 端口映射正确: 3306 -> 3306"
else
    echo "❌ 警告: 发现端口映射不匹配或未映射。当前映射端口为: ${MAPPED_PORT:-"无"}"
fi
