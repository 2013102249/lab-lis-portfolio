/* ============================================================
 * 智检 LIS - 视图：检验业务（项目库 / 任务分配 / 结果录入 / 报告审核）
 * ============================================================ */
W.views.lab = {
  tab: 'assign',
  render(page) {
    const role = W.state.user.role;
    const tabs = role === 'clinician'
      ? [['report', '报告查询']]
      : [['assign', '任务分配'], ['result', '结果录入'], ['review', '报告审核'], ['items', '检验项目库']];
    if (!tabs.find(t => t[0] === this.tab)) this.tab = tabs[0][0];
    page.innerHTML = `
      <div class="page-head"><div><h2>检验业务</h2><div class="ph-sub">检验项目配置 · 任务分配 · 结果录入 · 多级报告审核</div></div></div>
      <div class="tabs">${tabs.map(([v, l]) => `<button class="tab ${this.tab === v ? 'active' : ''}" onclick="W.views.lab.tab='${v}';W.route()">${l}${v === 'result' ? ` (${W.api.countByStatus('testing')})` : v === 'review' ? ` (${W.api.countByStatus('pending_review1') + W.api.countByStatus('pending_review2')})` : ''}</button>`).join('')}</div>
      <div id="lab-body"></div>`;
    const body = document.getElementById('lab-body');
    ({ assign: this.tabAssign, result: this.tabResult, review: this.tabReview, items: this.tabItems, report: this.tabReport })[this.tab].call(this, body);
  },

  /* ---------- 任务分配 ---------- */
  tabAssign(el) {
    const list = W.db().samples.filter(s => s.status === 'received').sort((a, b) => a.receivedAt - b.receivedAt);
    el.innerHTML = `<div class="card"><div class="card-h">${W.icon('i-send')} 待分配样本<span class="ch-right" style="color:var(--muted);font-size:12px">分配到检验工位设备后开始检测</span></div>
      <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>样本条码</th><th>患者</th><th>检验项目</th><th>接收时间</th><th>建议设备</th><th>操作</th></tr></thead><tbody>
      ${list.length ? list.map(s => {
        const cats = [...new Set(s.itemIds.map(id => W.api.itemById(id).cat))];
        const sug = this.suggestDevice(cats);
        return `<tr>
          ${W.td('样本条码', `<span class="mono">${s.code}</span>`)}
          ${W.td('患者', `${W.esc(s.patient)} · ${W.esc(s.dept)}`)}
          ${W.td('检验项目', s.itemIds.map(id => W.tag('t-gray', W.api.itemById(id).name)).join(' '))}
          ${W.td('接收时间', `${W.fmtDT(s.receivedAt)}<small style="color:var(--muted)">（${W.ago(s.receivedAt)}）</small>`)}
          ${W.td('建议设备', sug ? W.tag('t-cyan', W.api.deviceById(sug).name) : '<span style="color:var(--muted-2)">—</span>')}
          ${W.td('操作', `<div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
            <select class="select" style="width:auto;height:30px;font-size:12.5px" id="as-dev-${s.id}">${W.db().devices.filter(d => d.status === 'online').map(d => `<option value="${d.id}" ${d.id === sug ? 'selected' : ''}>${d.name}</option>`).join('')}</select>
            <button class="btn btn-sm btn-primary" onclick="W.views.lab.assign('${s.id}')">分配</button></div>`)}
        </tr>`; }).join('')
      : `<tr><td colspan="6"><div class="tbl-empty">${W.icon('i-check', 'ic')}<div>暂无待分配样本</div></div></td></tr>`}</tbody></table></div></div>`;
  },
  suggestDevice(cats) {
    const map = { '血常规': 'DV1', '生化': 'DV2', '电解质': 'DV2', '免疫': 'DV3', '凝血': 'DV4' };
    for (const c of cats) { const d = map[c]; if (d && W.api.deviceById(d)?.status === 'online') return d; }
    return null;
  },
  openAssign(id) {
    const s = W.api.sampleById(id);
    const cats = [...new Set(s.itemIds.map(x => W.api.itemById(x).cat))];
    const sug = this.suggestDevice(cats);
    W.modal(`<div class="modal-h"><b>分配上机检测</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <dl class="kv"><dt>样本条码</dt><dd class="mono">${s.code}</dd><dt>患者</dt><dd>${W.esc(s.patient)}（${W.esc(s.dept)}）</dd></dl>
        <div class="form-item"><label>目标设备 <em>*</em></label>
          <select class="select" id="as-modal-dev">${W.db().devices.filter(d => d.status === 'online').map(d => `<option value="${d.id}" ${d.id === sug ? 'selected' : ''}>${d.name}（${d.type}）</option>`).join('')}</select></div>
        <div style="font-size:12.5px;color:var(--muted)">${W.icon('i-alert', 'ic ic-xs')} 确认后系统通过双向通信向设备下发检测任务</div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.lab.assign('${s.id}', true)">确认下发</button></div>`);
  },
  assign(id, fromModal) {
    const devId = fromModal ? document.getElementById('as-modal-dev').value : document.getElementById('as-dev-' + id)?.value;
    if (!devId) return W.toast('请选择设备', 'err');
    const r = W.flow.assign(id, devId);
    if (fromModal) W.closeModal();
    W.toast(r.ok ? '任务已下发，样本进入检测中' : r.err, r.ok ? 'ok' : 'err');
    W.route(); W.refreshNav();
  },

  /* ---------- 结果录入 ---------- */
  tabResult(el) {
    const list = W.db().samples.filter(s => s.status === 'testing').sort((a, b) => a.testingAt - b.testingAt);
    el.innerHTML = `<div class="card"><div class="card-h">${W.icon('i-edit')} 待录入结果<span class="ch-right" style="color:var(--muted);font-size:12px">支持设备自动回传 / 手动录入 · 异常值自动标记</span></div>
      ${list.length ? list.map(s => {
        const dev = W.api.deviceById(s.device);
        return `<div style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid #F2F3F8;flex-wrap:wrap">
          <div style="flex:1;min-width:220px"><div style="font-weight:600;font-size:13.5px"><span class="mono" style="color:var(--primary)">${s.code}</span> · ${W.esc(s.patient)}<small style="color:var(--muted);font-weight:400">（${W.esc(s.dept)}）</small></div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${s.itemIds.map(x => W.api.itemById(x).name).join(' · ')}　检测设备：${dev ? dev.name : '—'}</div></div>
          <button class="btn btn-sm" onclick="W.views.lab.autoReturn('${s.id}')">${W.icon('i-monitor', 'ic ic-xs')} 模拟设备回传</button>
          <button class="btn btn-sm btn-primary" onclick="W.views.lab.openResult('${s.id}')">手动录入</button>
        </div>`; }).join('')
      : `<div class="tbl-empty">${W.icon('i-check', 'ic')}<div>暂无待录入样本 · 可在「设备管理」模拟回传</div></div>`}</div>`;
  },
  openResult(id) {
    const s = W.api.sampleById(id);
    W.modal(`<div class="modal-h"><b>结果录入 <span class="mono" style="color:var(--primary);font-size:13px">${s.code}</span></b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b"><div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">${W.esc(s.patient)}（${s.sex}/${s.age}岁 · ${W.esc(s.dept)}）· 输入数值后自动比对参考区间，异常值红色高亮</div>
      <table class="tbl"><thead><tr><th>项目</th><th style="width:130px">结果</th><th>参考区间</th><th>标志</th></tr></thead><tbody>
      ${s.itemIds.map(x => { const it = W.api.itemById(x);
        return `<tr><td>${it.name}<small style="color:var(--muted)">（${it.unit}）</small></td>
        <td><input class="input" style="height:32px" type="number" step="any" id="res-${it.id}" data-low="${it.refLow}" data-high="${it.refHigh}" oninput="W.views.lab.markResult(this)"></td>
        <td style="color:var(--muted)">${it.ref}</td><td id="flag-${it.id}"></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.lab.saveResult('${s.id}')">提交并送初审</button></div>`);
  },
  markResult(inp) {
    const v = parseFloat(inp.value), low = +inp.dataset.low, high = +inp.dataset.high;
    const it = W.db().items.find(x => 'flag-' + x.id === inp.id.replace('res-', 'flag-'));
    const flagEl = document.getElementById(inp.id.replace('res-', 'flag-'));
    inp.style.borderColor = ''; inp.style.color = '';
    if (isNaN(v) || !flagEl) { flagEl.innerHTML = ''; return; }
    if (v > high) { flagEl.innerHTML = W.tag('t-red', '↑ 偏高'); inp.style.borderColor = 'var(--danger)'; inp.style.color = 'var(--danger)'; }
    else if (v < low) { flagEl.innerHTML = W.tag('t-blue', '↓ 偏低'); inp.style.borderColor = 'var(--info)'; inp.style.color = 'var(--info)'; }
    else flagEl.innerHTML = W.tag('t-green', '正常');
  },
  saveResult(id) {
    const s = W.api.sampleById(id), results = {};
    for (const x of s.itemIds) {
      const it = W.api.itemById(x);
      const raw = document.getElementById('res-' + x).value;
      if (raw === '' || isNaN(+raw)) return W.toast(`请填写「${it.name}」的检测结果`, 'err');
      const v = +raw;
      results[x] = { value: W.round(v, it.decimals), flag: v > it.refHigh ? 'H' : v < it.refLow ? 'L' : null };
    }
    const r = W.flow.submitResults(id, results);
    W.closeModal();
    W.toast(r.ok ? '结果已录入，报告待初审' : r.err, r.ok ? 'ok' : 'err');
    W.route(); W.refreshNav();
  },
  autoReturn(id) {
    const s = W.api.sampleById(id), results = {};
    for (const x of s.itemIds) {
      const it = W.api.itemById(x);
      let v = W.gauss((it.refLow + it.refHigh) / 2, (it.refHigh - it.refLow) / 6);
      results[x] = { value: W.round(v, it.decimals), flag: v > it.refHigh ? 'H' : v < it.refLow ? 'L' : null };
    }
    const r = W.flow.submitResults(id, results);
    W.api.logAudit('设备结果回传', `${s.code} · ${W.api.deviceById(s.device)?.name || '设备'} 自动回传 ${Object.keys(results).length} 项`);
    W.toast(r.ok ? '设备回传成功，报告待初审' : r.err, r.ok ? 'ok' : 'err');
    W.route(); W.refreshNav();
  },

  /* ---------- 报告审核 ---------- */
  tabReview(el) {
    const role = W.state.user.role;
    if (role === 'clinician') return this.tabReport(el);
    const l1 = W.db().samples.filter(s => s.status === 'pending_review1');
    const l2 = W.db().samples.filter(s => s.status === 'pending_review2');
    el.innerHTML = `
      <div class="grid g2" style="margin-bottom:14px">
        <div class="card"><div class="card-h">${W.icon('i-file')} 待初审（一级）<span class="ch-right tag t-orange">${l1.length}</span></div>
          ${l1.length ? l1.map(s => `<div class="todo-item" onclick="W.views.samples.openDetail('${s.id}')"><div class="todo-main"><div class="todo-title"><span class="mono" style="color:var(--primary)">${s.code}</span> · ${W.esc(s.patient)}</div><div class="todo-sub">${s.itemIds.length} 项 · 初审录入：${W.esc(s.reviewer1 || '—')} · ${W.ago(s.review1At)}</div></div><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();W.views.lab.openReview('${s.id}',1)">审核</button></div>`).join('') : `<div class="tbl-empty" style="padding:26px 0">${W.icon('i-check', 'ic')}<div>暂无待初审报告</div></div>`}
        </div>
        <div class="card"><div class="card-h">${W.icon('i-file')} 待复审（二级）<span class="ch-right tag t-orange">${l2.length}</span></div>
          ${role !== 'director' ? `<div class="tbl-empty" style="padding:26px 0">${W.icon('i-user', 'ic')}<div>复审需要「主任 / 质控员」权限<br><small>可在登录页切换角色体验</small></div></div>`
          : l2.length ? l2.map(s => `<div class="todo-item" onclick="W.views.samples.openDetail('${s.id}')"><div class="todo-main"><div class="todo-title"><span class="mono" style="color:var(--primary)">${s.code}</span> · ${W.esc(s.patient)}</div><div class="todo-sub">${s.itemIds.length} 项 · 初审：${W.esc(s.reviewer1 || '—')} · ${W.ago(s.review1At)}</div></div><button class="btn btn-sm btn-primary" onclick="event.stopPropagation();W.views.lab.openReview('${s.id}',2)">审核</button></div>`).join('')
          : `<div class="tbl-empty" style="padding:26px 0">${W.icon('i-check', 'ic')}<div>暂无待复审报告</div></div>`}
        </div>
      </div>`;
  },
  openReview(id, level) {
    const s = W.api.sampleById(id);
    const abn = s.results ? Object.entries(s.results).filter(([, r]) => r.flag).map(([k, r]) => `${W.api.itemById(k).name} ${r.flag === 'H' ? '↑' : '↓'}`) : [];
    W.modal(`<div class="modal-h"><b>${level === 1 ? '报告初审（一级）' : '报告复审（二级）'} <span class="mono" style="color:var(--primary);font-size:13px">${s.code}</span></b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <dl class="kv"><dt>患者</dt><dd>${W.esc(s.patient)}（${s.sex}/${s.age}岁 · ${W.esc(s.dept)}）</dd>
          <dt>检测设备</dt><dd>${s.device ? W.esc(W.api.deviceById(s.device).name) : '—'}</dd>
          <dt>异常项目</dt><dd>${abn.length ? W.tag('t-red', abn.length + ' 项异常：' + abn.join('、')) : W.tag('t-green', '无异常')}</dd></dl>
        <table class="tbl"><thead><tr><th>项目</th><th>结果</th><th>参考区间</th></tr></thead><tbody>
          ${s.itemIds.map(x => { const it = W.api.itemById(x), r = s.results[x];
            return `<tr><td>${it.name}</td><td class="mono ${r.flag === 'H' ? 'num-up' : r.flag === 'L' ? 'num-down' : ''}">${r.value} ${it.unit}</td><td style="color:var(--muted)">${it.ref}</td></tr>`; }).join('')}
        </tbody></table>
        <div class="form-item" style="margin-top:14px"><label>审核意见（退回时必填）</label><input class="input" id="rv-comment" placeholder="如：与临床不符，建议复测"></div>
      </div>
      <div class="modal-f">
        <button class="btn btn-danger" onclick="W.views.lab.doReview('${s.id}',${level},false)">退回修改</button>
        <button class="btn btn-primary" onclick="W.views.lab.doReview('${s.id}',${level},true)">${level === 1 ? '初审通过' : '复审通过并发布'}</button>
      </div>`);
  },
  doReview(id, level, pass) {
    const comment = document.getElementById('rv-comment')?.value.trim();
    if (!pass && !comment) return W.toast('退回时请填写审核意见', 'err');
    const r = level === 1 ? W.flow.review1(id, pass, comment) : W.flow.review2(id, pass, comment);
    W.closeModal();
    if (r.ok) W.toast(pass ? (level === 1 ? '初审通过，转入复审' : '复审通过，报告已发布') : '已退回修改', 'ok');
    else W.toast(r.err, 'err');
    W.route(); W.refreshNav();
  },

  /* ---------- 报告查询（临床医生） ---------- */
  tabReport(el) {
    const role = W.state.user.role;
    const isCli = role === 'clinician';
    let list = W.db().samples.filter(s => s.status === 'published').sort((a, b) => b.publishedAt - a.publishedAt);
    if (isCli) list = list.filter(s => s.doctor === W.state.user.name);
    el.innerHTML = `<div class="card"><div class="card-h">${W.icon('i-file')} 检验报告查询<span class="ch-right" style="color:var(--muted);font-size:12px">共 ${list.length} 份已发布报告${isCli ? '（我申请的）' : ''}</span></div>
      <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>报告编号</th><th>患者</th><th>科室</th><th>项目数</th><th>异常</th><th>发布时间</th><th>操作</th></tr></thead><tbody>
      ${list.length ? list.map(s => {
        const abn = s.results ? Object.values(s.results).filter(r => r.flag).length : 0;
        return `<tr>
          ${W.td('报告编号', `<span class="mono">REP${s.code}</span>`)}
          ${W.td('患者', `${W.esc(s.patient)} · ${s.sex}/${s.age}岁`)}
          ${W.td('科室', W.esc(s.dept))}
          ${W.td('项目数', s.itemIds.length + ' 项')}
          ${W.td('异常', abn ? W.tag('t-red', abn + ' 项') : W.tag('t-green', '无'))}
          ${W.td('发布时间', W.fmtDT(s.publishedAt))}
          ${W.td('操作', `<button class="btn btn-sm btn-primary" onclick="W.showReport('${s.id}')">查看报告</button>`)}
        </tr>`; }).join('')
      : `<tr><td colspan="7"><div class="tbl-empty">${W.icon('i-file', 'ic')}<div>暂无已发布报告</div></div></td></tr>`}
      </tbody></table></div></div>`;
  },

  /* ---------- 检验项目库 ---------- */
  tabItems(el) {
    const db = W.db();
    el.innerHTML = `<div class="card"><div class="card-h">${W.icon('i-db')} 检验项目库<span class="ch-right"><button class="btn btn-sm btn-primary" onclick="W.views.lab.openItem()">${W.icon('i-plus', 'ic ic-xs')} 新增项目</button></span></div>
      <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>代码</th><th>项目名称</th><th>类别</th><th>参考区间</th><th>单位</th><th>收费</th><th>操作</th></tr></thead><tbody>
      ${db.items.map(it => `<tr>
        ${W.td('代码', `<span class="mono">${it.code}</span>`)}
        ${W.td('项目名称', it.name)}
        ${W.td('类别', W.tag('t-purple', it.cat))}
        ${W.td('参考区间', it.ref)}
        ${W.td('单位', it.unit)}
        ${W.td('收费', '¥' + it.price)}
        ${W.td('操作', `<button class="btn btn-sm" onclick="W.views.lab.openItem('${it.id}')">${W.icon('i-edit', 'ic ic-xs')} 编辑</button>`)}
      </tr>`).join('')}
      </tbody></table></div></div>`;
  },
  openItem(id) {
    const it = id ? W.api.itemById(id) : null;
    W.modal(`<div class="modal-h"><b>${it ? '编辑检验项目' : '新增检验项目'}</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <div class="form-row">
          <div class="form-item"><label>项目代码 <em>*</em></label><input class="input" id="it-code" value="${it ? W.esc(it.code) : ''}" placeholder="如 GLU"></div>
          <div class="form-item"><label>类别</label><select class="select" id="it-cat">${['血常规', '生化', '免疫', '凝血', '电解质'].map(c => `<option ${it?.cat === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        </div>
        <div class="form-item"><label>项目名称 <em>*</em></label><input class="input" id="it-name" value="${it ? W.esc(it.name) : ''}" placeholder="如 空腹血糖"></div>
        <div class="form-row">
          <div class="form-item"><label>参考下限 <em>*</em></label><input class="input" id="it-low" type="number" step="any" value="${it ? it.refLow : ''}"></div>
          <div class="form-item"><label>参考上限 <em>*</em></label><input class="input" id="it-high" type="number" step="any" value="${it ? it.refHigh : ''}"></div>
        </div>
        <div class="form-row">
          <div class="form-item"><label>单位</label><input class="input" id="it-unit" value="${it ? W.esc(it.unit) : ''}" placeholder="如 mmol/L"></div>
          <div class="form-item"><label>收费（元）</label><input class="input" id="it-price" type="number" value="${it ? it.price : ''}"></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.lab.saveItem('${id || ''}')">保存</button></div>`);
  },
  saveItem(id) {
    const code = document.getElementById('it-code').value.trim(), name = document.getElementById('it-name').value.trim();
    const low = +document.getElementById('it-low').value, high = +document.getElementById('it-high').value;
    if (!code || !name) return W.toast('请填写项目代码与名称', 'err');
    if (isNaN(low) || isNaN(high) || low >= high) return W.toast('参考区间无效（下限需小于上限）', 'err');
    const db = W.db();
    const obj = { code, name, cat: document.getElementById('it-cat').value, refLow: low, refHigh: high, ref: `${low}-${high}`, unit: document.getElementById('it-unit').value || '', price: +document.getElementById('it-price').value || 0, decimals: 2 };
    if (id) Object.assign(db.items.find(x => x.id === id), obj);
    else db.items.push({ id: W.uid('IT'), ...obj });
    W.api.logAudit(id ? '编辑检验项目' : '新增检验项目', code + ' ' + name);
    W.store.save(); W.closeModal(); W.route();
    W.toast('项目已保存', 'ok');
  },
};
