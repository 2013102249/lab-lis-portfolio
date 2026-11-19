/* ============================================================
 * 智检 LIS - 视图：报表统计（工作量 / TAT / 项目检出 / 质控汇总 / 导出）
 * ============================================================ */
W.views.reports = {
  render(page) {
    const db = W.db();
    const samples = db.samples;
    /* 近 7 日工作量 */
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d0 = new Date(); d0.setDate(d0.getDate() - i); d0.setHours(0, 0, 0, 0);
      const d1 = d0.getTime() + 86400000;
      days.push({
        k: `${d0.getMonth() + 1}/${d0.getDate()}`,
        v: samples.filter(s => s.createdAt >= d0.getTime() && s.createdAt < d1).length,
        tat: this.avgTat(samples.filter(s => s.receivedAt && s.createdAt >= d0.getTime() && s.createdAt < d1)),
      });
    }
    /* 项目检出 Top5（含结果的） */
    const cnt = {};
    samples.filter(s => s.results).forEach(s => s.itemIds.forEach(id => cnt[id] = (cnt[id] || 0) + 1));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, v]) => ({ k: W.api.itemById(id)?.name || id, v }));
    /* 质控汇总 */
    const qcTotal = db.qcData.length, qcViol = db.qcData.filter(d => { const q = W.api.qcById(d.qcId); return q && Math.abs(d.value - q.target) > 2 * q.sd; }).length;
    /* 科室分布 */
    const deptCnt = {};
    samples.forEach(s => deptCnt[s.dept] = (deptCnt[s.dept] || 0) + 1);
    const deptTop = Object.entries(deptCnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, v }));

    page.innerHTML = `
      <div class="page-head"><div><h2>报表统计</h2><div class="ph-sub">工作量 · TAT 周转 · 项目检出 · 质控汇总 · 支持导出 Excel（CSV）</div></div>
        <div class="ph-right">
          <button class="btn" onclick="W.views.reports.exportSamples()">${W.icon('i-download', 'ic ic-sm')} 导出样本明细</button>
          <button class="btn" onclick="W.views.reports.exportWorkload()">${W.icon('i-download', 'ic ic-sm')} 导出工作量报表</button>
        </div></div>

      <div class="grid g4" style="margin-bottom:14px">
        <div class="card stat-card"><div class="stat-ico" style="background:#EAF1FE;color:#2563EB"><svg class="ic"><use href="#i-tube"/></svg></div><div><div class="stat-num">${samples.length}</div><div class="stat-label">累计样本总数</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#EAF8F0;color:#16A34A"><svg class="ic"><use href="#i-clock"/></svg></div><div><div class="stat-num">${this.avgTat(samples.filter(s => s.publishedAt)) || '—'}<small>h</small></div><div class="stat-label">平均 TAT（接收→发布）</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#F3EEFD;color:#7C3AED"><svg class="ic"><use href="#i-shield"/></svg></div><div><div class="stat-num">${W.round((qcTotal - qcViol) / qcTotal * 100, 1)}<small>%</small></div><div class="stat-label">质控合格率（±2s 内）</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#FEF5E7;color:#D97706"><svg class="ic"><use href="#i-alert"/></svg></div><div><div class="stat-num">${samples.filter(s => s.results && Object.values(s.results).some(r => r.flag)).length}</div><div class="stat-label">含异常结果报告</div></div></div>
      </div>

      <div class="grid g2" style="margin-bottom:14px">
        <div class="card"><div class="card-h">${W.icon('i-chart')} 近 7 日样本量（份）</div><div class="card-b"><div class="chart-box" id="rp-bar"></div></div></div>
        <div class="card"><div class="card-h">${W.icon('i-clock')} TAT 周转趋势（小时）<span class="ch-right" style="color:var(--muted);font-size:12px">目标 ≤ 6h</span></div><div class="card-b"><div class="chart-box" id="rp-line"></div></div></div>
      </div>

      <div class="grid g32">
        <div class="card"><div class="card-h">${W.icon('i-db')} 科室申请分布</div><div class="card-b"><div class="chart-box" id="rp-dept"></div></div></div>
        <div class="card"><div class="card-h">${W.icon('i-activity')} 项目检出 TOP5</div>
          ${top.map((t, i) => `<div class="todo-item" style="cursor:default"><div class="todo-count" style="color:${['#7C3AED', '#2563EB', '#0E7490', '#D97706', '#5B6172'][i]}">${i + 1}</div><div class="todo-main"><div class="todo-title">${W.esc(t.k)}</div><div class="todo-sub">已出结果 ${t.v} 例</div></div></div>`).join('')}
        </div>
      </div>`;

    W.charts.bar(document.getElementById('rp-bar'), days.map(d => ({ k: d.k, v: d.v })), { unit: ' 份' });
    W.charts.line(document.getElementById('rp-line'), days.map(d => ({ k: d.k, v: d.tat ? d.tat : 0 })), { unit: 'h', target: 6, targetLabel: 'TAT 目标 6h' });
    W.charts.hbar(document.getElementById('rp-dept'), deptTop, { color: '#2563EB' });
  },

  avgTat(list) {
    const arr = list.map(s => { const t = W.api.tatMinutes(s); return s.publishedAt && t != null ? t : null; }).filter(x => x != null);
    return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length / 6) / 10 : null; // 小时，1 位小数
  },
  exportSamples() {
    const rows = [['样本条码', '患者', '性别', '年龄', '科室', '医生', '状态', '检验项目', '申请时间', '接收时间', '发布时间', 'TAT(分钟)']];
    W.db().samples.forEach(s => rows.push([
      s.code, s.patient, s.sex, s.age, s.dept, s.doctor, W.SAMPLE_STATUS[s.status].label,
      s.itemIds.map(x => W.api.itemById(x).name).join('；'),
      W.fmtDT(s.createdAt), s.receivedAt ? W.fmtDT(s.receivedAt) : '', s.publishedAt ? W.fmtDT(s.publishedAt) : '',
      W.api.tatMinutes(s) ?? '',
    ]));
    W.exportCSV(`样本明细_${W.fmtD(Date.now())}.csv`, rows);
  },
  exportWorkload() {
    const rows = [['日期', '样本量', '平均TAT(小时)', '发布报告数']];
    for (let i = 6; i >= 0; i--) {
      const d0 = new Date(); d0.setDate(d0.getDate() - i); d0.setHours(0, 0, 0, 0);
      const d1 = d0.getTime() + 86400000;
      const list = W.db().samples.filter(s => s.createdAt >= d0.getTime() && s.createdAt < d1);
      rows.push([W.fmtD(d0.getTime()), list.length, this.avgTat(list) ?? '', list.filter(s => s.publishedAt && s.publishedAt >= d0.getTime() && s.publishedAt < d1).length]);
    }
    W.exportCSV(`工作量报表_${W.fmtD(Date.now())}.csv`, rows);
  },
};
