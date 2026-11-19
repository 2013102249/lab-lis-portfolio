/* ============================================================
 * 智检 LIS - 视图：系统管理（用户角色 / 审计日志 / 基础字典）
 * ============================================================ */
W.views.system = {
  tab: 'users', auditKw: '',
  render(page) {
    const tabs = [['users', '用户与角色'], ['audit', '操作审计日志'], ['dict', '基础字典']];
    if (!tabs.find(t => t[0] === this.tab)) this.tab = 'users';
    page.innerHTML = `
      <div class="page-head"><div><h2>系统管理</h2><div class="ph-sub">账号权限 · 操作留痕（日志不可篡改）· 基础数据维护</div></div></div>
      <div class="tabs">${tabs.map(([v, l]) => `<button class="tab ${this.tab === v ? 'active' : ''}" onclick="W.views.system.tab='${v}';W.route()">${l}</button>`).join('')}</div>
      <div id="sys-body"></div>`;
    ({ users: this.tabUsers, audit: this.tabAudit, dict: this.tabDict })[this.tab].call(this, document.getElementById('sys-body'));
  },

  /* ---------- 用户与角色 ---------- */
  tabUsers(el) {
    const db = W.db();
    const perm = {
      tech: ['样本接收', '任务分配', '结果录入', '报告初审', '样本归档/销毁'],
      director: ['报告复审', '质控管理', '报表查看', '全部业务查看'],
      clinician: ['检验开单', '报告查询'],
      admin: ['账号权限', '基础字典', '系统配置', '审计日志'],
    };
    el.innerHTML = `<div class="grid g32">
      <div class="card"><div class="card-h">${W.icon('i-users')} 账号管理<span class="ch-right"><button class="btn btn-sm btn-primary" onclick="W.views.system.openUser()">${W.icon('i-plus', 'ic ic-xs')} 新增账号</button></span></div>
        <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>科室</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${db.users.map(u => { const r = W.ROLES[u.role];
            return `<tr>
              ${W.td('姓名', `<span style="display:inline-flex;align-items:center;gap:7px"><span class="user-ava" style="width:26px;height:26px;font-size:11px;background:${r.color}">${u.name[0]}</span>${W.esc(u.name)}</span>`)}
              ${W.td('账号', `<span class="mono">${u.username}</span>`)}
              ${W.td('角色', W.tag('t-purple', r.label))}
              ${W.td('科室', W.esc(u.dept))}
              ${W.td('状态', u.status === 'active' ? W.tag('t-green', '启用') : W.tag('t-red', '锁定'))}
              ${W.td('操作', `<div style="display:flex;gap:6px;justify-content:flex-end">
                ${u.status === 'active' ? `<button class="btn btn-sm" onclick="W.views.system.toggleUser('${u.id}')">锁定</button>` : `<button class="btn btn-sm btn-primary" onclick="W.views.system.toggleUser('${u.id}')">解锁</button>`}
                <button class="btn btn-sm" onclick="W.toast('已重置密码为初始密码，用户下次登录需修改','ok')">重置密码</button></div>`)}
            </tr>`; }).join('')}
        </tbody></table></div></div>
      <div class="card"><div class="card-h">${W.icon('i-shield')} 角色权限矩阵</div>
        ${Object.entries(perm).map(([role, list]) => { const r = W.ROLES[role];
          return `<div style="padding:13px 16px;border-bottom:1px solid #F2F3F8">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span class="user-ava" style="width:26px;height:26px;font-size:11px;background:${r.color}">${r.name[0]}</span><b style="font-size:13.5px">${r.label}</b></div>
            <div>${list.map(x => W.tag('t-gray', x)).join(' ')}</div></div>`; }).join('')}
        <div style="padding:12px 16px;font-size:12px;color:var(--muted)">${W.icon('i-alert', 'ic ic-xs')} 密码加密存储 · 连续 5 次错误自动锁定（防暴力破解）</div>
      </div></div>`;
  },
  openUser() {
    W.modal(`<div class="modal-h"><b>新增账号</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b">
        <div class="form-item"><label>姓名 <em>*</em></label><input class="input" id="nu-name"></div>
        <div class="form-item"><label>登录账号 <em>*</em></label><input class="input mono" id="nu-username" placeholder="字母 / 数字"></div>
        <div class="form-row">
          <div class="form-item"><label>角色 <em>*</em></label><select class="select" id="nu-role">${Object.entries(W.ROLES).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select></div>
          <div class="form-item"><label>科室</label><select class="select" id="nu-dept">${W.db().dicts.depts.map(d => `<option>${d}</option>`).join('')}</select></div>
        </div>
        <div style="font-size:12.5px;color:var(--muted)">初始密码 123456，首次登录强制修改（演示环境不校验）</div>
      </div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.system.addUser()">创建</button></div>`);
  },
  addUser() {
    const name = document.getElementById('nu-name').value.trim(), username = document.getElementById('nu-username').value.trim();
    if (!name || !username) return W.toast('请填写姓名与登录账号', 'err');
    const db = W.db();
    if (db.users.find(u => u.username === username)) return W.toast('账号已存在', 'err');
    const role = document.getElementById('nu-role').value;
    db.users.push({ id: W.uid('U'), username, name, role, dept: document.getElementById('nu-dept').value, phone: '', status: 'active', createdAt: Date.now() });
    W.api.logAudit('新增账号', `${username}（${W.ROLES[role].label}）`);
    W.store.save(); W.closeModal(); W.route();
    W.toast('账号已创建', 'ok');
  },
  toggleUser(id) {
    const u = W.db().users.find(x => x.id === id);
    u.status = u.status === 'active' ? 'locked' : 'active';
    W.api.logAudit(u.status === 'active' ? '解锁账号' : '锁定账号', u.username);
    W.store.save(); W.route();
    W.toast(`账号 ${u.username} 已${u.status === 'active' ? '解锁' : '锁定'}`, 'ok');
  },

  /* ---------- 审计日志 ---------- */
  tabAudit(el) {
    const db = W.db();
    let logs = db.audits;
    if (this.auditKw) { const k = this.auditKw; logs = logs.filter(a => (a.user + a.op + a.detail + a.role).includes(k)); }
    el.innerHTML = `<div class="card"><div class="card-h">${W.icon('i-file')} 操作审计日志<span class="ch-right tag t-purple">${db.audits.length} 条 · 全程留痕</span></div>
      <div class="card-b" style="padding-bottom:0"><div class="search-box" style="max-width:320px">${W.icon('i-search')}<input class="input" placeholder="搜索操作人 / 操作 / 内容" value="${W.esc(this.auditKw)}" oninput="W.views.system.auditKw=this.value;W.views.system.tabAudit(document.getElementById('sys-body'));this.querySelector&&0;document.querySelector('#sys-body .search-box .input').focus()"></div></div>
      <div class="table-wrap"><table class="tbl tbl-responsive"><thead><tr><th>时间</th><th>操作人</th><th>角色</th><th>操作</th><th>详情</th></tr></thead><tbody>
        ${logs.length ? logs.slice(0, 40).map(a => `<tr>
          ${W.td('时间', W.fmtDT(a.ts))}
          ${W.td('操作人', W.esc(a.user))}
          ${W.td('角色', W.tag('t-gray', W.esc(a.role)))}
          ${W.td('操作', `<b>${W.esc(a.op)}</b>`)}
          ${W.td('详情', `<span style="color:var(--muted)">${W.esc(a.detail)}</span>`)}
        </tr>`).join('') : `<tr><td colspan="5"><div class="tbl-empty">没有匹配的日志</div></td></tr>`}
      </tbody></table></div></div>`;
  },

  /* ---------- 基础字典 ---------- */
  tabDict(el) {
    const db = W.db();
    el.innerHTML = `<div class="grid g2">
      <div class="card"><div class="card-h">${W.icon('i-db')} 科室字典<span class="ch-right"><button class="btn btn-sm" onclick="W.views.system.addDict()">${W.icon('i-plus', 'ic ic-xs')} 新增</button></span></div>
        <div style="padding:14px 16px;display:flex;flex-wrap:wrap;gap:8px">
          ${db.dicts.depts.map((d, i) => `<span class="tag t-purple" style="font-size:13px;padding:6px 12px">${d}<a href="javascript:;" style="color:inherit;margin-left:5px" onclick="W.views.system.delDict(${i})">${W.icon('i-x', 'ic ic-xs')}</a></span>`).join('')}
        </div>
        <div style="padding:0 16px 14px;font-size:12px;color:var(--muted)">科室数据用于样本开单、统计报表等模块的下拉选项</div></div>
      <div class="card"><div class="card-h">${W.icon('i-db')} 其他基础数据</div>
        <div class="card-b">
          <dl class="kv">
            <dt>检验项目</dt><dd>${db.items.length} 项（在「检验业务 → 项目库」维护）</dd>
            <dt>质控品</dt><dd>${db.qcProducts.length} 个（在「质控管理」维护）</dd>
            <dt>接入设备</dt><dd>${db.devices.length} 台（在「设备管理」维护）</dd>
            <dt>数据存储</dt><dd>浏览器 localStorage · 内网部署时替换为 MySQL</dd>
            <dt>预留接口</dt><dd>REST API：/api/samples · /api/results · /api/his/sync（对接 HIS / 第三方设备）</dd>
          </dl>
        </div></div></div>`;
  },
  addDict() {
    W.modal(`<div class="modal-h"><b>新增科室</b><button class="icon-btn" onclick="W.closeModal()"><svg class="ic"><use href="#i-x"/></svg></button></div>
      <div class="modal-b"><div class="form-item"><label>科室名称 <em>*</em></label><input class="input" id="dict-name"></div></div>
      <div class="modal-f"><button class="btn" onclick="W.closeModal()">取消</button><button class="btn btn-primary" onclick="W.views.system.saveDict()">保存</button></div>`);
  },
  saveDict() {
    const v = document.getElementById('dict-name').value.trim();
    if (!v) return W.toast('请填写科室名称', 'err');
    if (W.db().dicts.depts.includes(v)) return W.toast('科室已存在', 'err');
    W.db().dicts.depts.push(v);
    W.api.logAudit('新增字典-科室', v);
    W.store.save(); W.closeModal(); W.route();
    W.toast('科室已添加', 'ok');
  },
  delDict(i) {
    const v = W.db().dicts.depts[i];
    W.confirmDialog('删除科室', `确认删除「${v}」？已引用该科室的历史数据不受影响。`, () => {
      W.db().dicts.depts.splice(i, 1);
      W.api.logAudit('删除字典-科室', v);
      W.store.save(); W.route(); W.toast('已删除', 'ok');
    });
  },
};
