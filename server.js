const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// File upload config
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// JSON file database
const DB_FILE = path.join(__dirname, 'db.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { goods: [], borrow_records: [], return_records: [], approvers: [], settings: {} };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize default data
function initDB() {
  const db = loadDB();
  let changed = false;
  
  if (db.goods.length === 0) {
    db.goods = [
      { id: uuidv4(), name: '投影仪 A', code: 'PJ-001', status: '可用', remark: '会议室投影仪，支持HDMI/VGA', image: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '投影仪 B', code: 'PJ-002', status: '可用', remark: '会议室投影仪，支持HDMI/VGA', image: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '笔记本电脑', code: 'LB-001', status: '可用', remark: 'ThinkPad T480，适合办公演示', image: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '无线麦克风', code: 'MC-001', status: '可用', remark: '会议室无线麦克风套装', image: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '便携显示屏', code: 'MN-001', status: '可用', remark: '15.6寸便携屏幕，支持一线连接', image: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '会议摄像头', code: 'CM-001', status: '可用', remark: '4K高清摄像头，适合视频会议', image: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '移动音响', code: 'SP-001', status: '可用', remark: '便携式蓝牙音响，适合小型会议', image: '', created_at: new Date().toISOString() }
    ];
    changed = true;
  }
  
  if (db.approvers.length === 0) {
    db.approvers = [
      { id: uuidv4(), name: '张三', dingtalk_id: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '李四', dingtalk_id: '', created_at: new Date().toISOString() },
      { id: uuidv4(), name: '王五', dingtalk_id: '', created_at: new Date().toISOString() }
    ];
    changed = true;
  }
  
  if (changed) saveDB(db);
  return db;
}

// ============ GOODS API ============

app.get('/api/goods', (req, res) => {
  try {
    const db = loadDB();
    res.json({ success: true, data: db.goods });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/goods/:id', (req, res) => {
  try {
    const db = loadDB();
    const good = db.goods.find(g => g.id === req.params.id);
    if (!good) return res.status(404).json({ success: false, message: '设备不存在' });
    res.json({ success: true, data: good });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/goods', (req, res) => {
  try {
    const db = loadDB();
    const { name, code, status = '可用', image, remark } = req.body;
    const good = { id: uuidv4(), name, code, status, image: image || '', remark: remark || '', created_at: new Date().toISOString() };
    db.goods.push(good);
    saveDB(db);
    res.json({ success: true, data: good });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/goods/:id', (req, res) => {
  try {
    const db = loadDB();
    const idx = db.goods.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: '设备不存在' });
    Object.assign(db.goods[idx], req.body, { id: req.params.id });
    saveDB(db);
    res.json({ success: true, data: db.goods[idx] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ BORROW API ============

app.post('/api/borrow', (req, res) => {
  try {
    const db = loadDB();
    const { goods_id, borrower_name, borrower_phone, borrower_unit, expect_return_time, remark, image, approvers } = req.body;
    
    const good = db.goods.find(g => g.id === goods_id);
    if (!good) return res.status(404).json({ success: false, message: '设备不存在' });
    if (good.status !== '可用') return res.status(400).json({ success: false, message: `设备当前状态为"${good.status}"，无法借用` });
    
    const record = {
      id: uuidv4(), goods_id, borrower_name, borrower_phone, borrower_unit,
      borrow_time: new Date().toISOString(), expect_return_time, remark: remark || '', image: image || '',
      status: '审批中', approvers: JSON.stringify(approvers), current_approver: approvers[0],
      approved_by: '', approved_at: '', created_at: new Date().toISOString()
    };
    
    db.borrow_records.push(record);
    good.status = '已借出';
    saveDB(db);
    
    sendDingTalkNotify(record, 'borrow');
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/borrow', (req, res) => {
  try {
    const db = loadDB();
    let records = db.borrow_records;
    if (req.query.status) records = records.filter(r => r.status === req.query.status);
    if (req.query.goods_id) records = records.filter(r => r.goods_id === req.query.goods_id);
    if (req.query.borrower_name) records = records.filter(r => r.borrower_name.includes(req.query.borrower_name));
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/borrow/my', (req, res) => {
  try {
    const db = loadDB();
    let records = db.borrow_records;
    if (req.query.name) records = records.filter(r => r.borrower_name.includes(req.query.name));
    if (req.query.phone) records = records.filter(r => r.borrower_phone === req.query.phone);
    records = records.map(r => {
      const good = db.goods.find(g => g.id === r.goods_id) || {};
      return { ...r, goods_name: good.name, goods_code: good.code };
    });
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/borrow/:id/approve', (req, res) => {
  try {
    const db = loadDB();
    const idx = db.borrow_records.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: '记录不存在' });
    const record = db.borrow_records[idx];
    if (record.status !== '审批中') return res.status(400).json({ success: false, message: '当前状态不允许审批' });
    
    const approvers = JSON.parse(record.approvers);
    if (!approvers.includes(req.body.approver_name)) {
      return res.status(400).json({ success: false, message: '您不是该申请的审批人' });
    }
    
    record.status = '借用中';
    record.approved_by = req.body.approver_name;
    record.approved_at = new Date().toISOString();
    saveDB(db);
    
    sendDingTalkNotify(record, 'borrow_approved');
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/borrow/:id/reject', (req, res) => {
  try {
    const db = loadDB();
    const idx = db.borrow_records.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: '记录不存在' });
    const record = db.borrow_records[idx];
    if (record.status !== '审批中') return res.status(400).json({ success: false, message: '当前状态不允许审批' });
    
    const approvers = JSON.parse(record.approvers);
    if (!approvers.includes(req.body.approver_name)) {
      return res.status(400).json({ success: false, message: '您不是该申请的审批人' });
    }
    
    record.status = '已拒绝';
    record.approved_by = req.body.approver_name;
    record.approved_at = new Date().toISOString();
    
    const good = db.goods.find(g => g.id === record.goods_id);
    if (good) good.status = '可用';
    
    saveDB(db);
    sendDingTalkNotify(record, 'borrow_rejected');
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ RETURN API ============

app.post('/api/return', (req, res) => {
  try {
    const db = loadDB();
    const { borrow_id, is_damaged = false, remark } = req.body;
    
    const borrow = db.borrow_records.find(r => r.id === borrow_id);
    if (!borrow) return res.status(404).json({ success: false, message: '借用记录不存在' });
    if (borrow.status !== '借用中') return res.status(400).json({ success: false, message: '当前状态不允许申请归还' });
    
    const record = {
      id: uuidv4(), borrow_id, goods_id: borrow.goods_id,
      actual_return_time: new Date().toISOString(), status: '待审批',
      approver: '', approved_at: '', remark: remark || '', is_damaged: is_damaged ? 1 : 0,
      created_at: new Date().toISOString()
    };
    
    db.return_records.push(record);
    saveDB(db);
    
    sendDingTalkNotify(record, 'return_apply');
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/return', (req, res) => {
  try {
    const db = loadDB();
    const records = db.return_records.map(r => {
      const borrow = db.borrow_records.find(b => b.id === r.borrow_id) || {};
      const good = db.goods.find(g => g.id === r.goods_id) || {};
      return {
        ...r, borrower_name: borrow.borrower_name, borrower_phone: borrow.borrower_phone,
        borrower_unit: borrow.borrower_unit, goods_name: good.name, goods_code: good.code
      };
    });
    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/return/:id/approve', (req, res) => {
  try {
    const db = loadDB();
    const idx = db.return_records.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: '记录不存在' });
    const record = db.return_records[idx];
    if (record.status !== '待审批') return res.status(400).json({ success: false, message: '当前状态不允许审批' });
    
    record.status = '已通过';
    record.approver = req.body.approver_name;
    record.approved_at = new Date().toISOString();
    
    const borrowIdx = db.borrow_records.findIndex(r => r.id === record.borrow_id);
    if (borrowIdx !== -1) db.borrow_records[borrowIdx].status = '已归还';
    
    const good = db.goods.find(g => g.id === record.goods_id);
    if (good) good.status = record.is_damaged ? '损坏' : '可用';
    
    saveDB(db);
    
    const goodName = good?.name || '';
    sendDingTalkNotify({ ...record, good_name: goodName }, 'return_approved');
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/return/:id/reject', (req, res) => {
  try {
    const db = loadDB();
    const idx = db.return_records.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, message: '记录不存在' });
    const record = db.return_records[idx];
    if (record.status !== '待审批') return res.status(400).json({ success: false, message: '当前状态不允许审批' });
    
    record.status = '已拒绝';
    record.approver = req.body.approver_name;
    record.approved_at = new Date().toISOString();
    
    saveDB(db);
    sendDingTalkNotify(record, 'return_rejected');
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ APPROVER API ============

app.get('/api/approvers', (req, res) => {
  try {
    const db = loadDB();
    res.json({ success: true, data: db.approvers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/approvers', (req, res) => {
  try {
    const db = loadDB();
    const { name, dingtalk_id } = req.body;
    const approver = { id: uuidv4(), name, dingtalk_id: dingtalk_id || '', created_at: new Date().toISOString() };
    db.approvers.push(approver);
    saveDB(db);
    res.json({ success: true, data: approver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/approvers/:id', (req, res) => {
  try {
    const db = loadDB();
    db.approvers = db.approvers.filter(a => a.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ SETTINGS API ============

app.get('/api/settings/webhook', (req, res) => {
  try {
    const db = loadDB();
    res.json({ success: true, data: db.settings.webhook || '' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/settings/webhook', (req, res) => {
  try {
    const db = loadDB();
    db.settings.webhook = req.body.webhook;
    saveDB(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ EXPORT API ============

app.get('/api/export/borrow', (req, res) => {
  try {
    const db = loadDB();
    const records = db.borrow_records.map(r => {
      const good = db.goods.find(g => g.id === r.goods_id) || {};
      return { ...r, goods_name: good.name, goods_code: good.code };
    });
    
    const csv = [
      ['借用ID', '设备名称', '设备编号', '借用人', '电话', '单位', '借用时间', '预计归还', '状态', '审批人', '审批时间', '备注'].join(','),
      ...records.map(r => [
        r.id, r.goods_name, r.goods_code, r.borrower_name, r.borrower_phone, r.borrower_unit,
        r.borrow_time, r.expect_return_time, r.status, r.approved_by || '', r.approved_at || '', r.remark || ''
      ].map(v => `"${v || ''}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment;filename=borrow_records.csv');
    res.send('\ufeff' + csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/export/return', (req, res) => {
  try {
    const db = loadDB();
    const records = db.return_records.map(r => {
      const borrow = db.borrow_records.find(b => b.id === r.borrow_id) || {};
      const good = db.goods.find(g => g.id === r.goods_id) || {};
      return { ...r, borrower_name: borrow.borrower_name, borrower_phone: borrow.borrower_phone, borrower_unit: borrow.borrower_unit, goods_name: good.name, goods_code: good.code };
    });
    
    const csv = [
      ['归还ID', '设备名称', '设备编号', '借用人', '电话', '单位', '实际归还时间', '审批人', '审批时间', '是否损坏', '备注'].join(','),
      ...records.map(r => [
        r.id, r.goods_name, r.goods_code, r.borrower_name, r.borrower_phone, r.borrower_unit,
        r.actual_return_time, r.approver || '', r.approved_at || '', r.is_damaged ? '是' : '否', r.remark || ''
      ].map(v => `"${v || ''}"`).join(','))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment;filename=return_records.csv');
    res.send('\ufeff' + csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ UPLOAD API ============

app.post('/api/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '没有上传文件' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, data: { url, filename: req.file.filename } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ INIT API ============

app.get('/api/init', (req, res) => {
  try {
    initDB();
    res.json({ success: true, message: '初始化成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============ DINGTALK NOTIFY ============

async function sendDingTalkNotify(data, type) {
  const db = loadDB();
  if (!db.settings.webhook) return;
  
  const webhook = db.settings.webhook;
  let content = '';
  
  const good = db.goods.find(g => g.id === data.goods_id) || {};
  
  switch (type) {
    case 'borrow':
      content = `📋 新的借用申请\n\n设备：${good.name || data.goods_id}\n借用人：${data.borrower_name}\n电话：${data.borrower_phone}\n单位：${data.borrower_unit}\n预计归还：${data.expect_return_time}\n审批人：${JSON.parse(data.approvers).join('、')}`;
      break;
    case 'borrow_approved':
      content = `✅ 借用申请已通过\n\n借用人：${data.borrower_name}\n设备：${good.name || data.goods_id}\n审批人：${data.approved_by}`;
      break;
    case 'borrow_rejected':
      content = `❌ 借用申请被拒绝\n\n借用人：${data.borrower_name}\n设备：${good.name || data.goods_id}\n审批人：${data.approved_by}`;
      break;
    case 'return_apply':
      content = `📋 新的归还申请\n\n设备：${good.name || data.goods_id}\n是否损坏：${data.is_damaged ? '⚠️ 是' : '否'}\n备注：${data.remark || '无'}`;
      break;
    case 'return_approved':
      content = `✅ 归还申请已通过\n\n设备：${data.good_name || good.name}\n状态：${data.is_damaged ? '⚠️ 损坏' : '✅ 完好'}\n审批人：${data.approver}`;
      break;
    case 'return_rejected':
      content = `❌ 归还申请被拒绝\n\n设备：${good.name || data.goods_id}\n审批人：${data.approver}`;
      break;
  }
  
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content } })
    });
  } catch (err) {
    console.error('钉钉通知发送失败:', err.message);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});