/* ============================================================
 * 智检 LIS - 应用核心：路由 / 布局 / 组件 / 通用业务
 * ============================================================ */
window.W = window.W || {};
W.views = {};
W.state = { user: null, role: null, route: 'dashboard' };

/* ---------- 启动 ---------- */
W.init = function () {
  W.store.init();
  try { const u = JSON.parse(localStorage.getItem('lis_user') || 'null'); if (u && W.ROLES[u.role]) W.state.user = u; } catch (e) {}
  W.renderRoleCards();
  if (W.state.user) { W.enterApp(); } else { document.getElementById('login-view').classList.remove('hidden'); }
  window.addEventListener('hashchange', () => W.route());
  document.addEventListener('click', (e) => {
    const p = document.getElementById('msg-panel');
    if (p && !p.classList.contains('hidden') && !e.target.closest('.msg-wrap')) p.classList.add('hidden');
  });
};

W.renderRoleCards = function () {
  const colors = ['#2563EB', '#7C3AED', '#0E7490', '#475569'];
  const icons = ['i-user', 'i-shield', 'i-activity', 'i-settings'];
  document.getElementById('role-grid').innerHTML = Object.entries(W.ROLES).map(([k, r], i) => `
    <div class="role-card" onclick="W.login('${k}')">
      <div class="role-ava" style="background:${r.color}"><svg class="ic"><use href="#${icons[i]}"/></svg></div>
      <div><b>${r.label}</b><span>${r.name} · ${r.desc}</span></div>
    </div>`).join('');
};

W.login = function (role) {
  W.state.user = { role, name: W.ROLES[role].name, loginAt: Date.now() };
  localStorage.setItem('lis_user', JSON.stringify(W.state.user));
  W.db().audits.unshift({ ts: Date.now(), user: W.ROLES[role].name, role: W.ROLES[role].label, op: '登录系统', detail: '演示环境登录' });
  W.store.save();
  W.enterApp();
  W.toast(`欢迎，${W.ROLES[role].name}（${W.ROLES[role].label}）`, 'ok');
};

W.logout = function () {
  localStorage.removeItem('lis_user');
  W.state.user = null; W.state.route = 'dashboard';
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
  location.hash = '';
};

W.enterApp = function () {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  W.renderNav();
  W.renderUserChip();
  W.refreshMsgDot();
  if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
  W.route();
};

/* ---------- 导航 ---------- */
W.navForRole = () => W.NAV.filter(n => n.roles.includes(W.state.user.role));
W.badgeFor = (id) => {
  const c = W.api.pendingCounts();
  if (W.state.user.role === 'clinician') return id === 'lab' ? c.published : 0;
  if (id === 'samples') return c.sampled + c.received;
  if (id === 'lab') return c.testing + c.review1 + c.review2;
  if (id === 'qc') return c.qcDev;
  if (id === 'devices') return c.devWarn;
  return 0;
};

W.renderNav = function () {
  const nav = W.navForRole();
  document.getElementById('side-nav').innerHTML = nav.map(n => {
    const b = W.badgeFor(n.id);
    return `<div class="nav-item ${W.state.route === n.id ? 'active' : ''}" onclick="W.go('${n.id}')">
      <svg class="ic"><use href="#${n.icon}"/></svg>${n.label}${b ? `<span class="n-badge">${b}</span>` : ''}</div>`;
  }).join('');
  const r = W.ROLES[W.state.user.role];
  document.getElementById('side-foot').innerHTML = `<div class="user-chip" style="width:100%"><div class="user-ava">${r.name[0]}</div><div class="uc-txt"><b style="font-size:13px">${r.name}</b><small>${r.label}</small></div></div>`;
  /* 移动端底部导航：前 4 个 + 更多 */
  const bn = nav.slice(0, 4);
  document.getElementById('bottom-nav').innerHTML =
    bn.map(n => { const b = W.badgeFor(n.id);
      return `<div class="bn-item ${W.state.route === n.id ? 'active' : ''}" onclick="W.go('${n.id}')"><svg class="ic"><use href="#${n.icon}"/></svg>${n.label}${b ? `<span class="n-badge">${b}</span>` : ''}</div>`; }).join('')
    + `<div class="bn-item" onclick="W.openMore()"><svg class="ic"><use href="#i-menu"/></svg>更多</div>`;
};

W.go = function (id) { location.hash = '#/' + id; W.closeMore(); document.getElementById('sidebar').classList.remove('open'); window.scrollTo(0, 0); };
W.route = function () {
  const id = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const view = W.views[id] && W.navForRole().find(n => n.id === id) ? id : 'dashboard';
  W.state.route = view;
  document.getElementById('topbar-title').textContent = (W.NAV.find(n => n.id === view) || {}).label || '工作台';
  W.renderNav();
  const page = document.getElementById('page');
  page.innerHTML = ''; page.classList.add('fade-in');
  try { W.views[view].render(page); } catch (e) { console.error(e); page.innerHTML = `<div class="card"><div class="card-b tbl-empty">页面加载异常：${W.esc(e.message)}</div></div>`; }
};
W.refreshNav = () => W.renderNav();

W.renderUserChip = function () {
  const r = W.ROLES[W.state.user.role];
  document.getElementById('user-chip').innerHTML = `<div class="user-ava">${r.name[0]}</div><div class="uc-txt"><b>${r.name}</b><small>${r.label}</small></div>`;
};

W.toggleSide = function () { document.getElementById('sidebar').classList.toggle('open'); };
W.openMore = function () {
  const nav = W.navForRole().slice(4);
  const extra = [
    { id: '__msg', label: '消息中心', icon: 'i-bell', color: '#E11D48', badge: W.db().msgs.filter(m => !m.read).length },
    { id: '__scan', label: '扫码接收', icon: 'i-scan', color: '#0E7490' },
    { id: '__reset', label: '重置演示数据', icon: 'i-refresh', color: '#475569' },
  ];
  document.getElementById('more-sheet').innerHTML = `<h4>全部功能</h4><div class="more-grid">${nav.map(n => { const b = W.badgeFor(n.id);
    return `<button class="more-cell" onclick="W.go('${n.id}')"><span class="m-ico" style="background:var(--grad)"><svg class="ic"><use href="#${n.icon}"/></svg></span>${n.label}${b ? `<span class="n-badge">${b}</span>` : ''}</button>`; }).join('')
    + extra.map(x => `<button class="more-cell" onclick="W.moreAction('${x.id}')"><span class="m-ico" style="background:${x.color}"><svg class="ic"><use href="#${x.icon}"/></svg></span>${x.label}${x.badge ? `<span class="n-badge">${x.badge}</span>` : ''}</button>`).join('')}</div>`;
  document.getElementById('more-mask').classList.remove('hidden');
  requestAnimationFrame(() => document.getElementById('more-sheet').classList.add('show'));
};
W.closeMore = function () { document.getElementById('more-mask').classList.add('hidden'); document.getElementById('more-sheet').classList.remove('show'); };
W.moreAction = function (id) {
  W.closeMore();
  if (id === '__msg') W.toggleMsg();
  if (id === '__scan') W.openScan();
  if (id === '__reset') W.confirmDialog('重置演示数据', '将清空本机所有操作记录并恢复初始演示数据，确定继续？', () => { W.store.reset(); W.toast('演示数据已重置', 'ok'); W.route(); });
};

/* ---------- 消息中心 ---------- */
W.refreshMsgDot = function () {
  const n = W.db().msgs.filter(m => !m.read).length;
  document.getElementById('msg-dot')?.classList.toggle('hidden', !n);
  const panel = document.getElementById('msg-panel');
  if (panel && !panel.classList.contains('hidden')) W.renderMsgList();
  if (W.state.user && document.getElementById('bottom-nav')?.children.length) W.renderNav();
};
W.toggleMsg = function (e) { e && e.stopPropagation(); const p = document.getElementById('msg-panel'); p.classList.toggle('hidden'); if (!p.classList.contains('hidden')) W.renderMsgList(); };
W.renderMsgList = function () {
  const msgs = W.db().msgs;
  document.getElementById('msg-list').innerHTML = msgs.length ? msgs.map(m => {
    const t = W.MSG_TYPE[m.type] || W.MSG_TYPE.review;
    return `<div class="msg-item ${m.read ? '' : 'unread'}" onclick="W.readMsg('${m.id}')">
      <div class="mi-ico" style="background:${t.bg};color:${t.color}"><svg class="ic"><use href="#${t.icon}"/></svg></div>
      <div style="flex:1;min-width:0"><div class="mi-title">${W.esc(m.title)}</div><div class="mi-body">${W.esc(m.content)}</div><div class="mi-time">${W.ago(m.ts)}</div></div></div>`;
  }).join('') : '<div class="msg-empty">暂无消息</div>';
};
W.readMsg = function (id) { const m = W.db().msgs.find(x => x.id === id); if (m) { m.read = true; W.store.save(); W.refreshMsgDot(); W.renderMsgList(); } };
W.readAllMsg = function () { W.db().msgs.forEach(m => m.read = true); W.store.save(); W.refreshMsgDot(); W.renderMsgList(); };

/* ---------- 通用 UI ---------- */
W.toast = function (msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<svg class="ic ic-sm"><use href="#${type === 'ok' ? 'i-check' : type === 'err' ? 'i-alert' : 'i-activity'}"/></svg>${W.esc(msg)}`;
  document.getElementById('toast-root').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2400);
};

W.modal = function (html, { lg = false } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-mask" onclick="if(event.target===this)W.closeModal()"><div class="modal ${lg ? 'modal-lg' : ''}">${html}</div></div>`;
};
W.closeModal = function () { document.getElementById('modal-root').innerHTML = ''; };
W.drawer = function (html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="drawer-mask" onclick="W.closeModal()"></div><div class="drawer">${html}</div>`;
};
W.confirmDialog = function (title, text, onOk, okLabel = '确定') {
  W.modal(`<div class="modal-h"><b>${W.esc(title)}</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
    <div class="modal-b" style="color:var(--muted);font-size:14px">${W.esc(text)}</div>
    <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" id="cf-ok">${okLabel}</button></div>`);
  document.getElementById('cf-ok').onclick = () => { W.closeModal(); onOk(); };
};
W.icon = (name, cls = 'ic') => `<svg class="${cls}"><use href="#${name}"/></svg>`;
W.tag = (cls, txt) => `<span class="tag ${cls}">${txt}</span>`;
W.stTag = (st) => { const s = W.SAMPLE_STATUS[st]; return W.tag(s.cls, s.label); };
W.td = (label, html) => `<td data-label="${label}">${html}</td>`;

/* ---------- 样本状态机（通用业务） ---------- */
W.flow = {
  receive(code, abnormal, note) {
    const s = W.db().samples.find(x => x.code === code);
    if (!s) return { err: '未找到该条码对应的样本' };
    if (s.status !== 'sampled') return { err: `样本状态为「${W.SAMPLE_STATUS[s.status].label}」，无法接收` };
    s.receivedAt = Date.now();
    if (abnormal && abnormal !== '正常') {
      s.abnormal = abnormal; s.status = 'rejected';
      s.flow.push({ ts: Date.now(), action: '样本接收（扫码）', operator: W.state.user.name, note: `${abnormal}，拒收退回重采` });
      W.api.logAudit('样本接收-拒收', `${s.code} · ${abnormal}`);
    } else {
      s.status = 'received';
      s.flow.push({ ts: Date.now(), action: '样本接收（扫码）', operator: W.state.user.name, note: note || '状态正常' });
      W.api.logAudit('样本接收', s.code);
    }
    W.store.save();
    return { ok: true, sample: s };
  },
  assign(id, deviceId) {
    const s = W.api.sampleById(id), d = W.api.deviceById(deviceId);
    if (!s || s.status !== 'received') return { err: '样本状态不允许分配' };
    s.device = deviceId; s.status = 'testing'; s.testingAt = Date.now();
    s.flow.push({ ts: Date.now(), action: '任务下发至设备，上机检测', operator: W.state.user.name, note: d.name });
    W.api.logAudit('任务分配', `${s.code} → ${d.name}`);
    d.todayTasks++; W.store.save();
    return { ok: true };
  },
  submitResults(id, results) {
    const s = W.api.sampleById(id);
    if (!s || s.status !== 'testing') return { err: '样本状态不允许录入结果' };
    s.results = results; s.status = 'pending_review1'; s.review1At = Date.now(); s.reviewer1 = W.state.user.name;
    s.flow.push({ ts: Date.now(), action: '结果录入，报告待初审', operator: W.state.user.name });
    const abn = Object.entries(results).filter(([, r]) => r.flag);
    if (abn.length) W.api.pushMsg('review', '异常结果提醒', `样本 ${s.code}（${s.patient}）存在 ${abn.length} 项异常结果，已提交初审`);
    W.api.logAudit('结果录入', `${s.code} · ${Object.keys(results).length} 项${abn.length ? ' · 含异常 ' + abn.length + ' 项' : ''}`);
    W.store.save();
    return { ok: true };
  },
  review1(id, pass, comment) {
    const s = W.api.sampleById(id);
    if (!s || s.status !== 'pending_review1') return { err: '样本状态不允许初审' };
    if (pass) { s.status = 'pending_review2'; s.flow.push({ ts: Date.now(), action: '报告初审通过，转复审', operator: W.state.user.name, note: comment || '' }); }
    else { s.status = 'testing'; s.flow.push({ ts: Date.now(), action: '初审退回，重新录入', operator: W.state.user.name, note: comment || '' }); }
    W.api.logAudit(pass ? '报告初审通过' : '报告初审退回', s.code + (comment ? ' · ' + comment : ''));
    W.store.save(); return { ok: true };
  },
  review2(id, pass, comment) {
    const s = W.api.sampleById(id);
    if (!s || s.status !== 'pending_review2') return { err: '样本状态不允许复审' };
    if (pass) {
      s.status = 'published'; s.publishedAt = Date.now(); s.reviewer2 = W.state.user.name;
      s.flow.push({ ts: Date.now(), action: '报告复审通过并发布，临床端可见', operator: W.state.user.name, note: comment || '' });
      W.api.pushMsg('review', '报告已发布', `${s.dept} ${s.patient} 的检验报告已发布，临床端可查看`);
    } else { s.status = 'pending_review1'; s.flow.push({ ts: Date.now(), action: '复审退回至初审', operator: W.state.user.name, note: comment || '' }); }
    W.api.logAudit(pass ? '报告复审发布' : '报告复审退回', s.code + (comment ? ' · ' + comment : ''));
    W.store.save(); return { ok: true };
  },
  archive(id) {
    const s = W.api.sampleById(id);
    if (!s || s.status !== 'published') return { err: '仅已发布样本可归档' };
    s.status = 'archived'; s.archivedAt = Date.now();
    s.flow.push({ ts: Date.now(), action: '样本归档（2-8℃ 冷藏）', operator: W.state.user.name });
    W.api.logAudit('样本归档', s.code);
    W.store.save(); return { ok: true };
  },
  destroy(id) {
    const s = W.api.sampleById(id);
    if (!s || !['published', 'archived'].includes(s.status)) return { err: '仅已发布/已归档样本可登记销毁' };
    s.status = 'destroyed';
    s.flow.push({ ts: Date.now(), action: '样本销毁（高压灭菌）', operator: W.state.user.name, note: '保存期满登记销毁' });
    W.api.logAudit('样本销毁登记', s.code);
    W.store.save(); return { ok: true };
  },
};

/* ---------- 扫码 ---------- */
W.openScan = function () {
  const cand = W.db().samples.filter(s => s.status === 'sampled');
  W.modal(`<div class="modal-h"><b>${W.icon('i-scan', 'ic')} 扫码接收样本</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
    <div class="modal-b">
      <div class="form-item"><label>样本条码 <em>*</em></label>
        <input class="input mono" id="scan-code" placeholder="扫描或输入条码，如 BC20261010001" autocomplete="off">
        ${cand.length ? `<button class="btn btn-sm" style="margin-top:8px" onclick="W.mockScan()">${W.icon('i-refresh', 'ic ic-xs')} 模拟扫码枪（待接收样本：${cand.length} 份）</button>` : ''}
      </div>
      <div class="form-item"><label>外观检查</label>
        <select class="select" id="scan-abnormal">
          <option>正常</option><option>溶血</option><option>量不足</option><option>脂血</option><option>凝血</option><option>容器错误</option>
        </select></div>
      <div id="scan-result"></div>
    </div>
    <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.doScan()">确认接收</button></div>`);
  setTimeout(() => document.getElementById('scan-code')?.focus(), 120);
};
W.mockScan = function () {
  const cand = W.db().samples.filter(s => s.status === 'sampled');
  if (!cand.length) return W.toast('没有待接收的样本', 'err');
  document.getElementById('scan-code').value = W.pick(cand).code;
};
W.doScan = function () {
  const code = document.getElementById('scan-code').value.trim();
  if (!code) return W.toast('请输入样本条码', 'err');
  const ab = document.getElementById('scan-abnormal').value;
  const r = W.flow.receive(code, ab);
  if (r.err) { document.getElementById('scan-result').innerHTML = `<div class="tag t-red" style="padding:8px 12px">${W.icon('i-alert', 'ic ic-xs')} ${r.err}</div>`; return; }
  const s = r.sample;
  W.api.pushMsg('review', '样本已接收', s.status === 'rejected' ? `${s.code}（${s.patient}）${s.abnormal}拒收` : `${s.code}（${s.patient}）接收完成，待分配检测`);
  W.closeModal();
  W.toast(s.status === 'rejected' ? `${s.code} 已标记拒收（${s.abnormal}）` : `${s.code} 接收成功`, s.status === 'rejected' ? 'err' : 'ok');
  W.route(); W.refreshNav();
};

/* ---------- 图表（纯 SVG，无依赖） ---------- */
W.charts = {
  frame(w, h, padL, padR, padT, padB) { return { x: padL, y: padT, w: w - padL - padR, h: h - padT - padB }; },
  bar(el, data, { color = '#7C3AED', color2 = '#2563EB', unit = '' } = {}) {
    const w = 680, h = 260, p = 46, f = this.frame(w, h, p, 14, 18, 34);
    const max = Math.max(...data.map(d => d.v), 1) * 1.15;
    const bw = f.w / data.length;
    let s = `<svg viewBox="0 0 ${w} ${h}">`;
    for (let i = 0; i <= 4; i++) { const y = f.y + f.h - (f.h * i / 4); const v = max * i / 4;
      s += `<line x1="${f.x}" y1="${y}" x2="${f.x + f.w}" y2="${y}" stroke="#EDEFF5"/>`;
      s += `<text x="${f.x - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#A5AABF">${Math.round(v)}</text>`; }
    data.forEach((d, i) => {
      const bh = f.h * d.v / max, x = f.x + i * bw + bw * 0.22, y = f.y + f.h - bh;
      s += `<defs><linearGradient id="bg${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color2}"/></linearGradient></defs>`;
      s += `<rect x="${x}" y="${y}" width="${bw * 0.56}" height="${Math.max(bh, 2)}" rx="4" fill="url(#bg${i})"><title>${d.k}：${d.v}${unit}</title></rect>`;
      s += `<text x="${x + bw * 0.28}" y="${f.y + f.h + 18}" text-anchor="middle" font-size="11" fill="#7A8099">${d.k}</text>`;
      s += `<text x="${x + bw * 0.28}" y="${y - 6}" text-anchor="middle" font-size="11" fill="#4A5068" font-weight="600">${d.v}</text>`;
    });
    s += '</svg>'; el.innerHTML = s;
  },
  line(el, data, { color = '#2563EB', unit = '', target = null, targetLabel = '' } = {}) {
    const w = 680, h = 260, p = 46, f = this.frame(w, h, p, 14, 18, 34);
    const vals = data.map(d => d.v).concat(target != null ? [target] : []);
    const min = Math.min(...vals, 0), max = Math.max(...vals) * 1.1;
    const X = i => f.x + (data.length === 1 ? f.w / 2 : f.w * i / (data.length - 1));
    const Y = v => f.y + f.h - f.h * (v - min) / (max - min || 1);
    let s = `<svg viewBox="0 0 ${w} ${h}">`;
    for (let i = 0; i <= 4; i++) { const y = f.y + f.h - f.h * i / 4; const v = min + (max - min) * i / 4;
      s += `<line x1="${f.x}" y1="${y}" x2="${f.x + f.w}" y2="${y}" stroke="#EDEFF5"/>`;
      s += `<text x="${f.x - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#A5AABF">${Math.round(v)}</text>`; }
    if (target != null) { const ty = Y(target);
      s += `<line x1="${f.x}" y1="${ty}" x2="${f.x + f.w}" y2="${ty}" stroke="#D97706" stroke-dasharray="6 4"/>`;
      s += `<text x="${f.x + f.w}" y="${ty - 6}" text-anchor="end" font-size="11" fill="#D97706">${targetLabel || '目标 ' + target}${unit}</text>`; }
    const pts = data.map((d, i) => `${X(i)},${Y(d.v)}`).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
    data.forEach((d, i) => {
      s += `<circle cx="${X(i)}" cy="${Y(d.v)}" r="4.5" fill="#fff" stroke="${color}" stroke-width="2.5"><title>${d.k}：${d.v}${unit}</title></circle>`;
      s += `<text x="${X(i)}" y="${f.y + f.h + 18}" text-anchor="middle" font-size="11" fill="#7A8099">${d.k}</text>`;
    });
    s += '</svg>'; el.innerHTML = s;
  },
  hbar(el, data, { color = '#7C3AED' } = {}) {
    const w = 680, rowH = 44, h = data.length * rowH + 16, max = Math.max(...data.map(d => d.v), 1);
    let s = `<svg viewBox="0 0 ${w} ${h}">`;
    data.forEach((d, i) => {
      const y = 8 + i * rowH, bw = (w - 170) * d.v / max;
      s += `<text x="0" y="${y + 16}" font-size="12.5" fill="#4A5068">${W.esc(d.k)}</text>`;
      s += `<rect x="120" y="${y + 4}" width="${Math.max(bw, 4)}" height="20" rx="5" fill="${color}" opacity="${0.45 + 0.55 * d.v / max}"/>`;
      s += `<text x="${120 + Math.max(bw, 4) + 8}" y="${y + 19}" font-size="12" fill="#4A5068" font-weight="600">${d.v}</text>`;
    });
    s += '</svg>'; el.innerHTML = s;
  },
};

/* ---------- L-J 质控图 ---------- */
W.ljChart = function (el, qc, points) {
  const w = 680, h = 320, p = 50, f = { x: p, y: 16, w: w - p - 16, h: h - 62 };
  const t = qc.target, sd = qc.sd;
  const yMin = t - 4.4 * sd, yMax = t + 4.4 * sd;
  const Y = v => f.y + f.h - f.h * (v - yMin) / (yMax - yMin);
  const n = points.length;
  const X = i => f.x + (n <= 1 ? f.w / 2 : f.w * i / (n - 1));
  let s = `<svg viewBox="0 0 ${w} ${h}">`;
  /* SD 区带 */
  s += `<rect x="${f.x}" y="${Y(t + 2 * sd)}" width="${f.w}" height="${Y(t - 2 * sd) - Y(t + 2 * sd)}" fill="#F0FAF4"/>`;
  s += `<rect x="${f.x}" y="${Y(t + 3 * sd)}" width="${f.w}" height="${Y(t - 3 * sd) - Y(t + 3 * sd)}" fill="#FDF6EC" opacity=".85"/>`;
  [[3, '#F0C36D'], [2, '#9BD4AE'], [1, '#C8E6D2']].forEach(([k, c]) => {
    [1, -1].forEach(m => { s += `<line x1="${f.x}" y1="${Y(t + m * k * sd)}" x2="${f.x + f.w}" y2="${Y(t + m * k * sd)}" stroke="${c}" stroke-width="1.2"/>`; });
  });
  s += `<line x1="${f.x}" y1="${Y(t)}" x2="${f.x + f.w}" y2="${Y(t)}" stroke="#16A34A" stroke-width="1.6"/>`;
  [[4, 1], [3, 1], [2, 1], [1, 1], [0, 1]].forEach(([k]) => {
    if (k === 0) s += `<text x="${f.x - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="10.5" fill="#16A34A">靶值</text>`;
    else { s += `<text x="${f.x - 6}" y="${Y(t + k * sd) + 4}" text-anchor="end" font-size="10.5" fill="#A5AABF">+${k}s</text>`;
      s += `<text x="${f.x - 6}" y="${Y(t - k * sd) + 4}" text-anchor="end" font-size="10.5" fill="#A5AABF">-${k}s</text>`; }
  });
  const pts = points.map((pt, i) => ({ ...pt, x: X(i), y: Y(pt.value) }));
  const line = pts.map(p2 => `${p2.x},${p2.y}`).join(' ');
  s += `<polyline points="${line}" fill="none" stroke="#7C3AED" stroke-width="1.8" stroke-linejoin="round" opacity=".75"/>`;
  pts.forEach(p2 => {
    const viol = Math.abs(p2.value - t) > 2 * sd;
    const viol3 = Math.abs(p2.value - t) > 3 * sd;
    s += `<circle cx="${p2.x}" cy="${p2.y}" r="${viol ? 6 : 4}" fill="${viol3 ? '#E11D48' : viol ? '#F59E0B' : '#2563EB'}" ${viol ? 'stroke="#fff" stroke-width="2"' : ''}><title>${W.fmtD(p2.ts)}：${p2.value} ${qc.unit}${viol ? (viol3 ? '（失控 1₃ₛ）' : '（警告 ±2s）') : ''}</title></circle>`;
  });
  s += `<text x="${f.x}" y="${h - 12}" font-size="11" fill="#A5AABF">质控品：${W.esc(qc.name)} · 批号 ${qc.lot} · 靶值 ${qc.target} ${qc.unit} · 近 ${n} 天</text>`;
  s += '</svg>';
  el.innerHTML = s;
};

/* ---------- CSV 导出 ---------- */
W.exportCSV = function (filename, rows) {
  const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
  W.api.logAudit('导出数据', filename);
  W.toast('已导出 ' + filename, 'ok');
};

/* ---------- 报告单 ---------- */
W.showReport = function (sampleId, { print = false } = {}) {
  const s = W.api.sampleById(sampleId);
  if (!s || !s.results) return;
  const rows = s.itemIds.map(id => {
    const it = W.api.itemById(id), r = s.results[id];
    const flag = r.flag === 'H' ? '<span class="flag-h">↑ H</span>' : r.flag === 'L' ? '<span class="flag-l">↓ L</span>' : '';
    return `<tr><td>${it.name}</td><td class="mono">${r.value}</td><td style="text-align:center">${flag}</td><td>${it.ref}</td><td>${it.unit}</td></tr>`;
  }).join('');
  const html = `<div class="report-sheet" id="rp">
    <div class="report-head"><h3>示例人民医院 · 检验报告单</h3><p>报告编号：REP${s.code} · 生成时间 ${W.fmtDT(s.publishedAt || Date.now())}</p></div>
    <div class="report-kv">
      <div>患者姓名：<b>${W.esc(s.patient)}</b></div><div>性别：<b>${s.sex}</b></div><div>年龄：<b>${s.age} 岁</b></div>
      <div>科室：<b>${W.esc(s.dept)}</b></div><div>申请医生：<b>${W.esc(s.doctor)}</b></div><div>样本条码：<b class="mono">${s.code}</b></div>
    </div>
    <table class="report-tbl"><thead><tr><th style="text-align:left">项目</th><th>结果</th><th>标志</th><th>参考区间</th><th>单位</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="report-foot"><span>检验者：${W.esc(s.reviewer1 || '—')}</span><span>审核者：${W.esc(s.reviewer2 || '—')}</span><span>采样时间：${s.sampledAt ? W.fmtDT(s.sampledAt) : '—'}</span></div>
  </div>`;
  W.modal(`<div class="modal-h"><b>检验报告</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
    <div class="modal-b">${html}</div>
    <div class="modal-f"><button class="btn" onclick="W.closeModal()">关闭</button><button class="btn btn-primary" onclick="W.printReport()">${W.icon('i-printer', 'ic ic-sm')} 打印报告</button></div>`, { lg: true });
};
W.printReport = function () {
  document.getElementById('print-area').innerHTML = document.querySelector('#modal-root .report-sheet').outerHTML;
  window.print();
};
