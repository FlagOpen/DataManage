# RoboCOIN DataManager 开发文档

本文档面向开发者，介绍项目的各个组成部分以及如何配置和修改项目。

## 📁 项目结构

### 根目录结构

```
docs/
├── css/                    # 样式文件
│   ├── core/              # 核心样式（基础、布局、变量等）
│   ├── components/        # 组件样式（模态框、提示等）
│   ├── filter/            # 过滤器相关样式
│   ├── selection/         # 选择面板样式
│   ├── video/             # 视频卡片样式
│   ├── responsive/        # 响应式样式
│   └── animations/        # 动画效果
├── js/                     # JavaScript 源代码
│   ├── modules/           # 功能模块
│   ├── app.js            # 应用主入口
│   ├── main.js           # 初始化入口
│   ├── templates.js      # 模板定义
│   └── types.js          # 类型定义
├── index.html             # 主页面
└── favicon.ico           # 网站图标
```

### 核心模块说明

#### 1. **配置管理模块** (`js/modules/config.js`)
- **作用**：集中管理应用的所有配置项
- **功能**：
  - 从 CSS 变量读取配置值
  - 管理资源路径（assets root）
  - 生成下载命令
  - 处理文件大小格式化
- **关键方法**：
  - `getConfig()`: 获取完整配置对象
  - `getAssetsRoot()`: 获取资源根路径
  - `generateDownloadCommand()`: 生成下载命令

#### 2. **数据管理模块** (`js/modules/data-manager.js`)
- **作用**：负责数据集的加载和管理
- **功能**：
  - 从远程加载数据集索引文件
  - 构建数据集索引映射
  - 管理数据集元数据

#### 3. **过滤器模块** (`js/modules/@filter/`)
- **作用**：实现数据集筛选功能
- **组成**：
  - `filter-manager.js`: 过滤器管理器
  - `filter-renderer.js`: 过滤器 UI 渲染
  - `filter-state.js`: 过滤器状态管理
  - `filter-hierarchy.js`: 过滤器层级结构
  - `filter-search.js`: 过滤器搜索功能
  - `data.js`: 过滤器数据定义

#### 4. **视频网格模块** (`js/modules/video-grid.js`)
- **作用**：管理视频卡片的显示和虚拟滚动
- **功能**：
  - 渲染视频卡片网格
  - 实现虚拟滚动优化性能
  - 处理视频卡片交互

#### 5. **选择面板模块** (`js/modules/selection-panel.js`)
- **作用**：管理批量下载选择功能
- **功能**：
  - 显示已选择的数据集列表
  - 生成下载命令
  - 支持导入/导出 JSON

#### 6. **下载管理模块** (`js/modules/download-manager.js`)
- **作用**：处理下载命令的生成和复制
- **功能**：
  - 支持 HuggingFace 和 ModelScope 两个平台
  - 生成格式化的下载命令
  - 复制命令到剪贴板

#### 7. **事件处理模块** (`js/modules/event-handlers.js`)
- **作用**：统一管理所有 DOM 事件绑定
- **功能**：
  - 绑定按钮点击事件
  - 处理搜索输入
  - 管理选择状态变化

#### 8. **UI 工具模块** (`js/modules/ui-utils.js`)
- **作用**：提供 UI 相关的工具函数
- **功能**：
  - 更新统计计数
  - 显示/隐藏 UI 元素
  - 工具函数集合

#### 9. **虚拟滚动模块** (`js/modules/virtual-scroll.js`)
- **作用**：实现高性能的虚拟滚动
- **功能**：
  - 只渲染可见区域的元素
  - 优化大量数据时的性能

#### 10. **其他工具模块**
- `dom-utils.js`: DOM 操作工具函数
- `error-notifier.js`: 错误通知管理
- `toast-manager.js`: 提示消息管理
- `robot-aliases.js`: 机器人别名映射

## 🔧 如何更换 Assets 依赖仓库

### 方法一：修改默认配置（推荐用于开发环境）

在 `js/modules/config.js` 文件的第 127-133 行，找到 `getDefaultRemoteAssetsRoot()` 方法：

```javascript
/**
 * Default Hugging Face dataset location for assets.
 * @returns {string}
 */
static getDefaultRemoteAssetsRoot() {
    return 'https://huggingface.co/datasets/RogersPyke/RoboCOIN-DataManager-assets/resolve/main';
}
```

**修改步骤**：
1. 打开 `docs/js/modules/config.js` 文件
2. 找到第 132 行的 `return` 语句
3. 将 URL 替换为你自己的 Hugging Face 数据集仓库地址
4. 确保 URL 格式为：`https://huggingface.co/datasets/用户名/仓库名/resolve/main`

**示例**：
```javascript
static getDefaultRemoteAssetsRoot() {
    return 'https://huggingface.co/datasets/YourUsername/YourRepoName/resolve/main';
}
```

### 方法二：通过 URL 参数覆盖（推荐用于测试）

在浏览器地址栏中添加 `assetsRoot` 或 `assets` 参数：

```
https://your-domain.com/?assetsRoot=https://huggingface.co/datasets/YourUsername/YourRepoName/resolve/main
```

或使用简短的 `assets` 参数：

```
https://your-domain.com/?assets=https://huggingface.co/datasets/YourUsername/YourRepoName/resolve/main
```

**注意**：URL 参数只接受 `http://` 或 `https://` 开头的绝对 URL。

### 方法三：通过全局变量覆盖（用于调试）

在浏览器控制台中设置：

```javascript
window.ROBOCOIN_ASSETS_ROOT = 'https://huggingface.co/datasets/YourUsername/YourRepoName/resolve/main';
```

或者：

```javascript
window.__ASSETS_ROOT__ = 'https://huggingface.co/datasets/YourUsername/YourRepoName/resolve/main';
```

然后刷新页面。

### Assets 仓库结构要求

无论使用哪种方法，你的 Assets 仓库必须遵循以下目录结构：

```
your-repo/
├── info/                    # JSON 索引文件
│   ├── data_index.json
│   └── consolidated_datasets.json
├── dataset_info/            # YAML 元数据文件
│   ├── dataset1.yml
│   └── dataset2.yml
├── thumbnails/              # 缩略图（可选）
│   └── *.jpg
└── videos/                  # 视频文件（可选）
    └── *.mp4
```

### 优先级说明

配置的优先级从高到低为：
1. URL 参数 (`?assetsRoot=` 或 `?assets=`)
2. 全局变量 (`window.ROBOCOIN_ASSETS_ROOT` 或 `window.__ASSETS_ROOT__`)
3. 默认配置 (`getDefaultRemoteAssetsRoot()`)

## 🛠️ 开发建议

### 本地开发

1. 使用本地服务器运行项目（避免 CORS 问题）
2. 可以通过 URL 参数快速切换不同的 assets 仓库进行测试
3. 使用浏览器开发者工具监控网络请求

### 调试技巧

- 打开浏览器控制台查看配置信息：`ConfigManager.getConfig()`
- 查看当前 assets root：`ConfigManager.getAssetsRoot()`
- 检查数据集加载状态：`dataManager.getAllDatasets()`

### 性能优化

- 项目使用虚拟滚动处理大量数据集
- 过滤器使用静态计数优化性能
- 视频加载采用懒加载策略

## 📝 注意事项

1. **URL 格式**：所有 assets root URL 必须是以 `http://` 或 `https://` 开头的绝对 URL
2. **路径规范化**：系统会自动去除 URL 末尾的斜杠
3. **网络连接**：由于资源托管在 Hugging Face，网络连接可能影响加载速度
4. **缓存控制**：HTML 中已设置无缓存策略，开发时注意浏览器缓存

## 🔗 相关文件

- 配置文件：`docs/js/modules/config.js`
- 主应用：`docs/js/app.js`
- 数据管理：`docs/js/modules/data-manager.js`
- 主页面：`docs/index.html`

