/* ============================================================
 * 智检 LIS - 视图：工作台
 * ============================================================ */
W.views.dashboard = {
  render(page) {
    const role = W.state.user.role, r = W.ROLES[role], c = W.api.pendingCounts();
    const db = W.db();
    const hour = new Date().getHours();
    const greet = hour < 6 ? '凌晨好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

    /* 统计卡（按角色） */
    let stats = [];
    if (role === 'tech') stats = [
      { label: '今日新增样本', num: c.today, icon: 'i-tube', bg: '#EAF1FE', color: '#2563EB', go: 'samples' },
      { label: '待接收样本', num: c.sampled, icon: 'i-scan', bg: '#E6F7FB', color: '#0E7490', go: 'samples' },
      { label: '检测中', num: c.testing, icon: 'i-flask', bg: '#F3EEFD', color: '#7C3AED', go: 'lab' },
      { label: '待初审报告', num: c.review1, icon: 'i-file', bg: '#FEF5E7', color: '#D97706', go: 'lab' },
    ];
    else if (role === 'director') stats = [
      { label: '待复审报告', num: c.review2, icon: 'i-file', bg: '#FEF5E7', color: '#D97706', go: 'lab' },
      { label: '质控失控未处理', num: c.qcDev, icon: 'i-shield', bg: '#F3EEFD', color: '#7C3AED', go: 'qc' },
      { label: '今日新增样本', num: c.today, icon: 'i-tube', bg: '#EAF1FE', color: '#2563EB', go: 'samples' },
      { label: '设备异常', num: c.devWarn, icon: 'i-monitor', bg: '#FDECEF', color: '#E11D48', go: 'devices' },
    ];
    else if (role === 'clinician') stats = [
      { label: '今日新增申请', num: c.today, icon: 'i-tube', bg: '#EAF1FE', color: '#2563EB', go: 'samples' },
      { label: '可查阅报告', num: c.published, icon: 'i-file', bg: '#EAF8F0', color: '#16A34A', go: 'lab' },
      { label: '检测中', num: c.testing, icon: 'i-flask', bg: '#F3EEFD', color: '#7C3AED', go: 'samples' },
      { label: '待采样', num: db.samples.filter(s => s.status === 'pending_sample').length, icon: 'i-clock', bg: '#FEF5E7', color: '#D97706', go: 'samples' },
    ];
    else stats = [
      { label: '在用账号', num: db.users.filter(u => u.status === 'active').length, icon: 'i-users', bg: '#EAF1FE', color: '#2563EB', go: 'system' },
      { label: '设备异常', num: c.devWarn, icon: 'i-monitor', bg: '#FDECEF', color: '#E11D48', go: 'devices' },
      { label: '今日审计事件', num: db.audits.filter(a => W.fmtD(a.ts) === W.fmtD(Date.now())).length, icon: 'i-file', bg: '#F3EEFD', color: '#7C3AED', go: 'system' },
      { label: '检验项目', num: db.items.length, icon: 'i-db', bg: '#EAF8F0', color: '#16A34A', go: 'lab' },
    ];

    /* 快捷操作 */
    const quicks = [];
    if (['tech', 'director'].includes(role)) {
      quicks.push({ label: '扫码接收', icon: 'i-scan', bg: 'var(--grad)', fn: 'W.openScan()' });
      quicks.push({ label: '样本登记', icon: 'i-plus', bg: '#2563EB', fn: 'W.views.samples.openRegister()' });
    }
    if (role === 'clinician') quicks.push({ label: '检验开单', icon: 'i-plus', bg: 'var(--grad)', fn: 'W.views.samples.openRegister()' }, { label: '查报告', icon: 'i-file', bg: '#16A34A', fn: "W.go('lab')" });
    if (['director', 'admin', 'tech'].includes(role)) quicks.push({ label: '质控录入', icon: 'i-shield', bg: '#7C3AED', fn: "W.go('qc')" }, { label: '统计报表', icon: 'i-chart', bg: '#0E7490', fn: "W.go('reports')" });
    if (role === 'admin') quicks.push({ label: '用户管理', icon: 'i-users', bg: '#475569', fn: "W.go('system')" }, { label: '设备监控', icon: 'i-monitor', bg: '#E11D48', fn: "W.go('devices')" });

    /* 角色待办 */
    const todos = [];
    if (role === 'tech') {
      todos.push({ t: '待接收样本', s: '扫码接收并外观检查', n: c.sampled, go: 'samples' });
      todos.push({ t: '待分配检测', s: '已接收样本分配工位/设备', n: c.received, go: 'lab' });
      todos.push({ t: '待录入结果', s: '设备回传或手动录入', n: c.testing, go: 'lab' });
      todos.push({ t: '待初审报告', s: '一级审核', n: c.review1, go: 'lab' });
    } else if (role === 'director') {
      todos.push({ t: '待复审报告', s: '二级审核后发布', n: c.review2, go: 'lab' });
      todos.push({ t: '质控失控待处理', s: '填写失控原因与纠正措施', n: c.qcDev, go: 'qc' });
      todos.push({ t: '待接收/检测中样本', s: '全流程跟进', n: c.sampled + c.testing, go: 'samples' });
    } else if (role === 'clinician') {
      const mine = db.samples.filter(s => s.doctor === r.name && s.status === 'published');
      todos.push({ t: '可查阅的新报告', s: '今日及近期已发布', n: mine.length, go: 'lab' });
      todos.push({ t: '检测中申请', s: '等待结果', n: db.samples.filter(s => s.doctor === r.name && ['testing','pending_review1','pending_review2'].includes(s.status)).length, go: 'samples' });
    } else {
      todos.push({ t: '设备异常', s: '离线/告警设备清单', n: c.devWarn, go: 'devices' });
      todos.push({ t: '今日登录事件', s: '审计日志跟踪', n: db.audits.filter(a => W.fmtD(a.ts) === W.fmtD(Date.now())).length, go: 'system' });
    }

    /* 预警消息 */
    const alerts = [];
    if (c.sampled + c.received + c.testing > 0) alerts.push({ type: 'review', txt: `${c.sampled + c.received + c.testing} 份样本正在流转中，注意跟进 TAT 时限` });
    db.devices.filter(d => d.status !== 'online').forEach(d => alerts.push({ type: 'device', txt: `${d.name}：${d.warnNote || (d.status === 'offline' ? '设备离线' : '通信异常')}` }));
    if (c.qcDev > 0) alerts.push({ type: 'qc', txt: `${c.qcDev} 条质控失控记录未闭环，请填写原因与纠正措施` });
    const late = db.samples.filter(s => ['received', 'testing', 'pending_review1', 'pending_review2'].includes(s.status) && W.api.tatMinutes(s) > 24 * 60);
    late.forEach(s => alerts.push({ type: 'timeout', txt: `样本 ${s.code}（${s.patient}）已接收超 24h 未发布报告` }));

    /* 近 7 日样本量 sparkline */
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d0 = new Date(); d0.setDate(d0.getDate() - i); d0.setHours(0, 0, 0, 0);
      const d1 = d0.getTime() + 86400000;
      days.push({ k: `${d0.getMonth() + 1}/${d0.getDate()}`, v: db.samples.filter(s => s.createdAt >= d0.getTime() && s.createdAt < d1).length });
    }

    page.innerHTML = `
      <div class="page-head"><div><h2>${greet}，${r.name}</h2><div class="ph-sub">${W.fmtD(Date.now())} ${'周' + '日一二三四五六'[new Date().getDay()]} · ${r.label}工作台</div></div>
        <div class="ph-right"><button class="btn" onclick="W.store.reset();W.toast('已重置演示数据','ok');W.route()">${W.icon('i-refresh', 'ic ic-sm')} 重置演示数据</button></div></div>

      <div class="grid g4" style="margin-bottom:14px">
        ${stats.map(st => `<div class="card stat-card clickable" onclick="W.go('${st.go}')">
          <div class="stat-ico" style="background:${st.bg};color:${st.color}"><svg class="ic"><use href="#${st.icon}"/></svg></div>
          <div><div class="stat-num">${st.num}</div><div class="stat-label">${st.label}</div></div></div>`).join('')}
      </div>

      <div class="grid g32" style="margin-bottom:14px">
        <div class="card"><div class="card-h">${W.icon('i-activity')} 近 7 日样本量趋势</div>
          <div class="card-b"><div class="chart-box" id="dash-trend"></div></div></div>
        <div class="card"><div class="card-h">${W.icon('i-send')} 快捷操作</div>
          <div class="card-b"><div class="quick-grid">${quicks.map(q => `<div class="quick-btn" onclick="${q.fn}"><span class="q-ico" style="background:${q.bg}"><svg class="ic"><use href="#${q.icon}"/></svg></span>${q.label}</div>`).join('')}</div>
          <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);font-size:12px;color:var(--muted)">${W.icon('i-alert', 'ic ic-xs')} 演示提示：数据保存在本机浏览器，可随时重置。</div></div></div>
      </div>

      <div class="grid g32">
        <div class="card"><div class="card-h">${W.icon('i-check')} 我的待办<span class="ch-right" style="color:var(--muted);font-size:12px">点击进入处理</span></div>
          ${todos.map(t => `<div class="todo-item" onclick="W.go('${t.go}')"><div class="todo-main"><div class="todo-title">${t.t}</div><div class="todo-sub">${t.s}</div></div><div class="todo-count">${t.n}</div>${W.icon('i-chevron', 'ic ic-sm')} </div>`).join('')}
        </div>
        <div class="card"><div class="card-h">${W.icon('i-bell')} 预警与提醒<span class="ch-right tag t-red">${alerts.length} 条</span></div>
          ${alerts.length ? `<div style="max-height:280px;overflow-y:auto">${alerts.map(a => { const t = W.MSG_TYPE[a.type];
            return `<div class="todo-item" style="cursor:default"><div class="mi-ico" style="background:${t.bg};color:${t.color};width:30px;height:30px"><svg class="ic ic-xs"><use href="#${t.icon}"/></svg></div><div class="todo-main"><div class="todo-sub" style="white-space:normal;color:var(--text);font-size:13px">${W.esc(a.txt)}</div><div class="todo-sub" style="margin-top:2px">${t.label}</div></div></div>`; }).join('')}</div>`
          : '<div class="tbl-empty" style="padding:30px 0">' + W.icon('i-check', 'ic') + '<div>暂无预警，一切正常</div></div>'}
        </div>
      </div>`;

    W.charts.bar(document.getElementById('dash-trend'), days, { unit: ' 份' });
  },
};
