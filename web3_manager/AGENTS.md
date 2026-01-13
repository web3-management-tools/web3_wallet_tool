# AGENTS.md - Web3 Manager 项目指南

本文档为AI编程助手提供在此Web3钱包管理前端项目中的工作指南。

## 项目概述

React 19 + Vite 前端应用，用于管理Web3钱包（EVM和Solana）。使用CryptoJS进行AES加密，Axios进行API调用。

## 构建命令

```bash
# 开发服务器 (http://localhost:5173)
npm run dev

# 生产构建 (输出到 dist/)
npm run build

# 本地预览生产构建
npm run preview

# 检查所有文件
npm run lint

# 检查特定文件或目录
npx eslint src/api/wallet.js
npx eslint src/pages/WalletList/
```

## 代码风格规范

### 导入顺序
```jsx
// 按类别分组导入（各组之间空一行）：
// 1. React核心
// 2. 第三方库
// 3. 内部组件/工具/API

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { decryptPrivateKey, decryptPhrase } from '../../utils/crypto';
import { walletList, getWalletProjects } from '../../api/wallet';
import PasswordInput from '../../components/PasswordInput';

// 页面使用默认导出，组件使用默认导入
export default function WalletList() { ... }
import PasswordInput from '../../components/PasswordInput';
```

### 命名规范
- **组件**: PascalCase（`WalletList`、`PasswordInput`）
- **文件**: JS用camelCase，JSX用PascalCase（`walletList.js`、`WalletList.jsx`）
- **变量/函数**: camelCase（`walletList`、`decryptPrivateKey`）
- **常量**: UPPER_SNAKE_CASE 或 config用camelCase
- **CSS类名**: kebab-case（`.wallet-table`、`.form-row`）

### 文件结构
```
src/
├── api/              # API模块 (index.js, wallet.js, errorHandler.js)
├── components/       # 可复用组件 (PascalCase文件夹 + index.jsx + index.css)
├── pages/            # 页面组件 (PascalCase文件夹 + index.jsx + index.css)
├── utils/            # 工具函数 (camelCase.js)
├── App.jsx           # 根组件
└── index.css         # 全局样式
```

### React模式
- 使用函数式组件和hooks
- 解构props：`function Component({ prop1, prop2 })`
- 工具函数使用命名导出，组件使用默认导出
- 避免使用`any`类型
- 异步操作要有loading/error状态处理

### 错误处理
- 异步操作包装在try/catch块中
- 使用`src/api/errorHandler.js`中的`handleApiError`
- 通过`setMessage`状态显示用户友好的错误信息
- 永远不要留空catch块

### CSS样式
- 使用BEM-like命名：`.block__element--modifier`
- 样式放在组件文件夹内（`.wallet-table-container`）
- 全局样式放在`index.css`
- 推荐使用Flexbox布局

### 加密/安全
- **绝对不能**日志输出密码、私钥或助记词
- 使用`utils/crypto.js`中的`encryptPwd`、`encryptPrivateKey`、`encryptPhrase`
- 所有pwd参数通过axios拦截器自动加密
- 使用`import.meta.env.VITE_*`访问环境变量

### API集成
- 使用`src/api/index.js`中的`apiClient`（自动处理pwd加密）
- API函数返回格式：`{ success, data, msg }`
- 使用数据前先检查`success`标志
- 使用`handleApiError`保持错误处理一致

## 关键文件说明

| 文件 | 用途 |
|------|------|
| `src/utils/crypto.js` | AES加密/解密（pwd、私钥、助记词） |
| `src/api/index.js` | Axios实例，带pwd加密拦截器 |
| `src/api/wallet.js` | 所有钱包/映射API函数 |
| `src/pages/WalletList/index.jsx` | 主钱包查询页面，支持展开查看私钥 |

## 环境变量

| 变量 | 用途 |
|------|------|
| `VITE_APP_API_BASE_URL` | 后端API基础URL |
| `VITE_APP_PWD_DECRYPT_KEY` | AES加密密钥（必须与后端一致） |

## 常见任务

**添加新API端点**：在`src/api/wallet.js`添加函数，使用`apiClient.get/post`

**添加新页面**：在`src/pages/`创建文件夹，添加到`App.jsx`导航

**添加可复用组件**：在`src/components/`创建文件夹，从`index.jsx`导出

## ESLint规则

- `no-unused-vars`：未使用变量报错，但匹配`^[A-Z_]`的变量除外
- 启用React Hooks规则
- 启用React Refresh规则
