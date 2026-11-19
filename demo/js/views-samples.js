/* ============================================================
 * 智检 LIS - 视图：样本管理（登记 / 扫码接收 / 流转 / 归档销毁）
 * ============================================================ */
W.views.samples = {
  filter: { status: 'all', kw: '', dept: '' },

  render(page) {
    const db = W.db();
    const f = this.filter;
    const statusTabs = [['all', '全部'], ['pending_sample', '待采样'], ['sampled', '待接收'], ['received', '已接收'], ['testing', '检测中'], ['pending_review1', '待初审'], ['pending_review2', '待复审'], ['published', '已发布'], ['archived', '已归档'], ['rejected', '已拒收']];
    let list = db.samples.slice().sort((a, b) => b.createdAt - a.createdAt);
    if (f.status !== 'all') list = list.filter(s => s.status === f.status);
    if (f.dept) list = list.filter(s => s.dept === f.dept);
    if (f.kw) { const k = f.kw.toLowerCase(); list = list.filter(s => s.code.toLowerCase().includes(k) || s.patient.includes(f.kw)); }

    const role = W.state.user.role;
    page.innerHTML = `
      <div class="page-head"><div><h2>样本管理</h2><div class="ph-sub">申请 → 采样 → 接收 → 检测 → 审核 → 发布 → 归档 全生命周期追溯</div></div>
        <div class="ph-right">
          <button class="btn" onclick="W.openScan()">${W.icon('i-scan', 'ic ic-sm')} 扫码接收</button>
          ${['tech', 'clinician', 'director'].includes(role) ? `<button class="btn btn-primary" onclick="W.views.samples.openRegister()">${W.icon('i-plus', 'ic ic-sm')} ${role === 'clinician' ? '检验开单' : '样本登记'}</button>` : ''}
        </div></div>

      <div class="tabs" style="max-width:100%;overflow-x:auto">
        ${statusTabs.map(([v, l]) => { const n = v === 'all' ? db.samples.length : W.api.countByStatus(v);
          return `<button class="tab ${f.status === v ? 'active' : ''}" onclick="W.views.samples.setStatus('${v}')">${l}${n ? ` (${n})` : ''}</button>`; }).join('')}
      </div>

      <div class="filter-bar">
        <div class="search-box">${W.icon('i-search')}<input class="input" placeholder="搜索条码 / 患者姓名" value="${W.esc(f.kw)}" oninput="W.views.samples.setKw(this.value)"></div>
        <select class="select" onchange="W.views.samples.setDept(this.value)">
          <option value="">全部科室</option>${db.dicts.depts.map(d => `<option ${f.dept === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <span class="tag t-purple" style="margin-left:auto">共 ${list.length} 条</span>
      </div>

      <div class="card"><div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr>
        <th>样本条码</th><th>患者</th><th>科室 / 医生</th><th>检验项目</th><th>状态</th><th>申请时间</th><th>TAT</th><th>操作</th>
      </tr></thead><tbody>
        ${list.length ? list.map(s => {
          const tat = W.api.tatMinutes(s);
          const late = tat != null && !s.publishedAt && tat > 24 * 60;
          const itemNames = s.itemIds.map(id => W.api.itemById(id).name).join('、');
          return `<tr>
            ${W.td('样本条码', `<span class="mono">${s.code}</span>`)}
            ${W.td('患者', `${W.esc(s.patient)}<small style="color:var(--muted)"> · ${s.sex}/${s.age}岁</small>`)}
            ${W.td('科室/医生', `${W.esc(s.dept)}<small style="color:var(--muted)"> · ${W.esc(s.doctor)}</small>`)}
            ${W.td('检验项目', `<span title="${W.esc(itemNames)}">${s.itemIds.length} 项 · ${W.esc(W.api.itemById(s.itemIds[0]).name)}${s.itemIds.length > 1 ? ' 等' : ''}</span>`)}
            ${W.td('状态', `${W.stTag(s.status)}${s.abnormal ? W.tag('t-red', s.abnormal) : ''}`)}
            ${W.td('申请时间', W.fmtDT(s.createdAt))}
            ${W.td('TAT', tat == null ? '—' : `${late ? W.tag('t-red', '超时 ') : ''}${tat >= 60 ? Math.floor(tat / 60) + 'h' + (tat % 60 ? (tat % 60) + 'm' : '') : tat + 'm'}`)}
            ${W.td('操作', `<div style="display:flex;gap:6px;justify-content:flex-end">
              <button class="btn btn-sm" onclick="W.views.samples.openDetail('${s.id}')">详情</button>
              ${s.status === 'published' ? `<button class="btn btn-sm btn-primary" onclick="W.showReport('${s.id}')">报告</button>` : ''}</div>`)}
          </tr>`; }).join('')
        : `<tr><td colspan="8"><div class="tbl-empty">${W.icon('i-search', 'ic')}<div>没有符合条件的样本</div></div></td></tr>`}
      </tbody></table></div></div>`;
  },

  setStatus(v) { this.filter.status = v; this.rerender(); },
  setKw(v) { this.filter.kw = v; this.rerender(true); },
  setDept(v) { this.filter.dept = v; this.rerender(); },
  rerender(keepFocus) { W.route(); if (keepFocus) { const el = document.querySelector('.search-box .input'); el && (el.focus(), el.setSelectionRange(el.value.length, el.value.length)); } },

  /* ---- 样本登记（HIS 同步 / 手动开单） ---- */
  openRegister() {
    const db = W.db();
    W.modal(`<div class="modal-h"><b>样本登记 / 检验开单</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <div class="form-item"><label>患者姓名 <em>*</em></label><input class="input" id="rg-name" placeholder="患者姓名"></div>
        <div class="form-row">
          <div class="form-item"><label>性别</label><select class="select" id="rg-sex"><option>男</option><option>女</option></select></div>
          <div class="form-item"><label>年龄 <em>*</em></label><input class="input" id="rg-age" type="number" min="0" max="120" placeholder="岁"></div>
        </div>
        <div class="form-row">
          <div class="form-item"><label>申请科室 <em>*</em></label><select class="select" id="rg-dept">${db.dicts.depts.map(d => `<option>${d}</option>`).join('')}</select></div>
          <div class="form-item"><label>申请医生</label><input class="input" id="rg-doctor" value="${W.esc(W.state.user.name)}"></div>
        </div>
        <div class="form-item"><label>检验项目 <em>*</em>（多选）</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:150px;overflow-y:auto;padding:10px;border:1px solid var(--border-2);border-radius:8px">
            ${db.items.map(it => `<label style="display:inline-flex;align-items:center;gap:5px;font-size:12.5px;background:#F6F7FB;padding:4px 9px;border-radius:7px;cursor:pointer"><input type="checkbox" class="rg-item" value="${it.id}" style="accent-color:var(--primary)">${it.name}<small style="color:var(--muted-2)">¥${it.price}</small></label>`).join('')}
          </div></div>
        <div class="form-item" style="margin-bottom:0"><label>备注</label><input class="input" id="rg-note" placeholder="临床诊断 / 备注（选填）"></div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.samples.doRegister()">生成条码并登记</button></div>`);
  },
  doRegister() {
    const name = document.getElementById('rg-name').value.trim();
    const age = document.getElementById('rg-age').value;
    const ids = [...document.querySelectorAll('.rg-item:checked')].map(x => x.value);
    if (!name) return W.toast('请填写患者姓名', 'err');
    if (!age || age <= 0) return W.toast('请填写有效年龄', 'err');
    if (!ids.length) return W.toast('请至少选择 1 个检验项目', 'err');
    const db = W.db();
    const now = Date.now();
    const s = {
      id: W.uid('S'), code: 'BC' + W.fmtD(now).replace(/-/g, '') + String(db.samples.length + 1).padStart(3, '0'),
      patient: name, sex: document.getElementById('rg-sex').value, age: +age,
      dept: document.getElementById('rg-dept').value, doctor: document.getElementById('rg-doctor').value || W.state.user.name,
      itemIds: ids, status: 'sampled', abnormal: null, device: null, results: null,
      createdAt: now, sampledAt: now, receivedAt: null, testingAt: null, review1At: null, review2At: null, publishedAt: null, archivedAt: null,
      reviewer1: null, reviewer2: null,
      flow: [{ ts: now, action: '开单申请', operator: W.state.user.name, note: document.getElementById('rg-note').value || '手动登记' },
             { ts: now, action: '采集样本，生成条码', operator: W.state.user.name }],
    };
    db.samples.unshift(s);
    W.api.logAudit('样本登记', `${s.code} · ${name} · ${ids.length} 项`);
    W.closeModal(); W.route(); W.refreshNav();
    W.toast(`登记成功，样本条码 ${s.code}`, 'ok');
    setTimeout(() => W.views.samples.openDetail(s.id), 200);
  },

  /* ---- 详情抽屉 ---- */
  openDetail(id) {
    const s = W.api.sampleById(id);
    if (!s) return;
    const role = W.state.user.role;
    const items = s.itemIds.map(x => W.api.itemById(x));
    const tat = W.api.tatMinutes(s);
    const actions = this.actionsFor(s, role);
    const dev = s.device ? W.api.deviceById(s.device) : null;
    W.drawer(`<div class="drawer-h"><b>样本详情 <span class="mono" style="color:var(--primary)">${s.code}</span></b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="drawer-b">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">${W.stTag(s.status)}${s.abnormal ? W.tag('t-red', s.abnormal) : ''}${lateTag(tat, s)}</div>
        <dl class="kv">
          <dt>患者</dt><dd>${W.esc(s.patient)}（${s.sex} / ${s.age} 岁）</dd>
          <dt>科室 / 医生</dt><dd>${W.esc(s.dept)} · ${W.esc(s.doctor)}</dd>
          <dt>申请时间</dt><dd>${W.fmtDT(s.createdAt)}</dd>
          <dt>采样时间</dt><dd>${s.sampledAt ? W.fmtDT(s.sampledAt) : '—'}</dd>
          <dt>接收时间</dt><dd>${s.receivedAt ? W.fmtDT(s.receivedAt) : '—'}</dd>
          <dt>检测设备</dt><dd>${dev ? W.esc(dev.name) : '—'}</dd>
          <dt>TAT</dt><dd>${tat == null ? '—' : Math.floor(tat / 60) + ' 小时 ' + tat % 60 + ' 分' + (s.publishedAt ? '（已发布）' : '（进行中）')}</dd>
        </dl>
        <div style="font-weight:600;font-size:13.5px;margin-bottom:8px">${W.icon('i-file', 'ic ic-sm')} 检验项目（${items.length}）</div>
        <div class="card" style="box-shadow:none;margin-bottom:16px">
          ${s.results ? `<table class="tbl"><thead><tr><th>项目</th><th>结果</th><th>参考区间</th></tr></thead><tbody>
            ${items.map(it => { const r = s.results[it.id]; if (!r) return '';
              return `<tr><td>${it.name}</td><td class="mono ${r.flag === 'H' ? 'num-up' : r.flag === 'L' ? 'num-down' : ''}">${r.value} ${it.unit}${r.flag ? (r.flag === 'H' ? ' ↑H' : ' ↓L') : ''}</td><td style="color:var(--muted)">${it.ref}</td></tr>`; }).join('')}
          </tbody></table>` : `<div style="padding:12px 14px;color:var(--muted);font-size:13px">${items.map(it => W.tag('t-gray', it.name)).join(' ')}</div>`}
        </div>
        <div style="font-weight:600;font-size:13.5px;margin-bottom:10px">${W.icon('i-activity', 'ic ic-sm')} 流转记录</div>
        <div class="tl">${s.flow.map((f2, i) => `<div class="tl-item"><div class="tl-dot ${i === s.flow.length - 1 ? '' : 'gray'}"></div>
          <div class="tl-title">${W.esc(f2.action)}</div><div class="tl-meta">${W.fmtDT(f2.ts)} · ${W.esc(f2.operator)}${f2.note ? ' · ' + W.esc(f2.note) : ''}</div></div>`).join('')}</div>
      </div>
      <div class="drawer-f">${actions.map(a => `<button class="btn ${a.primary ? 'btn-primary' : ''}" onclick="${a.fn}">${a.label}</button>`).join('')}</div>`);

    function lateTag(t2, s2) { return t2 != null && !s2.publishedAt && t2 > 24 * 60 ? W.tag('t-red', 'TAT 超时') : ''; }
  },

  actionsFor(s, role) {
    const A = [];
    const isTechDir = ['tech', 'director'].includes(role);
    if (s.status === 'sampled' && isTechDir) A.push({ label: '扫码接收', fn: `W.openScan()`, primary: true });
    if (s.status === 'received' && isTechDir) A.push({ label: '分配上机检测', fn: `W.views.lab.openAssign('${s.id}')`, primary: true });
    if (s.status === 'testing' && isTechDir) A.push({ label: '录入结果', fn: `W.views.lab.openResult('${s.id}')`, primary: true });
    if (s.status === 'pending_review1' && isTechDir) A.push({ label: '报告初审', fn: `W.views.lab.openReview('${s.id}',1)`, primary: true });
    if (s.status === 'pending_review2' && role === 'director') A.push({ label: '报告复审', fn: `W.views.lab.openReview('${s.id}',2)`, primary: true });
    if (s.status === 'published' && role === 'director') A.push({ label: '样本归档', fn: `W.views.samples.archive('${s.id}')` });
    if (s.status === 'published') A.push({ label: '查看报告', fn: `W.showReport('${s.id}')` });
    if (s.status === 'archived' && isTechDir) A.push({ label: '登记销毁', fn: `W.views.samples.destroy('${s.id}')` });
    if (s.status === 'destroyed') A.push({ label: '已销毁', fn: '', primary: false });
    return A;
  },
  archive(id) { const r = W.flow.archive(id); W.toast(r.ok ? '样本已归档' : r.err, r.ok ? 'ok' : 'err'); W.closeModal(); W.route(); },
  destroy(id) { W.confirmDialog('登记销毁', '样本销毁（高压灭菌）后不可恢复，确认登记？', () => { const r = W.flow.destroy(id); W.toast(r.ok ? '已登记销毁' : r.err, r.ok ? 'ok' : 'err'); W.closeModal(); W.route(); }); },
};
