/* ============================================================
 * 智检 LIS - 视图：设备对接管理（档案 / 通信监控 / 模拟下发回传）
 * ============================================================ */
W.views.devices = {
  render(page) {
    const db = W.db();
    const logs = (db.commLogs || []).slice(0, 12);
    const stMap = { online: ['t-green', '在线'], warning: ['t-orange', '告警'], offline: ['t-gray', '离线'] };
    page.innerHTML = `
      <div class="page-head"><div><h2>设备对接管理</h2><div class="ph-sub">设备档案 · 双向通信（任务下发 / 结果回传）· 通信异常监控</div></div>
        <div class="ph-right"><button class="btn btn-primary" onclick="W.views.devices.openAdd()">${W.icon('i-plus', 'ic ic-sm')} 登记设备</button></div></div>

      <div class="grid g4" style="margin-bottom:14px">
        <div class="card stat-card"><div class="stat-ico" style="background:#EAF8F0;color:#16A34A"><svg class="ic"><use href="#i-monitor"/></svg></div><div><div class="stat-num">${db.devices.filter(d => d.status === 'online').length}</div><div class="stat-label">在线设备</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#FEF5E7;color:#D97706"><svg class="ic"><use href="#i-alert"/></svg></div><div><div class="stat-num">${db.devices.filter(d => d.status === 'warning').length}</div><div class="stat-label">通信告警</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#F0F1F6;color:#5B6172"><svg class="ic"><use href="#i-x"/></svg></div><div><div class="stat-num">${db.devices.filter(d => d.status === 'offline').length}</div><div class="stat-label">离线设备</div></div></div>
        <div class="card stat-card"><div class="stat-ico" style="background:#EAF1FE;color:#2563EB"><svg class="ic"><use href="#i-send"/></svg></div><div><div class="stat-num">${db.devices.reduce((a, d) => a + d.todayTasks, 0)}</div><div class="stat-label">今日累计任务</div></div></div>
      </div>

      <div class="grid g4" style="margin-bottom:14px">
        ${db.devices.map(d => { const [cls, label] = stMap[d.status];
          return `<div class="card dev-card">
            <div class="dev-status">${W.tag(cls, label)}<span class="dev-pulse ${d.status === 'online' ? 'on' : d.status === 'warning' ? 'warn' : 'off'}"></span></div>
            <b style="font-size:14.5px">${W.esc(d.name)}</b>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">${W.esc(d.type)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.8">
              协议：<span class="tag t-purple">${W.esc(d.proto)}</span><br>
              地址：<span class="mono">${d.ip}</span> · 今日任务 <b>${d.todayTasks}</b> 条
            </div>
            ${d.warnNote ? `<div style="margin-top:8px;font-size:12px;color:var(--warn);background:var(--warn-bg);border-radius:8px;padding:7px 10px">${W.esc(d.warnNote)}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn btn-sm" onclick="W.views.devices.sendTask('${d.id}')">${W.icon('i-send', 'ic ic-xs')} 下发任务</button>
              <button class="btn btn-sm" onclick="W.views.devices.mockReturn('${d.id}')">${W.icon('i-refresh', 'ic ic-xs')} 模拟回传</button>
              ${d.status !== 'online' ? `<button class="btn btn-sm btn-primary" onclick="W.views.devices.reconnect('${d.id}')">重连</button>` : ''}
            </div></div>`; }).join('')}
      </div>

      <div class="card"><div class="card-h">${W.icon('i-activity')} 通信日志<span class="ch-right" style="color:var(--muted);font-size:12px">最近 ${logs.length} 条 · 全程留痕</span></div>
        <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>时间</th><th>方向</th><th>设备</th><th>内容</th><th>结果</th></tr></thead><tbody>
          ${logs.length ? logs.map(l => `<tr>
            ${W.td('时间', W.fmtDT(l.ts))}
            ${W.td('方向', l.dir === 'send' ? W.tag('t-blue', '平台 → 设备') : W.tag('t-purple', '设备 → 平台'))}
            ${W.td('设备', W.esc(l.dev))}
            ${W.td('内容', W.esc(l.content))}
            ${W.td('结果', l.ok ? W.tag('t-green', '成功') : W.tag('t-red', '失败'))}
          </tr>`).join('') : `<tr><td colspan="5"><div class="tbl-empty">${W.icon('i-monitor', 'ic')}<div>暂无通信日志 · 点击设备卡片「下发任务 / 模拟回传」体验双向通信</div></div></td></tr>`}
        </tbody></table></div></div>`;
  },

  log(devName, dir, content, ok = true) {
    const db = W.db();
    db.commLogs = db.commLogs || [];
    db.commLogs.unshift({ id: W.uid('L'), ts: Date.now(), dev: devName, dir, content, ok });
    if (db.commLogs.length > 60) db.commLogs.length = 60;
    W.store.save();
  },
  sendTask(id) {
    const d = W.api.deviceById(id);
    const cand = W.db().samples.filter(s => s.status === 'received' || s.status === 'testing');
    if (!cand.length) return W.toast('没有可下发任务的样本（需已接收/检测中）', 'err');
    const s = W.pick(cand);
    if (s.status === 'received') W.flow.assign(s.id, id);
    this.log(d.name, 'send', `下发检测任务：${s.code}（${s.itemIds.length} 项）`);
    W.api.logAudit('任务下发', `${d.name} · ${s.code}`);
    W.store.save(); W.route();
    W.toast(`已向 ${d.name} 下发样本 ${s.code} 的检测任务`, 'ok');
  },
  mockReturn(id) {
    const d = W.api.deviceById(id);
    const testing = W.db().samples.filter(s => s.status === 'testing' && s.device === id);
    if (!testing.length) {
      this.log(d.name, 'send', '查询任务队列', true);
      W.store.save(); W.route();
      return W.toast(`${d.name} 队列中无待回传任务`, 'info');
    }
    const s = testing[0], results = {};
    for (const x of s.itemIds) {
      const it = W.api.itemById(x);
      const v = W.gauss((it.refLow + it.refHigh) / 2, (it.refHigh - it.refLow) / 6);
      results[x] = { value: W.round(v, it.decimals), flag: v > it.refHigh ? 'H' : v < it.refLow ? 'L' : null };
    }
    W.flow.submitResults(s.id, results);
    this.log(d.name, 'recv', `回传结果：${s.code} · ${Object.keys(results).length} 项`);
    W.api.logAudit('设备结果回传', `${d.name} · ${s.code}`);
    W.store.save(); W.route(); W.refreshNav();
    W.toast(`${d.name} 回传 ${s.code} 结果成功，报告待初审`, 'ok');
  },
  reconnect(id) {
    const d = W.api.deviceById(id);
    d.status = 'online'; d.warnNote = null; d.connSince = Date.now();
    this.log(d.name, 'send', '重建通信连接（心跳握手）', true);
    W.api.logAudit('设备重连', d.name);
    W.store.save(); W.route();
    W.toast(`${d.name} 重连成功，通信恢复`, 'ok');
  },
  openAdd() {
    W.modal(`<div class="modal-h"><b>登记设备</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <div class="form-item"><label>设备名称 <em>*</em></label><input class="input" id="dv-name" placeholder="如 迈瑞 BC-5150"></div>
        <div class="form-item"><label>设备类型</label><input class="input" id="dv-type" placeholder="如 全自动血细胞分析仪"></div>
        <div class="form-row">
          <div class="form-item"><label>通信协议</label><select class="select" id="dv-proto"><option>HL7 / TCP</option><option>LIS2-A2 / 串口</option><option>LIS2-A2 / TCP</option><option>文件桥接</option></select></div>
          <div class="form-item"><label>IP 地址</label><input class="input mono" id="dv-ip" placeholder="192.168.10.x"></div>
        </div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.devices.add()">保存</button></div>`);
  },
  add() {
    const name = document.getElementById('dv-name').value.trim();
    if (!name) return W.toast('请填写设备名称', 'err');
    const db = W.db();
    db.devices.push({ id: W.uid('DV'), name, type: document.getElementById('dv-type').value || '检验设备', proto: document.getElementById('dv-proto').value, ip: document.getElementById('dv-ip').value || '192.168.10.x', status: 'online', todayTasks: 0, connSince: Date.now() });
    W.api.logAudit('登记设备', name);
    W.store.save(); W.closeModal(); W.route();
    W.toast('设备已登记并接入监控', 'ok');
  },
};
