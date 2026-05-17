# 德信 (DeChat)

实时 Web 聊天室，支持 Markdown、LaTeX、图片和 GIF 表情包。

## 功能

- 用户注册与登录（Session 会话管理）
- 实时消息推送（Socket.IO）
- Markdown 渲染（marked）
- LaTeX 公式渲染（KaTeX，支持 `$...$` 行内和 `$$...$$` 块级）
- 图片上传与 GIF 表情包
- 简洁现代的界面

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express |
| 数据库 | SQLite (sql.js) |
| 实时通信 | Socket.IO |
| 前端 | 原生 HTML/CSS/JS |
| Markdown | marked |
| LaTeX | KaTeX |

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式（热重载）
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
DeChat/
├── server/           # 后端
│   ├── index.js      # 入口
│   ├── db.js         # 数据库
│   └── routes/       # 路由
├── public/           # 前端
│   ├── index.html    # 页面
│   ├── css/          # 样式
│   └── js/           # 脚本
└── uploads/          # 上传文件
```

## 许可证

MIT
