# My Start Page

一个可自定义的 Chrome 新标签页插件：按分类管理你的常用网址，支持拖拽调整网址和分类的顺序。

## 功能

- 覆盖浏览器新标签页，作为自定义主页
- 自由创建/重命名/删除分类
- 每个分类下添加/编辑/删除网址（自动抓取网站 favicon）
- 拖拽排序：
  - 网址可在同一分类内调整顺序，也可拖到其他分类
  - 分类本身可以拖拽调整左右顺序
- 顶部搜索框：输入网址直接跳转，否则走 Google 搜索
- 一键导出/导入数据（JSON 备份），数据保存在浏览器本地（`chrome.storage.local`）

## 安装（开发者模式加载）

1. 打开 Chrome，访问 `chrome://extensions`
2. 右上角打开「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目目录
4. 打开一个新标签页即可看到自定义主页

## 目录结构

```
manifest.json      # 插件配置（Manifest V3，newtab override）
newtab.html        # 新标签页面
css/style.css      # 样式
js/storage.js      # chrome.storage 封装
js/main.js         # 渲染、拖拽、增删改逻辑
icons/             # 插件图标
```

## 路线图

- [ ] 发布到 Chrome Web Store
- [ ] 云端同步（跨设备）
- [ ] 主题/壁纸自定义
- [ ] 后续考虑增加「持续更新/高级功能」的订阅续费模式

## License

MIT
