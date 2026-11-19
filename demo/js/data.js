/* ============================================================
 * 智检 LIS - 数据层：模拟数据 + localStorage 持久化
 * ============================================================ */
window.W = window.W || {};

W.store = {
  KEY: 'lis_zhijian_v1',
  cache: null,
  init(force) {
    if (!force) {
      try { const raw = localStorage.getItem(this.KEY); if (raw) { this.cache = JSON.parse(raw); return; } } catch (e) {}
    }
    this.cache = W.seed();
    this.save();
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.cache)); } catch (e) {} },
  reset() { this.init(true); },
};

/* ---------- 工具 ---------- */
W.uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
W.fmtD = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
W.fmtT = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
W.fmtDT = (ts) => W.fmtD(ts) + ' ' + W.fmtT(ts);
W.ago = (ts) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '刚刚'; if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60); if (h < 24) return h + ' 小时前';
  return Math.floor(h / 24) + ' 天前';
};
W.daysAgoTs = (n, h = 9, min = 0) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, min, 0, 0); return d.getTime(); };
W.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
W.rnd = (a, b) => a + Math.random() * (b - a);
W.gauss = (mean, sd) => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
W.round = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
W.esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- 常量 ---------- */
W.ROLES = {
  tech:      { label: '检验技师',   name: '王莉',   desc: '样本接收 · 上机检测 · 结果录入 · 报告初审', color: '#2563EB' },
  director:  { label: '主任 / 质控员', name: '李国峰', desc: '报告复审 · 质控管理 · 报表查看 · 业务审核', color: '#7C3AED' },
  clinician: { label: '临床医生',   name: '陈明',   desc: '检验申请开单 · 检验报告查询', color: '#0E7490' },
  admin:     { label: '系统管理员', name: '刘涛',   desc: '账号权限 · 基础数据 · 系统配置 · 审计', color: '#475569' },
};

W.SAMPLE_STATUS = {
  pending_sample:  { label: '待采样', cls: 't-gray'  },
  sampled:         { label: '待接收', cls: 't-blue'  },
  received:        { label: '已接收', cls: 't-cyan'  },
  testing:         { label: '检测中', cls: 't-purple' },
  pending_review1: { label: '待初审', cls: 't-orange' },
  pending_review2: { label: '待复审', cls: 't-orange' },
  published:       { label: '已发布', cls: 't-green' },
  archived:        { label: '已归档', cls: 't-gray'  },
  rejected:        { label: '已拒收', cls: 't-red'   },
  destroyed:       { label: '已销毁', cls: 't-gray'  },
};

W.MSG_TYPE = {
  qc:      { label: '质控失控', color: '#7C3AED', bg: '#F3EEFD', icon: 'i-shield' },
  timeout: { label: '样本超时', color: '#D97706', bg: '#FEF5E7', icon: 'i-clock' },
  review:  { label: '报告审核', color: '#2563EB', bg: '#EAF1FE', icon: 'i-file' },
  device:  { label: '设备告警', color: '#E11D48', bg: '#FDECEF', icon: 'i-monitor' },
};

W.NAV = [
  { id: 'dashboard', label: '工作台',   icon: 'i-home',     roles: ['tech','director','clinician','admin'] },
  { id: 'samples',   label: '样本管理', icon: 'i-tube',     roles: ['tech','director','clinician','admin'] },
  { id: 'lab',       label: '检验业务', icon: 'i-flask',    roles: ['tech','director','clinician'] },
  { id: 'qc',        label: '质控管理', icon: 'i-shield',   roles: ['tech','director','admin'] },
  { id: 'devices',   label: '设备管理', icon: 'i-monitor',  roles: ['tech','director','admin'] },
  { id: 'reports',   label: '报表统计', icon: 'i-chart',    roles: ['director','admin'] },
  { id: 'system',    label: '系统管理', icon: 'i-settings', roles: ['admin'] },
];

/* ---------- 种子数据 ---------- */
W.seed = function () {
  const NOW = Date.now();
  const db = { items: [], samples: [], qcProducts: [], qcData: [], devices: [], msgs: [], audits: [], users: [], dicts: { depts: ['检验科','内科','外科','儿科','急诊科','妇科','ICU','骨科'] } };

  /* 检验项目库 */
  const IT = [
    ['WBC','白细胞计数','血常规','3.5-9.5','×10⁹/L',22],['RBC','红细胞计数','血常规','3.8-5.8','×10¹²/L',20],
    ['HGB','血红蛋白','血常规','115-175','g/L',20],['PLT','血小板计数','血常规','125-350','×10⁹/L',20],
    ['GLU','空腹血糖','生化','3.9-6.1','mmol/L',12],['ALT','谷丙转氨酶','生化','9-50','U/L',15],
    ['AST','谷草转氨酶','生化','15-40','U/L',15],['CREA','肌酐','生化','57-97','μmol/L',18],
    ['UREA','尿素氮','生化','2.9-8.2','mmol/L',16],['UA','尿酸','生化','208-428','μmol/L',16],
    ['TC','总胆固醇','生化','2.8-5.7','mmol/L',18],['TG','甘油三酯','生化','0.45-1.7','mmol/L',18],
    ['K','血钾','电解质','3.5-5.3','mmol/L',10],['NA','血钠','电解质','137-147','mmol/L',10],
    ['CRP','C反应蛋白','免疫','0-10','mg/L',35],['PCT','降钙素原','免疫','0-0.05','ng/mL',120],
    ['TN I','肌钙蛋白I','免疫','0-0.04','ng/mL',95],['PT','凝血酶原时间','凝血','9.4-12.5','s',25],
    ['APTT','活化部分凝血活酶时间','凝血','25.1-36.5','s',25],['DD','D-二聚体','凝血','0-0.55','mg/L',60],
  ];
  IT.forEach(([code, name, cat, ref, unit, price], i) => {
    const refLow = parseFloat(ref.split('-')[0]), refHigh = parseFloat(ref.split('-')[1]);
    db.items.push({
      id: 'IT' + String(i + 1).padStart(3, '0'), code, name, cat, ref, unit, price, refLow, refHigh,
      decimals: refHigh >= 100 ? 0 : (refHigh >= 10 ? 1 : 2),
    });
  });
  const itemBy = (code) => db.items.find(x => x.code === code);

  /* 设备档案 */
  db.devices = [
    { id: 'DV1', name: '迈瑞 BC-5390', type: '全自动血细胞分析仪', proto: 'HL7 / TCP', ip: '192.168.10.21', status: 'online',  todayTasks: 46, connSince: W.daysAgoTs(12) },
    { id: 'DV2', name: '贝克曼 AU5800', type: '全自动生化分析仪', proto: 'LIS2-A2 / 串口', ip: '192.168.10.22', status: 'online',  todayTasks: 63, connSince: W.daysAgoTs(12) },
    { id: 'DV3', name: '罗氏 cobas e601', type: '电化学发光免疫分析仪', proto: 'HL7 / TCP', ip: '192.168.10.23', status: 'online',  todayTasks: 28, connSince: W.daysAgoTs(9) },
    { id: 'DV4', name: '希森美康 CS-5100', type: '全自动凝血分析仪', proto: 'LIS2-A2 / TCP', ip: '192.168.10.24', status: 'warning', todayTasks: 17, connSince: W.daysAgoTs(1), warnNote: '通信超时 3 次（今日 09:42），建议检查网络策略' },
    { id: 'DV5', name: '赛沛 GeneXpert', type: '实时荧光PCR系统', proto: '文件桥接', ip: '192.168.10.25', status: 'offline', todayTasks: 0, connSince: null, warnNote: '离线 2 天（接口服务器升级中）' },
  ];

  /* 用户账号 */
  db.users = [
    { id: 'U1', username: 'wangli',  name: '王莉',   role: 'tech',      dept: '检验科', phone: '138****2211', status: 'active', createdAt: W.daysAgoTs(300) },
    { id: 'U2', username: 'liguofeng', name: '李国峰', role: 'director', dept: '检验科', phone: '139****6633', status: 'active', createdAt: W.daysAgoTs(800) },
    { id: 'U3', username: 'chenming', name: '陈明',   role: 'clinician', dept: '内科',   phone: '137****9155', status: 'active', createdAt: W.daysAgoTs(400) },
    { id: 'U4', username: 'liutao',  name: '刘涛',   role: 'admin',     dept: '信息科', phone: '135****0788', status: 'active', createdAt: W.daysAgoTs(800) },
    { id: 'U5', username: 'zhangmin', name: '张敏',   role: 'tech',      dept: '检验科', phone: '136****3320', status: 'locked', createdAt: W.daysAgoTs(150) },
  ];

  /* 质控品档案 */
  db.qcProducts = [
    { id: 'QC1', name: '多项目生化质控品（低值）', lot: '45211', cat: '生化', target: 4.2,  sd: 0.15, unit: 'mmol/L', itemCode: 'GLU', expire: '2026-12-31', level: '低值' },
    { id: 'QC2', name: '多项目生化质控品（高值）', lot: '45212', cat: '生化', target: 12.8, sd: 0.40, unit: 'mmol/L', itemCode: 'GLU', expire: '2026-12-31', level: '高值' },
    { id: 'QC3', name: '免疫质控品（低值）',       lot: 'IE-118', cat: '免疫', target: 3.2,  sd: 0.30, unit: '×10⁹/L', itemCode: 'WBC', expire: '2027-02-28', level: '低值' },
    { id: 'QC4', name: '免疫质控品（高值）',       lot: 'IE-119', cat: '免疫', target: 12.5, sd: 0.80, unit: '×10⁹/L', itemCode: 'WBC', expire: '2027-02-28', level: '高值' },
  ];

  /* 质控数据：近 30 天 × 4 个质控品，植入失控点 */
  const plan = [ ['QC1', 0], ['QC2', 0], ['QC3', 0], ['QC4', 0] ];
  plan.forEach(([qid]) => {
    const p = db.qcProducts.find(q => q.id === qid);
    for (let d = 29; d >= 0; d--) {
      let v = W.gauss(p.target, p.sd * 0.9);
      /* 植入失控：QC2 第 11 天前 3SD 失控；QC4 第 7 天前 2.4SD 警告 */
      if (qid === 'QC2' && d === 11) v = p.target + p.sd * 3.2;
      if (qid === 'QC4' && d === 7)  v = p.target + p.sd * 2.4;
      if (qid === 'QC4' && d === 6)  v = p.target + p.sd * 2.2;
      db.qcData.push({ id: W.uid('QD'), qcId: qid, ts: W.daysAgoTs(d, 8, 30), value: W.round(v, 2), operator: '王莉' });
    }
  });
  db.qcDeviations = [
    { id: W.uid('QV'), qcId: 'QC2', ts: W.daysAgoTs(11, 8, 35), value: W.round(db.qcProducts[1].target + db.qcProducts[1].sd * 3.2, 2), rule: '1₃ₛ', reason: '质控品复溶后放置时间过长', action: '重新复溶质控品并复测，结果在控', operator: '王莉', status: 'closed' },
  ];

  /* 样本数据 */
  const NAMES = ['张伟','王芳','李娜','刘洋','陈静','杨帆','赵磊','黄敏','周涛','吴倩','徐强','孙丽','马超','朱琳','胡军','郭燕','何平','高远','林悦','罗斌','郑爽','梁波','宋佳','唐磊','许诺','韩雪','冯军','邓琪','曹阳','彭飞'];
  const PATTERNS = [
    ['WBC','RBC','HGB','PLT'], ['GLU','TG','TC'], ['ALT','AST'], ['CREA','UREA','UA'],
    ['CRP','WBC'], ['K','NA'], ['PT','APTT','DD'], ['TN I','CRP'], ['GLU','ALT','CREA'],
  ];
  const DOCS = ['陈明','周建','孙晓丽','吴刚'];
  const dist = [ // [状态, 数量, 天偏移]
    ['published', 3, 6], ['published', 2, 5], ['published', 2, 4], ['published', 3, 3],
    ['published', 2, 2], ['published', 4, 1], ['published', 2, 0],
    ['archived', 3, 3], ['pending_review2', 3, 0],
    ['pending_review1', 4, 0], ['testing', 3, 0], ['received', 3, 0], ['sampled', 2, 0],
    ['pending_sample', 2, 0], ['rejected', 1, 2], ['destroyed', 1, 6],
  ];
  let seq = 0;
  dist.forEach(([status, n, dOff]) => {
    for (let i = 0; i < n; i++) {
      seq++;
      const name = NAMES[(seq * 7 + dOff * 3) % NAMES.length];
      const sex = seq % 2 ? '男' : '女';
      const age = Math.floor(W.rnd(12, 82));
      const dept = status === 'published' && seq % 3 === 0 ? '内科' : W.pick(db.dicts.depts);
      const doctor = W.pick(DOCS);
      const items = W.pick(PATTERNS).map(c => itemBy(c)).filter(Boolean);
      const baseDay = dOff, sampH = Math.floor(W.rnd(7, 15));
      const created = W.daysAgoTs(baseDay, sampH, Math.floor(W.rnd(0, 55)));
      const s = {
        id: W.uid('S'), code: 'BC' + W.fmtD(created).replace(/-/g, '') + String(seq).padStart(3, '0'),
        patient: name, sex, age, dept, doctor,
        itemIds: items.map(x => x.id),
        status, abnormal: null, device: null,
        createdAt: created,
        sampledAt: null, receivedAt: null, testingAt: null, review1At: null, review2At: null, publishedAt: null, archivedAt: null,
        reviewer1: null, reviewer2: null, rejectReason: null, results: null,
        flow: [{ ts: created, action: '开单申请（HIS 同步）', operator: doctor, note: `${dept} · 门诊` }],
      };
      const step = 3600000 * W.rnd(0.4, 1.2);
      if (['sampled','received','testing','pending_review1','pending_review2','published','archived'].includes(status)) {
        s.sampledAt = created + step; s.flow.push({ ts: s.sampledAt, action: '采集样本，生成条码', operator: '护士·刘颖' });
      }
      if (['received','testing','pending_review1','pending_review2','published','archived'].includes(status)) {
        s.receivedAt = s.sampledAt + step;
        s.flow.push({ ts: s.receivedAt, action: '样本接收（扫码）', operator: '王莉', note: '状态正常' });
      }
      if (['testing','pending_review1','pending_review2','published','archived'].includes(status)) {
        s.testingAt = s.receivedAt + step;
        s.device = W.pick(db.devices.slice(0, 3)).id;
        s.flow.push({ ts: s.testingAt, action: '任务下发至设备，上机检测', operator: '系统', note: db.devices.find(d => d.id === s.device)?.name });
      }
      if (['pending_review1','pending_review2','published','archived'].includes(status)) {
        s.results = {};
        items.forEach(it => {
          let v = W.gauss((it.refLow + it.refHigh) / 2, (it.refHigh - it.refLow) / 5.5);
          if (seq % 5 === 0 && it === items[0]) v = it.refHigh * W.rnd(1.08, 1.6); /* 部分异常结果 */
          s.results[it.id] = { value: W.round(v, it.decimals), flag: v > it.refHigh ? 'H' : v < it.refLow ? 'L' : null };
        });
        s.review1At = s.testingAt + step;
        s.reviewer1 = '王莉';
        s.flow.push({ ts: s.review1At, action: '报告初审通过', operator: '王莉' });
      }
      if (['pending_review2','published','archived'].includes(status)) {
        s.review2At = s.review1At + step;
        s.reviewer2 = '李国峰';
        s.flow.push({ ts: s.review2At, action: '报告复审通过，待发布', operator: '李国峰' });
      }
      if (['published','archived'].includes(status)) {
        s.publishedAt = s.review2At + step * 0.5;
        s.flow.push({ ts: s.publishedAt, action: '报告发布，临床端可见', operator: '系统' });
      }
      if (status === 'archived') {
        s.archivedAt = s.publishedAt + step * 2;
        s.flow.push({ ts: s.archivedAt, action: '样本归档（2-8℃ 冷藏）', operator: '王莉' });
      }
      if (status === 'rejected') {
        s.sampledAt = created + step; s.receivedAt = s.sampledAt + step; s.abnormal = '溶血';
        s.flow.push({ ts: s.sampledAt, action: '采集样本，生成条码', operator: '护士·刘颖' });
        s.flow.push({ ts: s.receivedAt, action: '样本接收（扫码）', operator: '王莉', note: '溶血，拒收退回重采' });
      }
      if (status === 'destroyed') {
        s.sampledAt = created + step; s.receivedAt = s.sampledAt + step; s.publishedAt = s.receivedAt + step * 2;
        s.flow.push({ ts: s.sampledAt, action: '采集样本，生成条码', operator: '护士·刘颖' });
        s.flow.push({ ts: s.receivedAt, action: '样本接收（扫码）', operator: '王莉', note: '状态正常' });
        s.flow.push({ ts: s.publishedAt, action: '报告发布，临床端可见', operator: '系统' });
        s.flow.push({ ts: s.publishedAt + step * 4, action: '样本销毁（高压灭菌）', operator: '王莉', note: '保存期满' });
      }
      db.samples.push(s);
    }
  });

  /* 消息 */
  db.msgs = [
    { id: W.uid('M'), type: 'device',  title: '设备通信告警', content: '希森美康 CS-5100 通信超时 3 次，请检查网络连接', ts: W.daysAgoTs(0, 9, 42), read: false },
    { id: W.uid('M'), type: 'review',  title: '报告待复审', content: '今日有 3 份报告完成初审，等待复审发布', ts: W.daysAgoTs(0, 10, 5), read: false },
    { id: W.uid('M'), type: 'timeout', title: '样本周转超时', content: '样本 BC…103 已接收 26 小时未发布报告，超出 TAT 目标', ts: W.daysAgoTs(0, 11, 30), read: false },
    { id: W.uid('M'), type: 'qc',      title: '质控失控预警', content: '生化高值质控 GLU 触发 1₃ₛ 失控规则，请及时处理', ts: W.daysAgoTs(11, 8, 40), read: true },
    { id: W.uid('M'), type: 'review',  title: 'HIS 同步完成', content: '凌晨 HIS 推送 42 条检验申请，已自动生成待采样样本', ts: W.daysAgoTs(1, 6, 0), read: true },
  ];

  /* 审计日志 */
  db.audits = [
    { ts: W.daysAgoTs(0, 9, 1),  user: '王莉',   role: '检验技师', op: '登录系统', detail: 'IP 192.168.1.35' },
    { ts: W.daysAgoTs(0, 9, 3),  user: '李国峰', role: '主任/质控员', op: '登录系统', detail: 'IP 192.168.1.18' },
    { ts: W.daysAgoTs(0, 9, 20), user: '王莉',   role: '检验技师', op: '样本接收', detail: '扫码接收 6 份样本' },
    { ts: W.daysAgoTs(0, 10, 12), user: '系统',  role: '设备接口', op: '结果回传', detail: 'AU5800 回传 12 条检测结果' },
    { ts: W.daysAgoTs(0, 10, 40), user: '王莉',  role: '检验技师', op: '结果录入', detail: '样本 BC…098 手动录入 4 项结果' },
    { ts: W.daysAgoTs(0, 11, 2), user: '李国峰', role: '主任/质控员', op: '报告复审', detail: '通过 3 份报告并发布' },
    { ts: W.daysAgoTs(0, 11, 30), user: '系统',  role: '调度引擎', op: '超时预警', detail: '1 份样本 TAT 超 24h，推送提醒' },
    { ts: W.daysAgoTs(1, 8, 55), user: '刘涛',   role: '系统管理员', op: '修改角色权限', detail: '为「检验技师」增加归档权限' },
    { ts: W.daysAgoTs(1, 14, 22), user: '刘涛',  role: '系统管理员', op: '锁定账号', detail: 'zhangmin 连续 5 次密码错误被锁定' },
    { ts: W.daysAgoTs(2, 16, 8), user: '李国峰', role: '主任/质控员', op: '导出报表', detail: '导出 9 月工作量统计 Excel' },
  ];

  return db;
};

/* ---------- 数据访问 API ---------- */
W.db = () => W.store.cache;

W.api = {
  sampleById(id) { return W.db().samples.find(s => s.id === id); },
  itemById(id) { return W.db().items.find(x => x.id === id); },
  deviceById(id) { return W.db().devices.find(d => d.id === id); },
  qcById(id) { return W.db().qcProducts.find(q => q.id === id); },
  countByStatus(st) { return W.db().samples.filter(s => s.status === st).length; },
  pendingCounts() {
    const d = W.db();
    return {
      sampled: d.samples.filter(s => s.status === 'sampled').length,
      testing: d.samples.filter(s => s.status === 'testing').length,
      review1: d.samples.filter(s => s.status === 'pending_review1').length,
      review2: d.samples.filter(s => s.status === 'pending_review2').length,
      published: d.samples.filter(s => s.status === 'published').length,
      received: d.samples.filter(s => s.status === 'received').length,
      devWarn: d.devices.filter(x => x.status !== 'online').length,
      qcDev: (d.qcDeviations || []).filter(x => x.status !== 'closed').length,
      today: d.samples.filter(s => W.fmtD(s.createdAt) === W.fmtD(Date.now())).length,
    };
  },
  logAudit(op, detail) {
    const r = W.state.role;
    W.db().audits.unshift({ ts: Date.now(), user: W.ROLES[r].name, role: W.ROLES[r].label, op, detail: detail || '' });
    if (W.db().audits.length > 200) W.db().audits.length = 200;
    W.store.save();
  },
  pushMsg(type, title, content) {
    W.db().msgs.unshift({ id: W.uid('M'), type, title, content, ts: Date.now(), read: false });
    W.store.save(); W.refreshMsgDot();
  },
  tatMinutes(s) {
    if (!s.receivedAt) return null;
    const end = s.publishedAt || Date.now();
    return Math.round((end - s.receivedAt) / 60000);
  },
};
