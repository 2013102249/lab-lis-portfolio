/* ============================================================
 * 智检 LIS - 视图：质控管理（质控品档案 / L-J 图 / 失控处理）
 * ============================================================ */
W.views.qc = {
  selQc: 'QC2',
  render(page) {
    const db = W.db();
    const sel = this.selQc;
    const points = db.qcData.filter(d => d.qcId === sel).sort((a, b) => a.ts - b.ts).slice(-30);
    const qc = W.api.qcById(sel);
    /* 统计 */
    const vals = points.map(p => p.value);
    const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1 || 1));
    const cv = mean ? sd / mean * 100 : 0;
    const viol = points.filter(p => Math.abs(p.value - qc.target) > 2 * qc.sd).length;
    const devOpen = (db.qcDeviations || []).filter(d => d.status !== 'closed');

    page.innerHTML = `
      <div class="page-head"><div><h2>质控管理</h2><div class="ph-sub">质控品档案 · 每日质控 · L-J 质控图 · Westgard 失控预警</div></div>
        <div class="ph-right"><button class="btn btn-primary" onclick="W.views.qc.openEntry()">${W.icon('i-plus', 'ic ic-sm')} 质控数据录入</button></div></div>

      <div class="grid g4" style="margin-bottom:14px">
        <div class="card stat-card"><div class="stat-ico" style="background:#EAF8F0;color:#16A34A"><svg class="ic"><use href="#i-check"/></svg></div>
          <div><div class="stat-num">98.9<small>%</small></div><div class="stat-label">近 30 天质控合格率</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#F3EEFD;color:#7C3AED"><svg class="ic"><use href="#i-db"/></svg></div>
          <div><div class="stat-num">${db.qcData.length}</div><div class="stat-label">质控数据点（4 品 × 30 天）</div></div></div>
        <div class="card stat-card clickable" onclick="document.getElementById('qc-dev-card').scrollIntoView({behavior:'smooth'})"><div class="stat-ico" style="background:#FDECEF;color:#E11D48"><svg class="ic"><use href="#i-alert"/></svg></div>
          <div><div class="stat-num">${viol}</div><div class="stat-label">当前质控品失控/警告点</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#FEF5E7;color:#D97706"><svg class="ic"><use href="#i-clock"/></svg></div>
          <div><div class="stat-num">${devOpen.length}</div><div class="stat-label">失控记录未闭环</div></div></div>
      </div>

      <div class="card" style="margin-bottom:14px">
        <div class="card-h">${W.icon('i-activity')} L-J 质控图（Levey-Jennings）
          <span class="ch-right"><select class="select" style="width:auto;height:32px" onchange="W.views.qc.selQc=this.value;W.route()">
            ${db.qcProducts.map(q => `<option value="${q.id}" ${q.id === sel ? 'selected' : ''}>${q.name}（${q.itemCode}）</option>`).join('')}</select></span></div>
        <div class="card-b">
          <div class="chart-box" id="qc-lj"></div>
          <div class="legend">
            <span><i style="background:#2563EB"></i>在控数据</span>
            <span><i style="background:#F59E0B"></i>±2s 警告</span>
            <span><i style="background:#E11D48"></i>1₃ₛ 失控</span>
            <span><i style="background:#C8E6D2"></i>±1s</span><span><i style="background:#9BD4AE"></i>±2s</span><span><i style="background:#F0C36D"></i>±3s</span>
          </div>
          <div class="grid g4" style="margin-top:14px;gap:10px">
            ${[['靶值', qc.target + ' ' + qc.unit], ['实测均值', W.round(mean, 2) + ' ' + qc.unit], ['SD', W.round(sd, 3)], ['CV', W.round(cv, 2) + '%']].map(([k, v]) =>
              `<div style="background:#F8F9FC;border-radius:10px;padding:10px 14px"><div style="font-size:12px;color:var(--muted)">${k}</div><div style="font-size:16px;font-weight:700;margin-top:2px">${v}</div></div>`).join('')}
          </div>
        </div>
      </div>

      <div class="grid g32">
        <div class="card" id="qc-dev-card"><div class="card-h">${W.icon('i-alert')} 失控记录与处理<span class="ch-right" style="color:var(--muted);font-size:12px">失控须记录原因与纠正措施并留痕</span></div>
          <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>时间</th><th>质控品</th><th>实测值</th><th>规则</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${(db.qcDeviations || []).map(d => { const q = W.api.qcById(d.qcId);
              return `<tr>
                ${W.td('时间', W.fmtDT(d.ts))}
                ${W.td('质控品', `${W.esc(q.name)}<small style="color:var(--muted)">（批号 ${q.lot}）</small>`)}
                ${W.td('实测值', `<span class="mono num-up">${d.value} ${q.unit}</span><small style="color:var(--muted)">（靶值 ${q.target}）</small>`)}
                ${W.td('规则', W.tag('t-red', d.rule))}
                ${W.td('状态', d.status === 'closed' ? W.tag('t-green', '已闭环') : W.tag('t-orange', '待处理'))}
                ${W.td('操作', d.status === 'closed' ? `<button class="btn btn-sm" onclick="W.views.qc.showDev('${d.id}')">查看</button>` : `<button class="btn btn-sm btn-primary" onclick="W.views.qc.openHandle('${d.id}')">处理</button>`)}
              </tr>`; }).join('')}
            ${!(db.qcDeviations || []).length ? `<tr><td colspan="6"><div class="tbl-empty">${W.icon('i-check', 'ic')}<div>暂无失控记录</div></div></td></tr>` : ''}
          </tbody></table></div></div>

        <div class="card"><div class="card-h">${W.icon('i-shield')} 质控品档案</div>
          ${db.qcProducts.map(q => `<div style="padding:13px 16px;border-bottom:1px solid #F2F3F8">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b style="font-size:13.5px">${W.esc(q.name)}</b>${W.tag(q.level === '高值' ? 't-orange' : 't-blue', q.level)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.7">
              批号 <span class="mono">${q.lot}</span> · ${q.itemCode} 项目 · 靶值 <b>${q.target}</b> ± SD ${q.sd} ${q.unit}<br>有效期至 ${q.expire}</div></div>`).join('')}
        </div>
      </div>`;

    W.ljChart(document.getElementById('qc-lj'), qc, points);
  },

  openEntry() {
    const db = W.db();
    W.modal(`<div class="modal-h"><b>质控数据录入</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <div class="form-item"><label>质控品 <em>*</em></label><select class="select" id="qc-entry-id">${db.qcProducts.map(q => `<option value="${q.id}">${q.name}（批号 ${q.lot} · 靶值 ${q.target}）</option>`).join('')}</select></div>
        <div class="form-item"><label>实测值 <em>*</em></label><input class="input" id="qc-entry-val" type="number" step="any" placeholder="输入本次质控测定值">
          <div class="form-err">请输入有效数值</div></div>
        <div style="font-size:12.5px;color:var(--muted)">${W.icon('i-alert', 'ic ic-xs')} 系统自动判定：超出 ±2s 触发警告，超出 ±3s 触发 1₃ₛ 失控并生成处理单</div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.qc.doEntry()">保存</button></div>`);
  },
  doEntry() {
    const qcId = document.getElementById('qc-entry-id').value;
    const v = parseFloat(document.getElementById('qc-entry-val').value);
    if (isNaN(v)) return W.toast('请输入有效数值', 'err');
    const q = W.api.qcById(qcId), db = W.db();
    const dev = Math.abs(v - q.target) / q.sd;
    db.qcData.push({ id: W.uid('QD'), qcId, ts: Date.now(), value: W.round(v, 2), operator: W.state.user.name });
    if (dev > 3) {
      db.qcDeviations.unshift({ id: W.uid('QV'), qcId, ts: Date.now(), value: W.round(v, 2), rule: '1₃ₛ', reason: null, action: null, operator: W.state.user.name, status: 'open' });
      W.api.pushMsg('qc', '质控失控预警', `${q.name}（批号 ${q.lot}）实测 ${W.round(v, 2)}，超出靶值 +3s，触发 1₃ₛ 失控规则`);
      W.toast('已录入：触发 1₃ₛ 失控！已生成失控处理单', 'err');
    } else if (dev > 2) {
      W.toast(`已录入：超出 ±2s 警告限（${dev.toFixed(1)}s），请关注`, 'info');
    } else W.toast('质控数据已录入，在控', 'ok');
    W.api.logAudit('质控数据录入', `${q.name} · ${W.round(v, 2)} ${q.unit}${dev > 2 ? ' · 触发' + (dev > 3 ? '1₃ₛ失控' : '±2s警告') : ''}`);
    W.store.save(); W.closeModal(); W.route(); W.refreshNav();
  },
  openHandle(id) {
    const d = W.db().qcDeviations.find(x => x.id === id);
    const q = W.api.qcById(d.qcId);
    W.modal(`<div class="modal-h"><b>失控处理</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <dl class="kv"><dt>质控品</dt><dd>${W.esc(q.name)}（批号 ${q.lot}）</dd><dt>失控值</dt><dd><b style="color:var(--danger)">${d.value} ${q.unit}</b>（靶值 ${q.target}，${W.round(Math.abs(d.value - q.target) / q.sd, 1)}s）</dd><dt>触发规则</dt><dd>${W.tag('t-red', d.rule)} Westgard</dd></dl>
        <div class="form-item"><label>失控原因 <em>*</em></label><input class="input" id="dv-reason" placeholder="如：质控品复溶异常 / 试剂批号更换 / 校准漂移"></div>
        <div class="form-item"><label>纠正措施 <em>*</em></label><textarea class="textarea" id="dv-action" placeholder="如：重新复溶质控品复测 / 重新校准仪器后复测在控"></textarea></div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.qc.doHandle('${id}')">确认闭环</button></div>`);
  },
  doHandle(id) {
    const reason = document.getElementById('dv-reason').value.trim(), action = document.getElementById('dv-action').value.trim();
    if (!reason || !action) return W.toast('请填写失控原因与纠正措施', 'err');
    const d = W.db().qcDeviations.find(x => x.id === id);
    d.reason = reason; d.action = action; d.status = 'closed';
    W.api.logAudit('质控失控处理', `${W.api.qcById(d.qcId).name} · ${d.rule} 闭环`);
    W.store.save(); W.closeModal(); W.route();
    W.toast('失控处理已闭环留痕', 'ok');
  },
  showDev(id) {
    const d = W.db().qcDeviations.find(x => x.id === id);
    const q = W.api.qcById(d.qcId);
    W.modal(`<div class="modal-h"><b>失控处理记录</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b"><dl class="kv">
        <dt>质控品</dt><dd>${W.esc(q.name)}（批号 ${q.lot}）</dd>
        <dt>失控值</dt><dd><b style="color:var(--danger)">${d.value} ${q.unit}</b>（${d.rule}）</dd>
        <dt>发生时间</dt><dd>${W.fmtDT(d.ts)}</dd>
        <dt>失控原因</dt><dd>${W.esc(d.reason || '—')}</dd>
        <dt>纠正措施</dt><dd>${W.esc(d.action || '—')}</dd>
        <dt>处理人</dt><dd>${W.esc(d.operator)}</dd>
      </dl></div>
      <div class="modal-f"><button class="btn btn-primary" onclick="W.closeModal()">关闭</button></div>`);
  },
};
