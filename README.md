# 钉钉物资借用归还管理系统

企业内部物资借用归还管理小程序，支持钉钉 H5 微应用。

## 功能特性

- ✅ 7个固定设备管理（状态：可用/已借出/损坏）
- ✅ 借用申请 → 任意一人审批 → 借用成功
- ✅ 归还申请 → 审批 → 设备状态更新
- ✅ 损坏设备禁止再次借出
- ✅ 设备图片上传
- ✅ 钉钉群机器人 Webhook 消息推送
- ✅ 借用/归还记录导出 CSV

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: 响应式 H5（适配钉钉/手机/电脑）
- **部署**: Railway（免费）

## 快速部署

### 1. 推送代码到 GitHub

在 `dingtalk-equipment` 目录执行：

```bash
git remote add origin git@github.com:kou147258/dingtalk-equipment.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

### 2. 部署到 Railway

1. 打开 [railway.app](https://railway.app)
2. 点击 "New Project" → "Deploy from GitHub"
3. 选择 `kou147258/dingtalk-equipment` 仓库
4. Railway 会自动部署，约 2-3 分钟
5. 部署完成后，复制分配的域名（如 `xxx.railway.app`）

### 3. 初始化数据库

访问：`https://xxx.railway.app/init.html`

或者在终端执行：
```bash
cd dingtalk-equipment
npm install
npm run init
```

### 4. 配置钉钉群机器人

1. 打开钉钉群 → 设置 → 智能群助手 → 添加机器人
2. 选择「自定义机器人」
3. 复制 Webhook 地址
4. 打开系统管理页面，粘贴 Webhook 地址并保存

## 初始数据

- **设备**: 7个（投影仪A、投影仪B、笔记本电脑、无线麦克风、便携显示屏、会议摄像头、移动音响）
- **审批人**: 张三、李四、王五（默认，任意一人审批即可）

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/goods` | GET | 获取设备列表 |
| `/api/borrow` | POST | 创建借用申请 |
| `/api/borrow/:id/approve` | POST | 审批通过 |
| `/api/borrow/:id/reject` | POST | 审批拒绝 |
| `/api/return` | POST | 申请归还 |
| `/api/return/:id/approve` | POST | 归还审批通过 |
| `/api/approvers` | GET/POST/DELETE | 审批人管理 |
| `/api/settings/webhook` | GET/POST | Webhook 配置 |
| `/api/export/borrow` | GET | 导出借用记录 |
| `/api/export/return` | GET | 导出归还记录 |

## 移动端适配

系统已针对手机/钉钉进行适配，支持：
- 移动端手势操作
- 图片上传
- 表单输入优化

## 注意事项

1. 设备损坏后需要管理员手动将状态改为「可用」才能重新借出
2. 审批人可在管理页面添加/删除
3. 借用记录和归还记录可导出为 CSV 格式