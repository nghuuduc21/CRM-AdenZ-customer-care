// Customer Care Demo – trang quản trị chăm sóc khách hàng (JavaScript thuần, không cần build)
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const vnd = (n) => (n ? Math.round(n).toLocaleString('vi-VN') + ' đ' : '–');
const short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1).replace('.', ',') + ' tỷ' : n >= 1e6 ? Math.round(n / 1e6) + ' tr' : vnd(n));
const dt = (s) => (s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }) : '');
const day = (s) => (s ? new Date(s.length === 10 ? s + 'T00:00:00+07:00' : s).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const PROP = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
const CHURN = { high: 'Cao', medium: 'Vừa', low: 'Thấp' };
const STATUS = { draft: 'Đang soạn', approved: 'Đã duyệt', sending: 'Đang gửi', done: 'Đã gửi xong', cancelled: 'Đã dừng', queued: 'Chờ gửi', sent: 'Đã gửi', failed: 'Lỗi', skipped: 'Bỏ qua' };
const ROLE = { admin: 'Quản trị', boss: 'Sếp', marketing: 'Marketing', sale: 'Sale' };
const PRIO = { urgent: 'Gấp', today: 'Hôm nay', later: 'Khi rảnh' };

const S = { user: null, needsSetup: false, tab: lsGet('tab') || 'today', status: null };
function themeIsDark() { return document.documentElement.dataset.theme === 'dark'; }
function updateThemeButton() {
  const button = $('#theme-toggle');
  if (!button) return;
  const dark = themeIsDark();
  button.textContent = dark ? '☀️' : '🌙';
  button.setAttribute('aria-pressed', String(dark));
  button.title = dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';
}
function toggleTheme() {
  const dark = !themeIsDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  lsSet('theme', dark ? 'dark' : 'light');
  updateThemeButton();
}
function addThemeToggle() {
  const button = $('#theme-toggle');
  if (button) button.onclick = toggleTheme;
  updateThemeButton();
}
function lsGet(k) {
  try {
    return localStorage.getItem('care.' + k);
  } catch {
    return null;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem('care.' + k, v);
  } catch {}
}

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Care': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json() : await res.text();
  if (res.status === 401 && S.user && url !== '/api/login') {
    S.user = null;
    render();
  }
  if (!res.ok) throw new Error(data?.error || `Lỗi ${res.status}`);
  return data;
}
function toast(t, err) {
  const d = document.createElement('div');
  d.textContent = t;
  if (err) d.className = 'err';
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), err ? 7000 : 4000);
}
async function act(btn, fn, ok) {
  if (btn) btn.disabled = true;
  try {
    const r = await fn();
    if (ok) toast(typeof ok === 'function' ? ok(r) : ok);
    return r;
  } catch (e) {
    toast(e.message, true);
  } finally {
    if (btn) btn.disabled = false;
  }
}
const seg = (k) => (k ? `<span class="seg ${esc(k)}">${esc(S.status?.segments[k]?.label || k)}</span>` : '');

// ---------- đăng nhập ----------
function authView() {
  const setup = S.needsSetup;
  $('#app').innerHTML = `<div class="auth"><div class="card"><div class="brand" style="margin-bottom:10px"><img src="logo.png" alt="AdenZ Travel"><span class="care">AdenZ Travel</span></div>
<p class="hint">${setup ? 'Lần đầu sử dụng: tạo tài khoản quản trị (chỉ làm được trên máy chạy hệ thống).' : 'Chăm sóc khách hàng · Đăng nhập'}</p>
<form id="f">${setup ? '<label class="f"><span>Họ tên</span><input type="text" name="name" required></label>' : ''}
<label class="f"><span>Tên đăng nhập</span><input type="text" name="username" autocomplete="username" required></label>
<label class="f"><span>Mật khẩu</span><input type="password" name="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required></label>
<div class="actions"><button class="primary">${setup ? 'Tạo tài khoản' : 'Đăng nhập'}</button><span class="msg err" id="e"></span></div></form></div></div>`;
  const authThemeButton = document.createElement('button');
  authThemeButton.id = 'theme-toggle';
  authThemeButton.className = 'theme-toggle';
  authThemeButton.textContent = '🌙 Chế độ tối';
  $('.auth').prepend(authThemeButton);
  addThemeToggle();
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      const r = await api('POST', setup ? '/api/setup' : '/api/login', Object.fromEntries(new FormData(ev.target)));
      S.user = r.user;
      render();
    } catch (e) {
      $('#e').textContent = e.message;
    }
  };
}

// ---------- khung ----------
// Menu theo vai trò: sale chỉ thấy việc của mình và hồ sơ khách
// "Quy tắc giấy tờ", "Nhóm & ưu đãi" không còn trên menu: mở từ trang Cài đặt
const ALL_TABS = [
  ['today', 'Theo dõi chăm sóc'],
  ['kpi', 'Báo cáo'],
  ['customers', 'Khách hàng'],
  ['campaigns', 'Chiến dịch'],
  ['journeys', 'Chăm sóc tự động'],
  ['tours', 'Tour & dịch vụ'],
  ['dashboard', 'Phân tích khách hàng'],
  ['messages', 'Lịch sử gửi'],
  ['settings', 'Cài đặt'],
];
const HIDDEN_TABS = ['autolist'];
const ROLE_TABS = { sale: ['today', 'customers', 'tours'], marketing: ['today', 'kpi', 'campaigns', 'journeys', 'customers', 'tours', 'dashboard', 'messages'], boss: ['today', 'kpi', 'campaigns', 'journeys', 'customers', 'tours', 'dashboard', 'messages', 'settings'] };
const tabsFor = (role) => ALL_TABS.filter(([k]) => !ROLE_TABS[role] || ROLE_TABS[role].includes(k));
async function render() {
  if (!S.user) {
    const s = await api('GET', '/api/session');
    S.user = s.user;
    S.needsSetup = s.needsSetup;
  }
  if (!S.user) return authView();
  S.status = await api('GET', '/api/status');
  const TABS = tabsFor(S.user.role);
  if (!TABS.some(([k]) => k === S.tab) && !(HIDDEN_TABS.includes(S.tab) && S.user.role !== 'sale')) S.tab = TABS[0][0];
  $('#app').innerHTML = `<header class="top"><span class="brand"><img src="logo.png" alt="AdenZ Travel"><span class="care">AdenZ Travel</span>${S.status.demo ? '<span class="pill ok">DEMO</span>' : ''}</span><span class="who">${esc(S.user.name)} · ${esc(ROLE[S.user.role] || S.user.role)}</span><button id="out">Đăng xuất</button></header>
<div class="layout"><nav class="side">${TABS.map(([k, v]) => `<button data-tab="${k}" class="${k === S.tab ? 'active' : ''}">${v}</button>`).join('')}</nav><main id="main"><p class="loading">Đang tải…</p></main></div>`;
  const themeButton = document.createElement('button');
  themeButton.id = 'theme-toggle';
  themeButton.className = 'theme-toggle';
  themeButton.textContent = '🌙 Chế độ tối';
  $('#out').before(themeButton);
  addThemeToggle();
  $('#out').onclick = async () => {
    await api('POST', '/api/logout');
    S.user = null;
    render();
  };
  $$('nav.side button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
  try {
    await (V[S.tab] || V.today)();
  } catch (e) {
    $('#main').innerHTML = `<div class="banner err">${esc(e.message)}</div>`;
  }
}
function go(t) {
  S.tab = t;
  lsSet('tab', t);
  closeDrawer();
  render();
}
function banners() {
  const st = S.status;
  const b = [];
  if (S.user.role === 'sale') return '';
  if (st.demo) b.push('<div class="banner ok"><b>BẢN DEMO</b> · Dữ liệu hư cấu · Email chỉ mô phỏng</div>');
  else if (st.sample) b.push('<div class="banner warn">Đang dùng <b>DỮ LIỆU MẪU</b> (khách, đơn hư cấu). Vào <a href="#" data-go="settings">Cài đặt → Kết nối CRM</a> để dùng dữ liệu thật.</div>');
  if (!st.demo && st.testTo) b.push(`<div class="banner warn">Chế độ thử: mọi email đang chuyển về <b>${esc(st.testTo)}</b>.</div>`);
  if (!st.demo && !st.smtpReady) b.push('<div class="banner warn">Bộ gửi email chưa sẵn sàng: gửi chiến dịch, gửi thử và hành trình tự động đang bị khóa. Chưa có email nào được gửi đi. Vào <a href="#" data-go="settings">Cài đặt</a>.</div>');
  return b.join('');
}
function page(title, intro, body) {
  $('#main').innerHTML = `${banners()}<h1>${esc(title)}</h1>${intro ? `<p class="hint">${intro}</p>` : ''}${body}`;
  $$('[data-go]').forEach((a) =>
    (a.onclick = (e) => {
      e.preventDefault();
      go(a.dataset.go);
    })
  );
  $$('[data-cust]').forEach((el) =>
    (el.onclick = (e) => {
      e.preventDefault();
      openCustomer(Number(el.dataset.cust));
    })
  );
}

// ---------- hồ sơ khách (ngăn kéo) ----------
function closeDrawer() {
  $('#drawer')?.remove();
}
async function openCustomer(id) {
  closeDrawer();
  const p = await api('GET', '/api/customers/' + id);
  const c = p.customer;
  const s = p.score || {};
  const d = document.createElement('div');
  d.id = 'drawer';
  d.className = 'drawer';
  const opted = p.optOut.length > 0;
  d.innerHTML = `<button class="close" id="dc">Đóng</button>
<h2 style="margin-right:60px">${esc(c.name)} ${seg(s.segment)}</h2>
<div class="kv">
  <div>Mã khách</div><div>${esc(c.code)}</div>
  <div>Email</div><div>${esc(c.email || 'chưa có')}</div>
  <div>Điện thoại</div><div>${esc(c.phone || 'chưa có')}</div>
  <div>Sale phụ trách</div><div>${esc(c.sale_name)}</div>
  <div>Nguồn</div><div>${esc(c.source)}</div>
  ${c.birthday ? `<div>Ngày sinh</div><div>${esc(day(c.birthday))}</div>` : ''}
  <div>Trạng thái email trong Care</div><div>${opted ? '<span class="pill err">Đang chặn gửi</span>' : '<span class="pill ok">Chưa chặn gửi</span>'} <button id="opt" style="padding:2px 8px;font-size:12px">${opted ? 'Bỏ chặn' : 'Chặn gửi'}</button></div>
</div>
<div class="card"><h2>${s.kind === 'lead' ? `Điểm tiềm năng: ${s.lead_score}/100` : `Điểm RFM: R${s.r} · F${s.f} · M${s.m}`}</h2>
  <ul class="reasons">${(s.reasons || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
  <div class="kv">
    <div>Khả năng mua 90 ngày</div><div class="prop ${esc(s.propensity)}">${esc(PROP[s.propensity] || '–')}</div>
    <div>Điểm đến gợi ý</div><div><b>${esc(s.next_destination || '–')}</b></div>
    ${s.kind === 'buyer' ? `<div>Đã đi</div><div>${esc((s.visited || []).join(', ') || '–')}</div><div>Hay đi tháng</div><div>${s.best_month ? 'Tháng ' + s.best_month : '–'}</div><div>Nguy cơ rời bỏ</div><div>${esc(CHURN[s.churn_risk] || '–')}</div><div>Tổng chi</div><div>${vnd(s.total_spend)}</div>` : ''}
  </div>
</div>
${c.tier ? `<p style="margin:-4px 0 12px"><span class="pill ok">Hạng ${esc(c.tier)}</span>${c.is_b2b ? ' <span class="pill">Đại lý / doanh nghiệp</span>' : ''}</p>` : c.is_b2b ? '<p style="margin:-4px 0 12px"><span class="pill">Đại lý / doanh nghiệp</span></p>' : ''}
${p.surveys.length ? `<h2>Khảo sát sau chuyến đi</h2><ul class="reasons">${p.surveys.map((x) => `<li>${esc(x.trip_name || x.code || '')}: ${x.answered_at ? `<b class="${x.score <= 6 ? 'msg err' : ''}">${x.score}/10</b>${x.comment ? ` · "${esc(x.comment)}"` : ''}` : 'chưa trả lời'} · gửi ${day(x.sent_at)}</li>`).join('')}</ul>` : ''}
${p.tasks.length ? `<h2>Việc chăm sóc</h2><ul class="reasons">${p.tasks.map((t) => `<li>${t.status === 'done' ? '✓' : '○'} ${esc(t.title)}${t.outcome ? ` · <i>${esc(t.outcome)}</i>` : ''}${t.done_by ? ` · ${esc(t.done_by)}` : ''}</li>`).join('')}</ul>` : ''}
${p.leadOutcomes.length ? `<p class="hint">Lý do chưa mua: ${p.leadOutcomes.map((x) => esc(x.reason)).join(', ')}${p.leadOutcomes[0].nurture_until ? ` · nuôi dưỡng đến ${day(p.leadOutcomes[0].nurture_until)}` : ''}</p>` : ''}
<h2>Đơn hàng (${p.orders.length})</h2>
<div class="scroll"><table class="t"><tr><th>Đơn</th><th>Tour</th><th>Khởi hành</th><th>Trạng thái</th><th>Thanh toán</th><th>Tổng</th><th>Đã trả</th><th>Còn nợ</th></tr>
${p.orders.map((o) => `<tr><td>${esc(o.code)}</td><td>${esc(o.trip_name)}</td><td>${day(o.departure)}</td><td>${esc(o.status_title || '–')}</td><td>${esc(o.payment_state || '–')}</td><td>${vnd(o.total)}</td><td>${vnd(o.paid)}</td><td>${vnd(o.remaining)}</td></tr>`).join('') || '<tr><td colspan="8" class="hint">Chưa có đơn</td></tr>'}</table></div>
${p.receipts.length ? `<h3>Phiếu thu / hoàn tiền (${p.receipts.length})</h3><div class="scroll"><table class="t"><tr><th>Mã phiếu</th><th>Loại giao dịch</th><th>Ngày</th><th>Trạng thái</th><th>Phương thức</th><th>Số tiền gốc</th></tr>
${p.receipts.map((r) => `<tr><td>${esc(r.code)}</td><td>${esc(r.transaction_type || '–')}</td><td>${day(r.payment_date)}</td><td>${esc(r.approve_status || '–')}</td><td>${esc(r.payment_method || '–')}</td><td>${vnd(r.total_amount_source?.base)}</td></tr>`).join('')}</table></div>` : ''}
${p.leads.length ? `<h2 style="margin-top:16px">Yêu cầu tư vấn (${p.leads.length})</h2><ul class="reasons">${p.leads.map((l) => `<li>${esc(l.service)} · ${esc(l.source_state_title||l.status_title)} · ${day(l.created_at)}${l.source_quotes?.length ? ' · báo giá: '+l.source_quotes.map(q=>`${esc(q.code||'')}: ${esc(q.status||'')}${q.total_revenue?.base?` (${vnd(q.total_revenue.base)})`:''}`).join('; ') : ''}${l.sale_name?` · Sale: ${esc(l.sale_name)}`:''}</li>`).join('')}</ul>` : ''}
<h2 style="margin-top:16px">Tin đã gửi (${p.messages.length})</h2>
<ul class="reasons">${p.messages.map((m) => `<li><span class="status ${m.status}">${STATUS[m.status]}</span> ${esc(m.subject || m.reason || '')} · ${dt(m.sent_at || m.created_at)}${m.opened_at ? ' · đã mở' : ''}${m.clicked_at ? ' · đã bấm' : ''}</li>`).join('') || '<li>Chưa có</li>'}</ul>
${p.history.length ? `<h2 style="margin-top:16px">Thay đổi nhóm</h2><ul class="reasons">${p.history.map((h) => `<li>${dt(h.at)}: ${esc(S.status.segments[h.from_segment]?.label || h.from_segment)} → ${esc(S.status.segments[h.to_segment]?.label || h.to_segment)}</li>`).join('')}</ul>` : ''}`;
  document.body.appendChild(d);
  $('#dc').onclick = closeDrawer;
  $('#opt').onclick = (e) => act(e.target, () => api('POST', `/api/customers/${id}/optout`, { optOut: !opted }), 'Đã cập nhật').then(() => openCustomer(id));
}

// ---------- menu bấm chọn nhanh ----------
function menu(anchor, hint, items, onPick) {
  $$('.menu-list').forEach((m) => m.remove());
  const m = document.createElement('div');
  m.className = 'menu-list';
  m.innerHTML = `<div class="hint">${esc(hint)}</div>` + items.map((x, i) => `<button type="button" data-i="${i}">${esc(x)}</button>`).join('');
  anchor.parentElement.style.position = 'relative';
  anchor.parentElement.appendChild(m);
  $$('button', m).forEach((b) => (b.onclick = (e) => (e.stopPropagation(), m.remove(), onPick(items[Number(b.dataset.i)]))));
  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
}
// Giờ nhắc lại (giờ Việt Nam)
function snoozeAt(label) {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 3600e3);
  const ymd = (d) => d.toISOString().slice(0, 10);
  if (label.startsWith('Chiều')) {
    const t = new Date(`${ymd(vn)}T15:00:00+07:00`);
    return (t > now ? t : new Date(now.getTime() + 3600e3)).toISOString();
  }
  if (label.startsWith('Sáng')) return new Date(`${ymd(new Date(vn.getTime() + 864e5))}T09:00:00+07:00`).toISOString();
  return new Date(`${ymd(new Date(vn.getTime() + ((8 - vn.getUTCDay()) % 7 || 7) * 864e5))}T09:00:00+07:00`).toISOString();
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------- các trang ----------
const V = {
  async autolist() {
    let preview;
    const selectedJourney = lsGet('audienceJourney');
    const vnToday=new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
    let previewDate=lsGet('autoPreviewDate')||vnToday;
    const load = async () => { preview = await api('GET', '/api/journeys/preview?date='+encodeURIComponent(previewDate)); draw(); };
    const draw = () => {
      const rows = preview.schedulerReady ? (preview.recipients || preview.items).filter(x=>!selectedJourney||x.journey===selectedJourney) : [];
      const approved = rows.filter(x => x.approved && x.eligible).length;
      const canApprove = ['admin','boss'].includes(S.user.role);
      const groups = Object.groupBy ? Object.groupBy(rows,x=>x.journey) : rows.reduce((o,x)=>((o[x.journey] ||= []).push(x),o),{});
      const body = !preview.schedulerReady ? `<div class="card"><b>Chưa tính được danh sách người nhận.</b><p class="hint">${esc(preview.reason || 'Bộ lập lịch chăm sóc chưa được triển khai.')}</p><p class="hint">Bộ tính lịch chưa trả được kết quả. Thử tải lại hoặc kiểm tra kết nối cơ sở dữ liệu.</p></div>` : Object.entries(groups).map(([journey,list])=>`<details class="card auto-group" open><summary><b>${esc(list[0].label)}</b> <span class="pill">${list.length} người</span> <span class="pill ok">${list.filter(x=>x.approved&&x.eligible).length} duyệt</span> <span class="pill warn">${list.filter(x=>x.eligible&&!x.approved).length} chờ duyệt</span> <span class="pill err">${list.filter(x=>x.blocked).length} bị chặn</span></summary><div class="scroll"><table class="t"><tr><th>${canApprove?'Duyệt':'Trạng thái'}</th><th>Khách nhận</th><th>Email</th><th>Sale phụ trách</th><th>Nội dung</th><th>Lý do chọn</th><th>Trạng thái</th></tr>${list.map(x=>`<tr data-auto="${esc(x.key)}"><td>${canApprove?`<input type="checkbox" data-auto-check ${x.approved?'checked':''} ${!x.eligible?'disabled':''}>`:`<span class="pill ${x.approved?'ok':'warn'}">${x.approved?'Được duyệt':'Chưa duyệt'}</span>`}</td><td>${esc(x.name||'—')}</td><td>${esc(x.to||'Chưa có email')}</td><td>${esc(x.handler||'Chưa phân công')}</td><td><details class="inline"><summary>${esc(x.subject||'')}</summary><pre style="white-space:pre-wrap;max-width:420px">${esc(x.body||'')}</pre></details></td><td>${esc(x.reason||'')}</td><td>${x.blocked?`<span class="pill err">${esc(x.blockReason||'Không đủ điều kiện')}</span>`:`<span class="pill ${x.approved?'ok':'warn'}">${x.approved?'Đã duyệt':'Chờ duyệt'}</span><div class="hint">Mốc dự kiến: ${dt(x.due_at)}</div>`}</td></tr>`).join('')}</table></div></details>`).join('') || '<div class="card">Không có khách thỏa quy tắc chăm sóc đến hạn ngày ${day(preview.today)}.</div>';
      page('Chăm sóc tự động · Danh sách người nhận', preview.schedulerReady ? 'Danh sách lượt đến hạn, gồm email đủ điều kiện và trường hợp bị chặn kèm lý do.' : 'Lịch chăm sóc chưa có bộ tính người nhận; các con số chưa được xác định.', `<div class="card"><div class="settings-title"><div><h2>${preview.schedulerReady ? `${rows.length} lượt ngày ${day(preview.today)} · ${rows.filter(x=>x.eligible).length} có email đủ điều kiện` : 'Chưa tính người nhận và email đến hạn'}</h2><p class="hint">${preview.schedulerReady ? `${approved} được duyệt · ${rows.filter(x=>x.eligible&&!x.approved).length} chờ duyệt · ${rows.filter(x=>x.blocked).length} bị chặn${selectedJourney?` · đang lọc: ${esc(rows[0]?.label||selectedJourney)}`:''}` : 'Số 0 trước đây là placeholder, không phải kết quả rà dữ liệu.'}</p></div><div class="actions">${selectedJourney?'<button id="clear-audience-filter">Xem tất cả hành trình</button>':''}<label class="f" style="margin:0"><span>Ngày tính (demo có thể mô phỏng)</span><input id="auto-preview-date" type="date" value="${esc(previewDate)}"></label><button id="refresh-auto">Làm mới danh sách</button>${canApprove&&preview.schedulerReady?'<button id="all-auto">Duyệt tất cả đang hiển thị</button><button id="none-auto">Từ chối tất cả đang hiển thị</button><button class="primary" id="save-auto">Lưu trạng thái</button>':''}</div></div>${canApprove&&preview.schedulerReady?'<p class="hint">Email chưa được duyệt sẽ không được đưa vào lượt gửi tự động.</p>':''}</div>${body}${canApprove&&preview.schedulerReady?`<div class="card"><button class="primary" id="run-approved" disabled title="Bộ chạy hành trình chưa được triển khai">Chạy email đến hạn đã duyệt</button> <span class="msg" id="auto-result">Bộ chạy hành trình chưa sẵn sàng; không có email nào được gửi.</span></div>`:''}<iframe class="preview" id="auto-frame" title="Nội dung email" sandbox="allow-popups allow-popups-to-escape-sandbox" style="display:none"></iframe>`);
      $('#refresh-auto').onclick=()=>load();
      $('#auto-preview-date').onchange=(e)=>{previewDate=e.target.value||vnToday;lsSet('autoPreviewDate',previewDate);load()};
      if($('#clear-audience-filter'))$('#clear-audience-filter').onclick=()=>{lsSet('audienceJourney','');go('autolist')};
      if($('#all-auto'))$('#all-auto').onclick=()=>$$('[data-auto-check]').forEach(x=>x.checked=true);
      if($('#none-auto'))$('#none-auto').onclick=()=>$$('[data-auto-check]').forEach(x=>x.checked=false);
      if($('#save-auto'))$('#save-auto').onclick=async e=>{const decision=Object.fromEntries(rows.map(x=>[x.key,$(`[data-auto="${CSS.escape(x.key)}"] [data-auto-check]`)?.checked===true]));const saved=await act(e.target,()=>api('PUT','/api/journeys/recipients',{approved:decision}),'Đã lưu trạng thái duyệt');if(saved)await load()};
      if($('#run-approved'))$('#run-approved').onclick=async e=>{const r=await act(e.target,()=>api('POST','/api/journeys/run'),x=>`Đã mô phỏng ${x.sentNow} email · ${x.skipped} email không gửi`);if(r)$('#auto-result').textContent=`Đã mô phỏng ${r.sentNow} email đã duyệt; bỏ qua ${r.skipped} email.`};
    };
    await load();
  },
  async dashboard() {
    const d = await api('GET', '/api/dashboard');
    const segs = S.status.segments;
    const buyerSeg = Object.keys(segs).filter((k) => segs[k].kind === 'buyer');
    const leadSeg = Object.keys(segs).filter((k) => segs[k].kind === 'lead');
    const cnt = Object.fromEntries(d.segments.map((x) => [x.segment, x.n]));
    const bars = (keys) => {
      const max = Math.max(1, ...keys.map((k) => cnt[k] || 0));
      return `<div class="bars">${keys.map((k) => `<div class="bar"><span>${seg(k)}</span><div class="track"><div class="fill" style="width:${((cnt[k] || 0) / max) * 100}%"></div></div><b>${cnt[k] || 0}</b></div>`).join('')}</div>`;
    };
    const list = (rows, extra) =>
      `<table class="t">${rows.map((r) => `<tr class="click" data-cust="${r.id}"><td>${esc(r.name)}<div class="hint" style="margin:0">${esc(r.sale_name)}</div></td><td>${seg(r.segment)}</td><td>${extra(r)}</td></tr>`).join('') || '<tr><td class="hint">Không có</td></tr>'}</table>`;
    const k = d.kpi;
    page(
      'Phân tích khách hàng',
      `Dữ liệu cập nhật ${S.status.lastSync ? dt(S.status.lastSync.at) : '–'}. Bấm tên khách để xem hồ sơ.`,
      `<div class="grid">
  <div class="stat"><div class="k">Khách đã mua</div><div class="v">${k.buyers || 0}</div><div class="hint" style="margin:0">${k.repeatBuyers || 0} khách mua từ 2 lần</div></div>
  <div class="stat"><div class="k">Đã tương tác, chưa mua</div><div class="v">${k.leads || 0}</div></div>
  <div class="stat ok"><div class="k">Khả năng mua cao (90 ngày)</div><div class="v">${k.likely || 0}</div></div>
  <div class="stat err"><div class="k">Tiềm năng nóng</div><div class="v">${k.hot || 0}</div></div>
  <div class="stat warn"><div class="k">Nguy cơ rời bỏ</div><div class="v">${k.churn || 0}</div></div>
  <div class="stat"><div class="k">Đã từ chối nhận tin</div><div class="v">${k.optOut || 0}</div></div>
  <div class="stat"><div class="k">Việc cần làm cho sale</div><div class="v">${k.openTasks || 0}</div></div>
</div>
<div class="two" style="margin-top:16px">
  <div class="card"><h2>Khách đã mua theo nhóm</h2>${bars(buyerSeg)}</div>
  <div class="card"><h2>Khách tiềm năng theo mức</h2>${bars(leadSeg)}<p class="hint">Nóng ≥ 70 điểm · Ấm 40–69 · Nguội &lt; 40</p></div>
</div>
<div class="two">
  <div class="card"><h2>Tiềm năng nóng: nên liên hệ ngay</h2>${list(d.hot, (r) => `<b>${r.lead_score}</b> điểm<div class="hint" style="margin:0">quan tâm ${esc(r.next_destination || '–')}</div>`)}</div>
  <div class="card"><h2>Khách cũ có khả năng mua cao</h2>${list(d.likely, (r) => `gợi ý <b>${esc(r.next_destination || '–')}</b>${r.best_month ? `<div class="hint" style="margin:0">hay đi tháng ${r.best_month}</div>` : ''}`)}</div>
</div>
<div class="two">
  <div class="card"><h2>Khách quen có nguy cơ rời bỏ</h2>${list(d.churn, (r) => `<span class="prop low">${esc((r.reasons || []).find((x) => x.startsWith('Lần đặt')) || '')}</span>`)}</div>
  <div class="card"><h2>Chiến dịch gần đây</h2><table class="t">${d.campaigns.map((c) => `<tr><td>${esc(c.name)}</td><td><span class="status ${c.status}">${STATUS[c.status]}</span></td><td>${c.report.sent} gửi · ${c.report.opened} mở · ${c.report.clicked} bấm · <b>${c.report.buyers ?? '–'}</b> mua</td></tr>`).join('') || '<tr><td class="hint">Chưa có chiến dịch. <a href="#" data-go="campaigns">Tạo chiến dịch</a></td></tr>'}</table></div>
</div>`
    );
  },

  async today() {
    const days = Number(lsGet('monDays') || 7);
    const d = await api('GET', '/api/monitor?days=' + days);
    const kinds = S.status.taskKinds;
    const J = S.status.journeys;
    const row = (k) => d.kpi.rows.find((r) => r.key === k) || {};
    const v = (r) => (r.value == null ? '–' : `${r.value}${r.unit || ''}`);
    const tile = (k, label, cls = '') => `<div class="stat ${cls}"><div class="k">${esc(label || row(k).label)}</div><div class="v">${esc(v(row(k)))}</div>${row(k).note ? `<div class="hint" style="margin:0">${esc(row(k).note)}</div>` : ''}</div>`;
    const groups = ['urgent', 'today', 'later'].map((p) => [p, d.alerts.filter((t) => (t.priority || 'today') === p)]);
    const alert = (t) => {
      const late = t.due && new Date(t.due) < new Date();
      return `<div class="alert-row ${t.priority === 'urgent' ? 'urgent' : ''}">
  <div class="main"><div><span class="pill">${esc(kinds[t.kind]?.label || t.kind)}</span> ${t.customer_id ? `<a href="#" data-cust="${t.customer_id}"><b>${esc(t.name || 'Khách')}</b></a>` : ''}${t.tier ? ` <span class="pill ok">${esc(t.tier)}</span>` : ''} · ${esc(t.title)}</div>
  <div class="hint" style="margin:2px 0 0">${esc(t.detail || '')}</div>
  <div class="hint" style="margin:2px 0 0">Phụ trách: <b>${esc(t.sale_name || (t.sale_id ? '#' + t.sale_id : 'Sếp / chưa giao'))}</b>${t.due ? ` · <span class="${late ? 'msg err' : ''}">${late ? 'quá hạn' : 'hạn'} ${dt(t.due)}</span>` : ''}${t.script ? ` · <details class="inline"><summary>gợi ý cách nói</summary><p>${esc(t.script.replaceAll('{sale}', 'em'))}</p></details>` : ''}</div></div>
  ${t.tw_link ? `<a class="btn-link" href="${esc(t.tw_link)}" target="_blank" rel="noopener">Mở trên CRM</a>` : ''}</div>`;
    };
    const FEED = { open: '👁', click: '🖱', survey: '★', bad: '⚠', optout: '✕', order: '✓', lead: '?', partner: '✉' };
    page(
      'Theo dõi chăm sóc',
      'Nhân viên làm việc trên CRM như bình thường. Trang này cho thấy Customer Care Demo đã chăm sóc khách thế nào, khách phản hồi ra sao, và những khách cần nhân viên xử lý (tự hết khi CRM có ghi nhận).',
      `<div class="filters"><select id="md">${[7, 30, 90].map((n) => `<option value="${n}" ${n === days ? 'selected' : ''}>${n} ngày qua</option>`).join('')}</select></div>
<div class="grid">
  ${tile('sent')}${tile('open', 'Khách mở email')}${tile('click', 'Khách bấm xem')}${tile('score', 'Điểm hài lòng')}
  ${tile('conv', 'Khách đặt đơn sau khi nhận tin', 'ok')}${tile('pay', 'Đơn được nhắc đã trả đủ')}${tile('pickup', 'Tiếp nhận lead (trung vị)')}${tile('alerts', 'Cảnh báo được xử lý trên CRM')}
</div>
<div class="two" style="margin-top:16px">
  <div>
    <h2>Khách cần nhân viên xử lý (${d.alerts.length})</h2>
    <p class="hint">Người phụ trách đã nhận email. Khi lead đổi trạng thái, khách trả đủ tiền hoặc CRM có ghi nhận chăm sóc mới, mục tự đóng. Quá ${esc(String(S.status.alertDays || 14))} ngày không thấy xử lý thì tính là "hết hạn".</p>
    ${groups.map(([p, list]) => (list.length ? `<div class="section"><div class="section-title ${p}">${PRIO[p]} (${list.length})</div><div class="card" style="padding:0">${list.map(alert).join('')}</div></div>` : '')).join('') || '<div class="card hint">Không có khách nào cần xử lý.</div>'}
    ${d.handled.length ? `<div class="section"><div class="section-title">Đã xử lý / hết hạn gần đây</div><div class="card"><ul class="reasons">${d.handled.map((x) => `<li>${x.status === 'expired' ? '<span class="msg err">hết hạn</span>' : '✓'} <b>${esc(x.name || '')}</b> · ${esc(x.title)} · <i>${esc(x.outcome || '')}</i></li>`).join('')}</ul></div></div>` : ''}
  </div>
  <div>
    <h2>Khách tương tác</h2>
    <div class="card feed">${d.feed.map((e) => `<div class="ev ${e.kind}"><span class="ic">${FEED[e.kind] || '•'}</span><div><a href="#" data-cust="${e.customerId}"><b>${esc(e.name)}</b></a> ${esc(e.text)}<div class="hint" style="margin:0">${dt(e.at)}</div></div></div>`).join('') || '<p class="hint">Chưa có tương tác trong kỳ. Khi khách mở email, bấm xem tour, chấm điểm khảo sát, hủy nhận tin, hoặc đặt đơn / hỏi tư vấn trên CRM sau khi nhận tin, sự việc sẽ hiện ở đây.</p>'}</div>
  </div>
</div>
<div class="card"><h2>Trao đổi với đối tác</h2><p class="hint">Yêu cầu đại lý, doanh nghiệp gửi từ nút "Gửi yêu cầu cho Nhóm demo" trong email (thư trả lời trực tiếp thì về hộp thư nhân viên phụ trách). Tự đánh dấu đã xử lý khi CRM có lead, đơn hoặc ghi nhận chăm sóc mới.</p>
<div class="scroll"><table class="t"><tr><th>Đối tác</th><th>Yêu cầu</th><th>Nội dung</th><th>Lúc</th><th>Phụ trách</th><th>Trạng thái</th></tr>
${d.partners.map((x) => `<tr><td><a href="#" data-cust="${x.customer_id}"><b>${esc(x.name || '')}</b></a><div class="hint" style="margin:0">${esc(x.sub_group || '')}</div></td><td>${esc(x.kind)}</td><td>${esc(x.message)}${x.pax ? ` · ${x.pax} khách` : ''}${x.wanted ? ` · ${esc(x.wanted)}` : ''}</td><td>${dt(x.at)}</td><td>${esc(x.sale_name || '')}</td><td>${x.task_status === 'done' ? `<span class="pill ok">Đã xử lý</span><div class="hint" style="margin:0">${esc(x.outcome || '')}</div>` : x.task_status === 'expired' ? '<span class="pill err">Hết hạn</span>' : '<span class="pill warn">Đang chờ</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Chưa có yêu cầu nào từ đối tác.</td></tr>'}</table></div></div>
<div class="card"><h2>Hiệu quả từng loại tin (30 ngày)</h2><div class="scroll"><table class="t"><tr><th>Loại tin</th><th>Đã gửi</th><th>Mở</th><th>Bấm</th><th>Kết quả mong đợi</th><th>Đạt</th></tr>
${d.effect.map((r) => `<tr><td>${esc(r.campaign ? 'Chiến dịch: ' + r.campaign : J[r.key]?.label || r.key)}</td><td>${r.sent}</td><td>${r.opened} <span class="hint">(${Math.round((r.opened / r.sent) * 100)}%)</span></td><td>${r.clicked}</td><td class="hint">${esc(r.result || 'Tin thông tin, không đo')}</td><td>${r.results == null ? '–' : `<b>${r.results}</b> <span class="hint">(${Math.round((r.results / r.sent) * 100)}%)</span>`}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Chưa gửi tin nào. Vào Chăm sóc tự động → Chạy ngay.</td></tr>'}</table></div></div>`
    );
    $('#md').onchange = () => (lsSet('monDays', $('#md').value), render());
  },

  async kpi() {
    const days = Number(lsGet('kpiDays') || 7);
    const k = await api('GET', '/api/kpi?days=' + days);
    const val = (r) => (r.value == null ? '–' : `${r.value}${r.unit || ''}`);
    const tr = k.trend || [];
    const max = Math.max(1, ...tr.map((r) => Math.max(r.sent, r.opened, r.buyers)));
    const W = 720, H = 190, P = 34;
    const x = (i) => (tr.length <= 1 ? W / 2 : P + (i * (W - 2 * P)) / (tr.length - 1));
    const y = (v) => H - P - (v * (H - 2 * P)) / max;
    const line = (key) => tr.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ');
    const series = [['sent', 'Đã gửi', 'var(--navy-2)'], ['opened', 'Khách mở', '#175cd3'], ['buyers', 'Khách đặt đơn', '#9e165f']];
    const points = (key, label) => tr.map((r, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(r[key]).toFixed(1)}" r="2.6"><title>${day(r.day)} · ${label}: ${r[key]}</title></circle>`).join('');
    const chart = tr.length
      ? `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Xu hướng chăm sóc theo ngày" style="width:100%;height:auto;display:block">
<line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="var(--line)"/>
<text x="${P}" y="${20}" font-size="11" fill="var(--muted)">tối đa ${max} tin/ngày</text>
${series.map(([key, label, color]) => `<g><path d="${line(key)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${points(key, label)}</g>`).join('')}
</svg>
<div class="legend">${series.map(([key, label, color]) => `<span><i style="background:${color}"></i>${label}</span>`).join('')}</div>
<p class="hint" style="margin:4px 0 0">${day(tr[0].day)} – ${day(tr.at(-1).day)} · mỗi cụm ghi tổng theo ngày</p>`
      : '<p class="hint">Chưa có tin nào được gửi trong kỳ. Vào Chăm sóc tự động → Chạy ngay.</p>';
    page(
      'Báo cáo chăm sóc khách hàng',
      'Chỉ số theo Quy trình chăm sóc v1 (mục 6). Sếp nhận bản này qua email mỗi sáng thứ Hai.',
      `<div class="filters"><select id="kd">${[7, 30, 90].map((n) => `<option value="${n}" ${n === days ? 'selected' : ''}>${n} ngày qua</option>`).join('')}</select>
  ${['admin', 'boss'].includes(S.user.role) ? '<button id="ks">Gửi báo cáo qua email ngay</button>' : ''}</div>
<div class="card"><h2>Xu hướng theo ngày</h2>${chart}</div>
<div class="card scroll" style="padding:0"><table class="t"><tr><th>Chỉ số</th><th style="text-align:right">Kết quả</th><th style="text-align:right">Mục tiêu</th></tr>
${k.rows.map((r) => `<tr><td><b>${esc(r.label)}</b>${r.note ? `<div class="hint" style="margin:0">${esc(r.note)}</div>` : ''}</td><td style="text-align:right;font-size:16px"><b>${esc(val(r))}</b></td><td style="text-align:right">${esc(r.target || '')}</td></tr>`).join('')}</table></div>
<div class="card"><h2>Việc đang mở theo sale</h2><table class="t"><tr><th>Sale</th><th>Đang mở</th><th>Quá hạn</th></tr>${k.bySale.map((x) => `<tr><td>${esc(x.sale)}</td><td>${x.open}</td><td>${x.late ? `<span class="msg err">${x.late}</span>` : 0}</td></tr>`).join('') || '<tr><td colspan="3" class="hint">Không có</td></tr>'}</table></div>`
    );
    $('#kd').onchange = () => (lsSet('kpiDays', $('#kd').value), render());
    if ($('#ks')) $('#ks').onclick = (e) => act(e.target, () => api('POST', '/api/kpi/send'), (r) => r.simulated ? 'Đã mô phỏng báo cáo tuần' : (r.emails ? `Đã gửi tới ${r.emails} email` : 'Chưa có tài khoản Sếp/Quản trị nào có email'));
  },

  async customers() {
    const segs = S.status.segments;
    const [dests, sv] = await Promise.all([api('GET', '/api/destinations'), api('GET', '/api/services')]);
    page(
      'Khách hàng',
      'Khách đã mua và đã tương tác trên CRM: dịch vụ đã dùng, hạng thành viên, nhóm, dự đoán. Bấm một dòng để xem hồ sơ và lịch sử chăm sóc.',
      `<div class="filters">
  <input type="text" id="q" placeholder="Tìm tên, mã, email, SĐT">
  <select id="fs"><option value="">Mọi nhóm</option>${Object.entries(segs).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select>
  <select id="fp"><option value="">Mọi khả năng mua</option><option value="high">Khả năng mua cao</option><option value="medium">Trung bình</option><option value="low">Thấp</option></select>
  <select id="fd"><option value="">Mọi điểm đến</option>${dests.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
  <select id="fsv"><option value="">Mọi dịch vụ đã dùng</option>${sv.groups.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
  <select id="fpt"><option value="">Mọi loại khách</option><option value="1">Chỉ đối tác (đại lý, doanh nghiệp)</option></select>
  <select id="ft"><option value="">Mọi hạng</option>${['Kim cương', 'Vàng', 'Bạc', 'Tiêu chuẩn'].map((x) => `<option>${x}</option>`).join('')}</select>
</div>
<div class="card scroll" style="padding:0"><table class="t" id="tbl"></table></div>`
    );
    const load = async () => {
      const qs = new URLSearchParams({ q: $('#q').value, segment: $('#fs').value, propensity: $('#fp').value, dest: $('#fd').value, service: $('#fsv').value, tier: $('#ft').value, partner: $('#fpt').value });
      const rows = await api('GET', '/api/customers?' + qs);
      $('#tbl').innerHTML = `<tr><th>Khách</th><th>Dịch vụ đã dùng</th><th>Hạng</th><th>Nhóm</th><th>Điểm</th><th>Đã đi</th><th>Gợi ý tiếp theo</th><th>Mua 90 ngày</th><th>Tổng chi</th></tr>
${rows.map((r) => `<tr class="click" data-id="${r.id}"><td>${esc(r.name)}${r.opted_out ? ' <span class="pill err">từ chối</span>' : ''}${r.is_b2b ? ' <span class="pill">DN / đại lý</span>' : ''}<div class="hint" style="margin:0">${esc(r.code)} · ${esc(r.email || 'chưa có email')}</div></td><td>${r.services.map((x) => `<span class="pill">${esc(x)}</span>`).join(' ') || '<span class="hint">chưa mua</span>'}</td><td>${esc(r.tier || '')}</td><td>${seg(r.segment)}</td><td>${r.kind === 'lead' ? `<b>${r.lead_score}</b>/100` : `R${r.r} F${r.f} M${r.m}`}</td><td>${esc(r.visited.join(', '))}</td><td>${esc(r.next_destination || '')}</td><td class="prop ${r.propensity}">${PROP[r.propensity] || ''}</td><td>${vnd(r.total_spend)}</td></tr>`).join('') || '<tr><td colspan="9" class="hint">Không có khách phù hợp</td></tr>'}`;
      $$('#tbl tr[data-id]').forEach((tr) => (tr.onclick = () => openCustomer(Number(tr.dataset.id))));
    };
    let t;
    $('#q').oninput = () => (clearTimeout(t), (t = setTimeout(load, 250)));
    ['#fs', '#fp', '#fd', '#fsv', '#ft', '#fpt'].forEach((s) => ($(s).onchange = load));
    load();
  },

  async campaigns() {
    const list = await api('GET', '/api/campaigns');
    page(
      'Chiến dịch',
      'Gửi tour mới, ưu đãi, thông tin cho từng nhóm khách. Quy trình: Soạn → Xem trước, gửi thử → Duyệt → Gửi.',
      `<div class="actions" style="margin:0 0 12px"><button class="primary" id="new">+ Tạo chiến dịch</button></div>
<div class="card scroll" style="padding:0"><table class="t"><tr><th>Chiến dịch</th><th>Trạng thái</th><th>Gửi</th><th>Mở</th><th>Bấm</th><th>Hủy nhận</th><th>Mua lại (30 ngày)</th><th></th></tr>
${list
  .map((c) => {
    const r = c.report;
    const pct = (x) => (r.sent ? ` <span class="hint">(${Math.round((x / r.sent) * 100)}%)</span>` : '');
    return `<tr><td><b>${esc(c.name)}</b><div class="hint" style="margin:0">${esc(c.created_by)} · ${dt(c.created_at)}${c.approved_by ? ` · duyệt: ${esc(c.approved_by)}` : ''}</div></td><td><span class="status ${c.status}">${STATUS[c.status]}</span>${c.scheduled_at && ['draft', 'approved'].includes(c.status) ? `<div class="hint" style="margin:0">hẹn ${dt(c.scheduled_at)}</div>` : ''}</td><td>${r.sent}${r.queued ? ` <span class="hint">+${r.queued} chờ</span>` : ''}</td><td>${r.opened}${pct(r.opened)}</td><td>${r.clicked}${pct(r.clicked)}</td><td>${r.unsubscribed}</td><td><b>${r.buyers ?? '–'}</b>${r.revenue ? `<div class="hint" style="margin:0">${short(r.revenue)}</div>` : ''}</td><td><button data-open="${c.id}">Mở</button> <button data-dup="${c.id}" title="Tạo chiến dịch mới từ chiến dịch này">Nhân bản</button>${['draft','approved'].includes(c.status)&&![r.sent,r.queued,r.failed,r.skipped].some(Number)?` <button class="danger" data-delete-campaign="${c.id}">Xóa</button>`:''}</td></tr>`;
  })
  .join('') || '<tr><td colspan="8" class="hint">Chưa có chiến dịch.</td></tr>'}
</table></div>`
    );
    $('#new').onclick = () => editCampaign(null);
    $$('[data-open]').forEach((b) => (b.onclick = () => editCampaign(Number(b.dataset.open))));
    $$('[data-dup]').forEach((b) => (b.onclick = () => act(b, () => api('POST', `/api/campaigns/${b.dataset.dup}/duplicate`), 'Đã tạo bản sao').then((r) => r && editCampaign(r.id))));
    $$('[data-delete-campaign]').forEach((b) => (b.onclick = () => { if (confirm('Xóa chiến dịch chưa gửi này? Thao tác không thể hoàn tác.')) act(b, () => api('DELETE', `/api/campaigns/${b.dataset.deleteCampaign}`), 'Đã xóa chiến dịch').then((r) => r && go('campaigns')); }));
  },

  async journeys() {
    const j = await api('GET', '/api/journeys');
    const p = j.params;
    const audience = await api('GET', '/api/journeys/preview');
    const customData = await api('GET', '/api/journeys/custom');
    const canManageCustom = ['admin','boss'].includes(S.user.role);
    const customRows = customData.items || [];
    const audienceByJourney = Object.groupBy ? Object.groupBy(audience.recipients || [],x=>x.journey) : (audience.recipients||[]).reduce((o,x)=>((o[x.journey]||=[]).push(x),o),{});
    const audienceStats = new Map((audience.byJourney||[]).map(x=>[x.key,x]));
    page(
      'Chăm sóc tự động',
      audience.schedulerReady ? `Mốc tính người nhận mỗi ngày: ${esc(p.journeyTime)}. Hệ thống áp dụng từ chối nhận tin và giới hạn ${p.marketingPerWeek||2} email marketing/7 ngày; đây là bản xem trước, chưa tự gửi email.` : 'Không tính được lịch chăm sóc. Kiểm tra kết nối API và log máy chủ.',
      `<form class="card" id="jf">
  <table class="t"><tr><th>Bật</th><th>Hành trình</th><th>Loại</th><th>Người nhận</th><th>Đã gửi</th></tr>
  ${j.journeys.map((x) => {const a=audienceByJourney[x.key]||[];return `<tr><td><input type="checkbox" name="en_${x.key}" ${x.enabled ? 'checked' : ''}></td><td><b>${esc(x.label)}</b><div class="hint" style="margin:0">${esc(x.desc)}${audienceStats.get(x.key)?.rule?` · Quy tắc: ${esc(audienceStats.get(x.key).rule)}`:''}</div></td><td>${x.marketing ? '<span class="pill warn">Chăm sóc / quảng cáo</span>' : '<span class="pill">Giao dịch</span>'}</td><td>${audience.schedulerReady ? `${audienceStats.get(x.key)?.eligible||0} email đủ điều kiện · ${audienceStats.get(x.key)?.blocked||0} bị chặn · ${a.length} lượt đến hạn` : 'Chưa tính'} <button type="button" data-open-audience="${x.key}">Quản lý</button></td><td>${x.sent}</td></tr>`}).join('')}</table>
  <div class="row2" style="margin-top:12px">
    <label class="f"><span>Nhắc thanh toán khi còn (ngày)</span><input type="text" name="reminderDays" value="${esc(p.reminderDays.join(', '))}"></label>
    <label class="f"><span>Nhắc chuẩn bị trước (ngày)</span><input type="number" name="prepDays" value="${p.prepDays}" min="1" max="14"></label>
    <label class="f"><span>Gợi ý chuyến tiếp theo sau chuyến đi (ngày)</span><input type="number" name="postTripDays" value="${p.postTripDays}" min="7" max="365"></label>
    <label class="f"><span>Giờ chạy mỗi ngày</span><input type="time" name="journeyTime" value="${esc(p.journeyTime)}"></label>${p.partnerSeasons.map((season,i)=>`<label class="f"><span>Đối tác: gửi trước ${esc(season.name)}</span><select name="season_${i}">${[7,14,30].map(days=>`<option value="${days}" ${Number(season.daysBefore)===days?'selected':''}>${days} ngày trước</option>`).join('')}</select></label>`).join('')}
  </div>
  <h2 style="margin-top:12px">Mẫu tin chăm sóc</h2><p class="hint">Bật hành trình để tính người nhận theo lịch. Phần gửi thật vẫn đang tắt.</p>
  <p class="hint">Biến: <span class="vars"><code>{{ten}}</code> <code>{{sale}}</code> <code>{{diem_den_goi_y}}</code> <code>{{diem_den_da_di}}</code> <code>{{uu_dai}}</code> <code>{{diem_den_ky_niem}}</code> <code>{{link_danh_gia}}</code></span>.</p>
  ${j.journeys
    .filter((x) => x.template)
    .map((x) => `<details style="margin-bottom:8px"><summary><b>${esc(x.label)}</b></summary>
    <label class="f" style="margin-top:8px"><span>Tiêu đề</span><input type="text" name="sub_${x.key}" value="${esc(x.template.subject)}" style="max-width:none"></label>
    <label class="f"><span>Nội dung</span><textarea name="body_${x.key}" rows="6" style="max-width:none">${esc(x.template.body)}</textarea></label></details>`)
    .join('')}
  <div class="actions"><button class="primary">Lưu</button></div>
</form>
<div class="card" id="custom-automations"><div class="settings-title"><div><h2>Nội dung chăm sóc tự động</h2><p class="hint">Tạo nội dung, chọn nhóm khách và quản lý danh sách nhận ngay trong mục Chăm sóc tự động.</p></div>${canManageCustom?'<button class="primary" id="add-custom">+ Thêm nội dung</button>':''}</div>
<div id="custom-editor" style="display:none"></div>
<div class="scroll"><table class="t"><tr><th>Bật</th><th>Tên nội dung</th><th>Nhóm người nhận</th><th>Người nhận mẫu</th><th>Thao tác</th></tr>${customRows.map(x=>{const a=audienceByJourney['custom:'+x.id]||[],stat=audienceStats.get('custom:'+x.id);return `<tr><td><span class="pill ${x.enabled?'ok':'warn'}">${x.enabled?'Đang bật':'Đã tắt'}</span></td><td><b>${esc(x.name)}</b><div class="hint" style="margin:0">${esc(x.description||x.subject)}</div></td><td>${x.segments.map(k=>esc(customData.segments.find(s=>s.key===k)?.label||k)).join(', ')}<div class="hint">${esc(stat?.rule||'')}</div></td><td>${stat?.eligible||0} đủ điều kiện · ${stat?.blocked||0} bị chặn · ${a.length} lượt</td><td><button data-open-audience="custom:${esc(x.id)}">Người nhận</button>${canManageCustom?` <button data-edit-custom="${esc(x.id)}">Sửa</button> <button data-delete-custom="${esc(x.id)}">Xóa</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="5" class="hint">Chưa có nội dung tự động riêng. Bấm “Thêm nội dung” để tạo.</td></tr>'}</table></div>
</div>
      <div class="card"><h2>Bản xem trước theo lịch</h2>
  <p class="hint">Xem khách thỏa điều kiện, email, nội dung và lý do; thao tác này không gửi email.</p><div class="actions" style="margin:0 0 12px"><button id="pv">Xem trước</button><button id="run" disabled title="Bộ gửi email đang chờ cấu hình">Chạy tại đây đã tắt</button><span class="msg" id="rm"></span></div>
  <div id="pvo"></div><iframe class="preview" id="pvf" style="display:none" title="Xem trước" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
</div>`
    );
    $('#jf').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target;
      const enabled = Object.fromEntries(j.journeys.map((x) => [x.key, f['en_' + x.key].checked]));
      const templates = Object.fromEntries(j.journeys.filter((x) => x.template).map((x) => [x.key, { subject: f['sub_' + x.key].value, body: f['body_' + x.key].value }]));
      act(e.submitter, () => api('PUT', '/api/journeys', { enabled, templates, reminderDays: f.reminderDays.value, prepDays: f.prepDays.value, postTripDays: f.postTripDays.value, journeyTime: f.journeyTime.value, partnerSeasonDays:j.params.partnerSeasons.map((_,i)=>Number(f['season_'+i].value)) }), 'Đã lưu');
    };
    const editor = $('#custom-editor');
    const showCustomEditor = (item = null) => {
      const selected = new Set(item?.segments || []);
      editor.style.display = '';
      editor.innerHTML = `<form class="card" id="custom-form"><h3>${item?'Sửa nội dung chăm sóc':'Thêm nội dung chăm sóc'}</h3><label class="f"><span>Tên nội dung</span><input name="name" required maxlength="100" value="${esc(item?.name||'')}"></label><label class="f"><span>Mô tả</span><input name="description" maxlength="240" value="${esc(item?.description||'')}"></label><label class="f"><span>Nhóm khách nhận</span><div class="row2">${customData.segments.map(s=>`<label class="check"><input type="checkbox" name="segments" value="${esc(s.key)}" ${selected.has(s.key)?'checked':''}> ${esc(s.label)}</label>`).join('')}</div></label><div class="row2"><label class="f"><span>Kích hoạt khi</span><select name="triggerType"><option value="segment" ${(!item?.triggerType||item.triggerType==='segment')?'selected':''}>Khách thuộc nhóm đã chọn</option><option value="before_trip" ${item?.triggerType==='before_trip'?'selected':''}>Trước ngày khởi hành</option><option value="payment_due" ${item?.triggerType==='payment_due'?'selected':''}>Còn nợ trước ngày khởi hành</option><option value="after_trip" ${item?.triggerType==='after_trip'?'selected':''}>Sau ngày về</option><option value="birthday" ${item?.triggerType==='birthday'?'selected':''}>Sinh nhật</option><option value="lead_followup" ${item?.triggerType==='lead_followup'?'selected':''}>Lead chưa tiếp nhận/đang xử lý</option></select></label><label class="f"><span>Số ngày lệch mốc (không áp dụng sinh nhật/nhóm)</span><input type="number" name="offsetDays" min="0" max="365" value="${item?.offsetDays??0}"></label><label class="f"><span>Không gửi lặp trong (ngày)</span><input type="number" name="cooldownDays" min="1" max="365" value="${item?.cooldownDays??30}"></label><label class="f"><span>Người xử lý</span><select name="ownerRule"><option value="sale" ${item?.ownerRule!=='marketing'?'selected':''}>Sale phụ trách trên CRM</option><option value="marketing" ${item?.ownerRule==='marketing'?'selected':''}>Marketing / Chăm sóc</option></select></label></div><label class="f"><span>Tiêu đề email</span><input name="subject" required maxlength="150" value="${esc(item?.subject||'')}"></label><label class="f"><span>Nội dung email</span><textarea name="body" rows="6" required maxlength="5000">${esc(item?.body||'')}</textarea></label><label class="check"><input type="checkbox" name="enabled" ${item?.enabled===false?'':'checked'}> Bật để tính người nhận theo lịch (chưa gửi email tự động)</label><div class="actions"><button class="primary">Lưu nội dung</button><button type="button" id="cancel-custom">Đóng</button></div></form>`;
      $('#cancel-custom').onclick=()=>{editor.style.display='none';editor.innerHTML=''};
      $('#custom-form').onsubmit=async e=>{e.preventDefault();const f=e.target;const data={name:f.name.value,description:f.description.value,subject:f.subject.value,body:f.body.value,segments:[...f.querySelectorAll('[name="segments"]:checked')].map(x=>x.value),triggerType:f.triggerType.value,offsetDays:Number(f.offsetDays.value),cooldownDays:Number(f.cooldownDays.value),ownerRule:f.ownerRule.value,enabled:f.enabled.checked};const result=await act(e.submitter,()=>api(item?'PUT':'POST',item?`/api/journeys/custom/${encodeURIComponent(item.id)}`:'/api/journeys/custom',data),'Đã lưu nội dung');if(result)go('journeys')};
    };
    if($('#add-custom'))$('#add-custom').onclick=()=>showCustomEditor();
    $$('[data-edit-custom]').forEach(b=>b.onclick=()=>showCustomEditor(customRows.find(x=>x.id===b.dataset.editCustom)));
    $$('[data-delete-custom]').forEach(b=>b.onclick=async()=>{if(!confirm('Xóa nội dung chăm sóc này?'))return;const r=await api('DELETE',`/api/journeys/custom/${encodeURIComponent(b.dataset.deleteCustom)}`);if(r)go('journeys')});
    $$('[data-open-audience]').forEach(b=>b.onclick=()=>{lsSet('audienceJourney',b.dataset.openAudience);go('autolist')});
    $('#pv').onclick = (e) =>
      act(e.target, async () => {
        const r = await api('GET', '/api/journeys/preview');
        $('#pvo').innerHTML = `<p class="hint">${r.schedulerReady?`${r.items.length} email đủ điều kiện theo lịch${r.skipped.length?`, ${r.skipped.length} bị chặn do thiếu email hoặc đã chặn nhận tin`:''}.`:esc(r.reason||'Chưa tính được lịch chăm sóc.')} Bản xem trước không gửi email.</p>
<table class="t"><tr><th>Hành trình</th><th>Gửi tới</th><th>Tiêu đề</th></tr>${r.items.map((x) => `<tr class="click" data-i="${x.i}"><td>${esc(x.label)}</td><td>${esc(x.to)}</td><td>${esc(x.subject)}</td></tr>`).join('') || '<tr><td colspan="3" class="hint">Hôm nay không có khách thỏa quy tắc đến hạn</td></tr>'}</table>
${r.skipped.length ? `<h2 style="margin-top:12px">Không gửi được</h2><ul class="reasons">${r.skipped.map((x) => `<li>${esc(x.label)} · ${esc(x.name)}: ${esc(x.reason)}</li>`).join('')}</ul>` : ''}`;
        $$('#pvo tr[data-i]').forEach((tr) => (tr.onclick = () => (($('#pvf').style.display = ''), ($('#pvf').src = '/api/journeys/preview/' + tr.dataset.i))));
      });
    $('#run').onclick = (e) =>
      act(e.target, async () => {
        const r = await api('POST', '/api/journeys/run');
        $('#rm').className = 'msg ok';
        $('#rm').textContent = `Đưa ${r.queued} tin vào hàng đợi, tạo ${r.tasks} việc cho sale, đã gửi ${r.sentNow}${r.waiting ? `, còn ${r.waiting} chờ gửi` : ''}${r.quiet ? ' (đang trong khung giờ không gửi quảng cáo)' : ''}`;
      });
  },

  async tours() {
    const [rows, svc] = await Promise.all([api('GET', '/api/products'), api('GET', '/api/services')]);
    page(
      'Tour & dịch vụ',
      'Chọn sản phẩm và dịch vụ demo trong danh mục để đưa vào nội dung chiến dịch.',
      `<div class="card"><h2>Dịch vụ Nhóm demo</h2><p class="hint">Sửa trong Cài đặt → Dịch vụ Nhóm demo.</p><table class="t"><tr><th>Dịch vụ</th><th>Mô tả</th><th>Giá từ</th></tr>${svc.catalog.map((x) => `<tr><td><b>${esc(x.name)}</b>${x.url ? `<div class="hint" style="margin:0"></div>` : ''}</td><td>${esc(x.desc)}</td><td>${x.price ? vnd(x.price) : '–'}</td></tr>`).join('')}</table></div>
<div class="card scroll" style="padding:0"><table class="t"><tr><th>Sản phẩm trên CRM</th><th>Loại</th><th>Điểm đến</th><th>Thời gian</th><th>Giá từ</th><th>Mở bán</th></tr>
${rows.map((p) => `<tr><td><b>${esc(p.name)}</b>${p.is_new ? ' <span class="pill ok">Mới</span>' : ''}<div class="hint" style="margin:0">${esc(p.code)}</div></td><td>${esc(p.type || '')}</td><td>${esc(p.destination)}</td><td>${esc(p.duration)}</td><td>${vnd(p.price)}</td><td>${day(p.created_at)}</td></tr>`).join('')}</table></div>`
    );
  },

  async messages() {
    const rows = await api('GET', '/api/messages');
    page(
      'Lịch sử gửi',
      '300 tin gần nhất (chiến dịch và chăm sóc tự động).',
      `${S.status.demo ? '<div class="hint">Danh sách email và trạng thái từng hành trình nằm trong mục Chăm sóc tự động.</div>' : `<div class="actions" style="margin:0 0 12px"><button id="pq">Gửi các tin đang chờ</button><span class="msg" id="pm"></span></div>`}
<div class="card scroll" style="padding:0"><table class="t"><tr><th>Thời gian</th><th>Khách</th><th>Nguồn</th><th>Tiêu đề</th><th>Trạng thái</th><th>Mở / Bấm</th></tr>
${rows.map((m) => `<tr><td>${dt(m.sent_at || m.created_at)}</td><td>${esc(m.name || '')}<div class="hint" style="margin:0">${esc(m.to_addr || '')}</div></td><td>${m.campaign_id ? 'Chiến dịch #' + m.campaign_id : esc(S.status.journeys[m.journey]?.label || m.journey || '')}</td><td>${esc(m.subject || '')}</td><td><span class="status ${m.status}">${STATUS[m.status]}</span>${m.reason ? `<div class="hint" style="margin:0">${esc(m.reason)}</div>` : ''}${m.error ? `<div class="msg err">${esc(m.error)}</div>` : ''}</td><td>${m.opened_at ? 'Đã mở' : ''}${m.clicked_at ? ' · đã bấm' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="hint">Chưa gửi tin nào</td></tr>'}</table></div>`
    );
    if ($('#pq')) $('#pq').onclick = (e) =>
      act(e.target, async () => {
        const r = await api('POST', '/api/queue/process');
        $('#pm').textContent = `Đã gửi ${r.sent}, lỗi ${r.failed}, còn chờ ${r.waiting}${r.quiet ? ' (khung giờ không gửi quảng cáo)' : ''}`;
      });
  },

  async settings() {
    const [s, users, staff] = await Promise.all([api('GET', '/api/settings'), api('GET', '/api/users'), api('GET', '/api/staff')]);
    const demo = S.status.demo;
    const roles = (selected) => Object.entries(ROLE).map(([k,v]) => `<option value="${k}" ${k===selected?'selected':''}>${v}</option>`).join('');
    const userRows = users.map((u) => `<tr data-u="${esc(u.username)}"><td><b>${esc(u.username)}</b></td><td>${esc(u.name)}</td>${S.user.role==='admin'?`<td><select data-k="role">${roles(u.role)}</select></td><td><input type="email" data-k="email" value="${esc(u.email||'')}"></td>${demo?'':`<td><select data-k="saleId"><option value="">–</option>${staff.map(x=>`<option value="${x.id}" ${x.id===u.saleId?'selected':''}>${esc(x.name||'')} (#${x.id})</option>`).join('')}</select></td>`}<td><div class="actions" style="margin:0"><button type="button" data-save-u>Lưu</button><button type="button" data-pass-u>Đặt lại mật khẩu</button><button type="button" class="danger" data-del-u ${u.username===S.user.username?'disabled':''}>Gỡ</button></div></td>`:`<td>${esc(ROLE[u.role]||u.role)}</td><td>${esc(u.email||'')}</td>${demo?'':`<td>${u.saleId??''}</td>`}`}</tr>`).join('');
    const create = S.user.role==='admin'?`<form class="card" id="nu"><h2>Thêm nhân viên</h2><p class="hint">Admin tạo tài khoản và chọn vai trò cho nhân viên.</p><div class="row2"><label class="f"><span>Tên đăng nhập</span><input name="username" autocomplete="off" required></label><label class="f"><span>Họ và tên</span><input name="name" required></label><label class="f"><span>Mật khẩu tạm</span><input name="password" minlength="8" required></label><label class="f"><span>Vai trò</span><select name="role">${roles('sale')}</select></label><label class="f"><span>Email (không bắt buộc)</span><input type="email" name="email"></label>${demo?'':`<label class="f"><span>Nhân sự CRM</span><select name="saleId"><option value="">–</option>${staff.map(x=>`<option value="${x.id}">${esc(x.name||'')} (#${x.id})</option>`).join('')}</select></label>`}</div><div class="actions"><button type="button" id="genpass">Tạo mật khẩu tạm</button><button class="primary">Tạo tài khoản</button></div><p class="hint">Sau khi tạo, gửi thông tin đăng nhập cho nhân viên.</p></form>`:'';
    const data = demo?`<section class="card"><h2>Dữ liệu demo</h2><p class="hint">Bộ dữ liệu hư cấu riêng. Không kết nối CRM.</p><button id="sync" class="primary">Nạp lại dữ liệu demo</button></section>`:`<section class="card"><h2>Dữ liệu</h2><p class="hint">Lần đồng bộ gần nhất: ${S.status.lastSync?dt(S.status.lastSync.at):'chưa có'}.</p><div class="actions"><button id="sync" class="primary">Đồng bộ và chấm điểm ngay</button><button id="rescore">Chấm điểm lại dữ liệu đã đồng bộ</button></div><p class="hint">Chấm điểm dùng hồ sơ không phải demo. Quy tắc minh bạch tạm thời; đơn, lead và hoạt động phải được đồng bộ đầy đủ để kết quả đúng.</p></section><section class="card"><h2>Kết nối CRM, email và quy trình</h2><p class="hint">Thiết lập tích hợp hiển thị trong chế độ vận hành.</p></section>`;
    page('Cài đặt','',`${data}<section class="card"><div class="settings-title"><div><h2>Tài khoản nhân viên</h2><p class="hint">Admin có thể tạo tài khoản, đổi vai trò, đặt lại mật khẩu hoặc gỡ quyền truy cập.</p></div><span class="pill">${users.length} tài khoản</span></div><div class="scroll"><table class="t"><tr><th>Tên đăng nhập</th><th>Họ tên</th><th>Vai trò</th><th>Email</th>${demo?'':'<th>Nhân sự CRM</th>'}${S.user.role==='admin'?'<th>Thao tác</th>':''}</tr>${userRows}</table></div></section>${create}${demo?'<section class="card"><h2>Mô phỏng</h2><p class="hint">Thao tác gửi chỉ cập nhật trạng thái trong ứng dụng, không gửi email ra ngoài.</p></section>':''}`);
    $('#sync').onclick=(e)=>act(e.target,()=>api('POST','/api/sync'),r=>demo?`Đã nạp ${r.counts.customers} khách demo`:`Đã đồng bộ ${r.counts.customers} khách, chấm ${r.scored} hồ sơ`).then(r=>r&&render());
    if($('#rescore'))$('#rescore').onclick=(e)=>act(e.target,()=>api('POST','/api/scoring/recompute'),r=>`Đã chấm ${r.scored} hồ sơ; ${r.changed} khách đổi nhóm`).then(r=>r&&render());
    $$('[data-save-u]').forEach(b=>b.onclick=()=>{const tr=b.closest('tr'),v=k=>$(`[data-k=${k}]`,tr).value,d={role:v('role'),email:v('email')};if(tr.querySelector('[data-k="saleId"]'))d.saleId=v('saleId');act(b,()=>api('PUT','/api/users/'+encodeURIComponent(tr.dataset.u),d),'Đã lưu tài khoản')});
    $$('[data-pass-u]').forEach(b=>b.onclick=()=>{const tr=b.closest('tr'),p=prompt(`Mật khẩu mới cho ${tr.dataset.u} (ít nhất 8 ký tự)`);if(p)act(b,()=>api('PUT',`/api/users/${encodeURIComponent(tr.dataset.u)}/password`,{password:p}),'Đã đặt lại mật khẩu')});
    $$('[data-del-u]').forEach(b=>b.onclick=()=>{const tr=b.closest('tr');if(confirm(`Gỡ tài khoản ${tr.dataset.u}?`))act(b,()=>api('DELETE','/api/users/'+encodeURIComponent(tr.dataset.u)),'Đã gỡ tài khoản').then(r=>r&&render())});
    if($('#genpass'))$('#genpass').onclick=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';$('#nu').elements.password.value=Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>chars[x%chars.length]).join('')};
    if($('#nu'))$('#nu').onsubmit=async e=>{e.preventDefault();const f=e.target,payload=Object.fromEntries(new FormData(f)),password=payload.password,r=await act(e.submitter,()=>api('POST','/api/users',payload),'Đã tạo tài khoản');if(r){const msg=`Tài khoản: ${r.username}\nMật khẩu tạm: ${password}\nVai trò: ${ROLE[r.role]}`;try{await navigator.clipboard.writeText(msg);toast('Đã sao chép thông tin đăng nhập')}catch{alert(msg)}render()}};
  },
};

// Mẫu nhanh cho chiến dịch gửi đối tác (sếp, marketing sửa nội dung trước khi duyệt)
const LEAD_TPL = {
  name: 'Nuôi dưỡng lead · giới thiệu tour và dịch vụ',
  subject: '{{ten}}, Nhóm demo có gợi ý hành trình và dịch vụ phù hợp cho bạn',
  body: 'Kính gửi {{ten}},\n\nCảm ơn bạn đã quan tâm đến Nhóm du lịch demo. Dựa trên nhu cầu tư vấn, chúng tôi gửi bạn một số sản phẩm CRM và dịch vụ Nhóm demo để tham khảo:\n\n{{san_pham}}\n\n{{dich_vu}}\n\nBạn có thể trả lời email này để nhân viên {{sale}} tư vấn lịch khởi hành và báo giá phù hợp.',
};
const PARTNER_TPL = {
  'Bản tin giá mùa cao điểm': {
    subject: 'Bảng giá mùa cao điểm dành cho đối tác Nhóm demo',
    body: 'Kính gửi Quý đối tác {{ten}},\n\nNhóm du lịch demo gửi Quý đối tác giá ưu đãi mùa cao điểm sắp tới cho các tuyến dưới đây. Giá áp dụng cho đặt chỗ trước ngày …\n\n{{chinh_sach}}\n\nQuý đối tác cần giữ chỗ, vui lòng bấm "Gửi yêu cầu cho Nhóm demo" hoặc trả lời email này. Nhân viên {{sale}} phản hồi trong ngày làm việc.',
  },
  'Chính sách hoa hồng': {
    subject: 'Chính sách hợp tác, hoa hồng mới cho đối tác Nhóm demo',
    body: 'Kính gửi Quý đối tác {{ten}},\n\nNhóm du lịch demo trân trọng thông báo chính sách hợp tác áp dụng từ ngày …:\n\n{{chinh_sach}}\n\nMọi thắc mắc về chính sách, Quý đối tác vui lòng trả lời email này hoặc bấm "Gửi yêu cầu cho Nhóm demo".',
  },
  'Mời tham gia sự kiện': {
    subject: 'Mời Quý đối tác cùng Nhóm demo tham gia …',
    body: 'Kính gửi Quý đối tác {{ten}},\n\nNhóm du lịch demo trân trọng mời Quý đối tác tham gia … (thời gian, địa điểm, quyền lợi).\n\nĐăng ký tham gia hoặc đặt câu hỏi, Quý đối tác vui lòng bấm "Gửi yêu cầu cho Nhóm demo".',
  },
};

// ---------- soạn chiến dịch ----------
async function editCampaign(id) {
  const [products, dests, svc, data] = await Promise.all([api('GET', '/api/products'), api('GET', '/api/destinations'), api('GET', '/api/services'), id ? api('GET', '/api/campaigns/' + id) : null]);
  const c = data?.campaign || { name: '', goal: '', audience: { segments: [] }, subject: '', body: 'Kính gửi Quý khách {{ten}},\n\n\n\n{{uu_dai}}', product_ids: [], recommend: true, status: 'draft' };
  const a = c.audience || {};
  const segs = S.status.segments;
  const locked = !['draft', 'approved'].includes(c.status);
  const chip = (name, val, label, on) => `<label><input type="checkbox" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${label}</label>`;
  const productGroup = (product) => { const type=String(product.type||'').toLowerCase(); return type.includes('combo')?'combo':type.includes('tour')||type.includes('package')?'tour':'other'; };
  const productTabs = [
    {id:'tour',label:'Tour trọn gói',items:products.filter((p)=>productGroup(p)==='tour')},
    {id:'combo',label:'Combo',items:products.filter((p)=>productGroup(p)==='combo')},
    {id:'other',label:'Sản phẩm khác',items:products.filter((p)=>productGroup(p)==='other')},
  ];
  const productChoice = (p) => `<label class="attach-choice"><input type="checkbox" name="pid" value="${p.id}" ${(c.product_ids||[]).map(Number).includes(Number(p.id))?'checked':''} ${locked?'disabled':''}><span><b>${esc(p.name)}</b><small>${[p.type,p.duration,Number(p.price)>0?`từ ${vnd(p.price)}`:''].filter(Boolean).map(esc).join(' · ')}${p.is_new?' · Mới':''}</small></span></label>`;
  page(
    id ? `Chiến dịch: ${c.name}` : 'Tạo chiến dịch',
    `<a href="#" data-go="campaigns">← Danh sách chiến dịch</a> · Trạng thái: <span class="status ${c.status}">${STATUS[c.status]}</span>${c.approved_by ? ` · duyệt bởi ${esc(c.approved_by)}` : ''}${c.scheduled_at && c.status === 'approved' ? ` · <b>tự gửi lúc ${dt(c.scheduled_at)}</b>` : ''}`,
    `<div class="editor">
<form class="card" id="cf">
  <label class="f"><span>Tên chiến dịch</span><input type="text" name="name" value="${esc(c.name)}" required ${locked ? 'disabled' : ''} style="max-width:none"></label>
  <label class="f"><span>Mục tiêu</span><input type="text" name="goal" value="${esc(c.goal)}" placeholder="Ví dụ: bán tour Nhật mùa hoa cho khách đã đi Hàn" ${locked ? 'disabled' : ''} style="max-width:none"></label>
  ${locked ? '' : '<p class="hint">Mẫu cho lead: <button type="button" id="lead-template" style="padding:3px 10px;font-size:12px">Gợi ý tour và dịch vụ</button> · chọn nhóm tiềm năng bên dưới và sản phẩm muốn giới thiệu.</p>'}
  <h2>1. Gửi cho ai</h2>
  <p class="hint">Nhóm khách</p><div class="chips">${Object.entries(segs).map(([k, v]) => chip('seg', k, seg(k), (a.segments || []).includes(k))).join('')}</div>
  <p class="hint">Đã từng đi (bỏ trống = không lọc)</p><div class="chips">${dests.map((d) => chip('vis', d, esc(d), (a.visited || []).includes(d))).join('')}</div>
  <p class="hint">Dự đoán điểm đến tiếp theo là</p><div class="chips">${dests.map((d) => chip('nxt', d, esc(d), (a.nextDestination || []).includes(d))).join('')}</div>
  <p class="hint">Khả năng mua</p><div class="chips">${['high', 'medium', 'low'].map((p) => chip('prop', p, PROP[p], (a.propensity || []).includes(p))).join('')}</div>
  <p class="hint">Đã dùng dịch vụ</p><div class="chips">${svc.groups.map((g) => chip('svc', g, esc(g), (a.services || []).includes(g))).join('')}</div>
  <p class="hint">Chưa từng dùng dịch vụ (để giới thiệu dịch vụ mới)</p><div class="chips">${svc.groups.map((g) => chip('nsvc', g, esc(g), (a.notServices || []).includes(g))).join('')}</div>
  <p class="hint">Hạng thành viên</p><div class="chips">${['Kim cương', 'Vàng', 'Bạc', 'Tiêu chuẩn'].map((g) => chip('tier', g, g, (a.tiers || []).includes(g))).join('')}</div>
  <p class="hint">Đối tác (đại lý, doanh nghiệp): email kèm nút "Gửi yêu cầu cho Nhóm demo", trả lời về nhân viên phụ trách</p>
  <div class="chips"><label><input type="checkbox" name="partners" ${a.partners ? 'checked' : ''} ${locked ? 'disabled' : ''}> <b>Chỉ gửi đối tác</b></label>${['Đại lý, đối tác', 'Doanh nghiệp', 'Cơ quan, tổ chức'].map((g) => chip('sg', g, esc(g), (a.subGroups || []).includes(g))).join('')}</div>
  <p class="hint">Khách từng hỏi qua</p><div class="chips">${chip('lsrc', 'Nguồn lead demo', 'Nguồn lead demo', (a.leadSources || []).includes('Nguồn lead demo'))}</div>
  <label class="check" style="margin-top:12px"><input type="checkbox" id="manual-recipients" ${a.manualRecipients ? 'checked' : ''} ${locked ? 'disabled' : ''}> Chỉ gửi cho danh sách khách tôi chọn</label>
  <div id="recipient-pick" class="card" style="display:${a.manualRecipients ? 'block' : 'none'};margin-top:8px"><div class="actions"><button type="button" id="select-all-recipients">Chọn tất cả đủ điều kiện</button><button type="button" id="clear-recipients">Bỏ chọn</button><span class="hint" id="recipient-count"></span></div><div id="recipient-options" class="scroll" style="max-height:260px"></div></div>
  <div class="count-box" id="cnt" style="margin-top:12px">Đang tính…</div>
  <h2 style="margin-top:16px">2. Nội dung email</h2>
  ${locked ? '' : `<p class="hint">Mẫu nhanh cho đối tác: ${Object.keys(PARTNER_TPL).map((k) => `<button type="button" data-ptpl="${esc(k)}" style="padding:3px 10px;font-size:12px">${esc(k)}</button>`).join(' ')}</p>`}
  <label class="f"><span>Tiêu đề</span><input type="text" name="subject" value="${esc(c.subject)}" maxlength="150" ${locked ? 'disabled' : ''} style="max-width:none"></label>
  <label class="f"><span>Nội dung</span><textarea name="body" rows="9" ${locked ? 'disabled' : ''}>${esc(c.body)}</textarea>
    <small class="vars">Bấm để chèn: <code>{{ten}}</code> <code>{{sale}}</code> <code>{{diem_den_goi_y}}</code> <code>{{diem_den_da_di}}</code> <code>{{uu_dai}}</code> <code>{{chinh_sach}}</code> <code>{{san_pham}}</code> <code>{{dich_vu}}</code> <code>{{link_danh_gia}}</code></small></label>
  <h2>3. Tour, dịch vụ đính kèm</h2>
  <label class="check"><input type="checkbox" name="recommend" ${c.recommend ? 'checked' : ''} ${locked ? 'disabled' : ''}> Tự chèn tour gợi ý theo dự đoán điểm đến của <b>từng khách</b></label>
  <p class="hint">Chọn một nhóm để xem sản phẩm. Sản phẩm đã chọn sẽ hiện thành thẻ có nút mở website trong email.</p>
  <div class="attach-tabs" role="tablist" aria-label="Nhóm sản phẩm và dịch vụ">
    ${productTabs.map((tab,i)=>`<button type="button" role="tab" aria-selected="${i===0}" data-attachment-tab="${tab.id}">${esc(tab.label)} <span class="tab-count">${tab.items.length}</span></button>`).join('')}
    <button type="button" role="tab" aria-selected="false" data-attachment-tab="services">Dịch vụ đặt ngoài <span class="tab-count">${svc.catalog.length}</span></button>
  </div>
  ${productTabs.map((tab,i)=>`<div class="attach-panel" role="tabpanel" data-attachment-panel="${tab.id}" ${i?'hidden':''}><div class="attach-list">${tab.items.map(productChoice).join('')||'<p class="hint">Chưa có sản phẩm trong nhóm này.</p>'}</div></div>`).join('')}
  <div class="attach-panel" role="tabpanel" data-attachment-panel="services" hidden>
    <p class="hint">Chọn dịch vụ để thêm thẻ và nút mở đối tác vào email.</p>
    <div class="attach-list">${svc.catalog.map((item)=>`<label class="attach-choice"><input type="checkbox" name="sid" value="${esc(item.id)}" ${(c.service_ids||[]).includes(item.id)?'checked':''} ${locked?'disabled':''}><span><b>${esc(item.name)}</b><small>${esc(item.desc||'')}${item.url?' · Có liên kết đối tác':''}</small></span></label>`).join('')||'<p class="hint">Chưa cấu hình dịch vụ đặt ngoài.</p>'}</div>
  </div>
  <p class="hint">Tour/Combo dùng biến <code>{{san_pham}}</code>; dịch vụ đặt ngoài dùng <code>{{dich_vu}}</code>. Khi chọn, Care tự chèn biến còn thiếu vào nội dung.</p>
  <h2 style="margin-top:16px">4. Thời gian gửi</h2>
  <label class="f"><span>Hẹn giờ gửi (bỏ trống = gửi khi bấm "Gửi ngay")</span><input type="datetime-local" name="scheduledAt" value="${c.scheduled_at ? new Date(new Date(c.scheduled_at).getTime() + 7 * 3600e3).toISOString().slice(0, 16) : ''}" ${locked ? 'disabled' : ''} style="max-width:260px"><small>Giờ Việt Nam. Chiến dịch phải được duyệt trước giờ hẹn.</small></label>
  <div class="actions" style="margin-top:16px">
    ${locked ? '' : '<button class="primary" id="save">Lưu</button>'}
    ${id && c.status === 'draft' ? '<button type="button" id="appr">Duyệt</button>' : ''}
    ${id && c.status === 'approved' ? '<button type="button" class="primary" id="send">Gửi ngay</button>' : ''}
    ${id && ['approved', 'sending'].includes(c.status) ? '<button type="button" class="danger" id="stop">Dừng</button>' : ''}
  </div>
  ${id && !locked ? '<p class="hint">Sửa nội dung sau khi duyệt thì chiến dịch quay về "Đang soạn" và cần duyệt lại.</p>' : ''}
</form>
<div>
  <div class="card"><h2>Xem trước</h2>
    <div class="actions" style="margin:0 0 8px"><select id="pc" style="max-width:260px"></select><button type="button" id="pvb">Cập nhật</button></div>
    <p class="hint" id="pvs"></p><iframe class="preview" id="pvf" title="Xem trước email" style="height:640px" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
  </div>
  ${id ? `<div class="card"><h2>Gửi thử</h2><p class="hint">Bộ gửi email chưa sẵn sàng. Không có email thử nào được gửi.</p><div class="actions" style="margin:0"><input type="email" id="tto" placeholder="email của bạn" value="${esc(S.status.testTo || '')}" style="max-width:240px"><button type="button" id="tsb" disabled>Gửi thử · email chưa sẵn sàng</button></div></div>` : ''}
  ${
    data
      ? `<div class="card"><h2>Kết quả</h2><div class="kv">
    <div>Đã gửi / chờ / lỗi</div><div>${data.report.sent} / ${data.report.queued} / ${data.report.failed}</div>
    <div>Bị loại</div><div>${data.report.skipped}</div>
    <div>Mở · Bấm</div><div>${data.report.opened} · ${data.report.clicked}</div>
    <div>Hủy nhận tin</div><div>${data.report.unsubscribed}</div>
    <div>Mua lại trong 30 ngày</div><div><b>${data.report.buyers} khách</b> · ${vnd(data.report.revenue)}</div></div>
    ${data.audience.excluded.length ? `<details><summary>${data.audience.excluded.length} khách bị loại</summary><ul class="reasons">${data.audience.excluded.map((x) => `<li>${esc(x.name)}: ${esc(x.reason)}</li>`).join('')}</ul></details>` : ''}</div>`
      : ''
  }
</div></div>`
  );
  const f = $('#cf');
  $$('[data-attachment-tab]').forEach((button) => button.addEventListener('click', () => {
    const active=button.dataset.attachmentTab;
    $$('[data-attachment-tab]').forEach((tab)=>tab.setAttribute('aria-selected',String(tab===button)));
    $$('[data-attachment-panel]').forEach((panel)=>{panel.hidden=panel.dataset.attachmentPanel!==active;});
  }));
  const ensureBodyVariable = (token) => {
    if (!f.body.value.includes(token)) f.body.value = `${f.body.value.trimEnd()}${f.body.value.trim() ? '\n\n' : ''}${token}`;
  };
  $$('input[name=pid]', f).forEach((input) => input.addEventListener('change', () => { if (input.checked) ensureBodyVariable('{{san_pham}}'); }));
  $$('input[name=sid]', f).forEach((input) => input.addEventListener('change', () => { if (input.checked) ensureBodyVariable('{{dich_vu}}'); }));
  const read = () => {
    const vals = (n) => $$(`input[name=${n}]:checked`, f).map((x) => x.value);
    return {
      name: f.name.value,
      goal: f.goal.value,
      audience: { segments: vals('seg'), visited: vals('vis'), nextDestination: vals('nxt'), propensity: vals('prop'), services: vals('svc'), notServices: vals('nsvc'), tiers: vals('tier'), leadSources: vals('lsrc'), partners: !!$('input[name=partners]', f)?.checked, subGroups: vals('sg'), manualRecipients: !!$('#manual-recipients')?.checked, selectedCustomerIds: vals('cust').map(Number) },
      subject: f.subject.value,
      body: f.body.value,
      productIds: vals('pid').map(Number),
      serviceIds: vals('sid'),
      recommend: f.recommend.checked,
      scheduledAt: f.scheduledAt.value ? f.scheduledAt.value + ':00+07:00' : null,
    };
  };
  const count = async () => {
    const r = await api('POST', '/api/audience/preview', read().audience).catch((e) => ({ error: e.message }));
    $('#cnt').innerHTML = r.error ? esc(r.error) : `<b>${r.count}</b> khách sẽ nhận${r.excluded ? ` · ${r.excluded} bị loại (${Object.entries(r.reasons).map(([k, v]) => `${esc(k)}: ${v}`).join('; ')})` : ''}`;
  };
  const preview = async (customerId) => {
    const b = read();
    try {
      const r = await api('POST', '/api/campaigns/preview', { ...b, customerId });
      $('#pvs').textContent = `Tiêu đề: ${r.subject} · ${r.customer.id ? `Khách: ${r.customer.name} (${segs[r.customer.segment]?.label || ''}, gợi ý ${r.customer.next_destination || '–'})` : 'Chưa có khách đủ điều kiện; đang xem nội dung mẫu.'}`;
      $('#pvf').srcdoc = r.html;
      const sel = $('#pc');
      const cur = String(customerId || r.customer.id);
      sel.innerHTML = r.recipients.map((x) => `<option value="${x.id}" ${String(x.id) === cur ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    } catch (e) {
      $('#pvs').textContent = e.message;
      $('#pvf').srcdoc = '';
    }
  };
  const loadRecipientChoices = async () => {
    const panel=$('#recipient-pick');
    if(!panel||!$('#manual-recipients')?.checked)return;
    const selected=new Set([...(a.selectedCustomerIds||[]).map(String),...$$('input[name=cust]:checked',f).map((input)=>input.value)]);
    const audience={...read().audience,manualRecipients:false,selectedCustomerIds:[]};
    const rows=await api('POST','/api/audience/recipients',audience).catch((error)=>({error:error.message}));
    if(rows.error){$('#recipient-options').textContent=rows.error;return;}
    $('#recipient-count').textContent=`${rows.filter((row)=>row.eligible).length} email đủ điều kiện`;
    $('#recipient-options').innerHTML=`<table class="t"><tr><th>Chọn</th><th>Khách</th><th>Email</th><th>Trạng thái</th></tr>${rows.map((row)=>`<tr><td><input type="checkbox" name="cust" value="${row.id}" ${selected.has(String(row.id))?'checked':''} ${!row.eligible||locked?'disabled':''}></td><td>${esc(row.name)}</td><td>${esc(row.email||'–')}</td><td>${row.eligible?'<span class="pill ok">Đủ điều kiện</span>':`<span class="pill warn">${esc(row.reason)}</span>`}</td></tr>`).join('')||'<tr><td colspan="4">Không có khách phù hợp với bộ lọc.</td></tr>'}</table>`;
    $$('input[name=cust]',f).forEach((input)=>input.addEventListener('change',()=>{count();preview();}));
  };
  let t;
  let previewTimer;
  [f.subject, f.body].forEach((field) => field.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => preview(Number($('#pc').value) || undefined), 220);
  }));
  f.addEventListener('change', (event) => {
    if(event.target.name==='cust')return;
    clearTimeout(t);
    t=setTimeout(()=>{loadRecipientChoices();count();preview();},300);
  });
  if($('#manual-recipients'))$('#manual-recipients').onchange=()=>{const on=$('#manual-recipients').checked;$('#recipient-pick').style.display=on?'block':'none';if(on)loadRecipientChoices();count();preview();};
  if($('#select-all-recipients'))$('#select-all-recipients').onclick=()=>{$$('input[name=cust]',f).forEach((input)=>{if(!input.disabled)input.checked=true;});count();preview();};
  if($('#clear-recipients'))$('#clear-recipients').onclick=()=>{$$('input[name=cust]',f).forEach((input)=>input.checked=false);count();preview();};
  $$('.vars code', f).forEach(
    (code) =>
      (code.onclick = () => {
        const ta = f.body;
        const pos = ta.selectionStart ?? ta.value.length;
        ta.value = ta.value.slice(0, pos) + code.textContent + ta.value.slice(pos);
        ta.focus();
      })
  );
  $$('[data-ptpl]').forEach(
    (b) =>
      (b.onclick = () => {
        const t = PARTNER_TPL[b.dataset.ptpl];
        const blank = !f.body.value.replace(/Kính gửi Quý khách \{\{ten\}\},|\{\{uu_dai\}\}|\s/g, '');
        if (!blank && !confirm('Thay nội dung đang soạn bằng mẫu này?')) return;
        f.subject.value = t.subject;
        f.body.value = t.body;
        if (!f.name.value) f.name.value = b.dataset.ptpl;
        const pc = $('input[name=partners]', f);
        if (pc) pc.checked = true;
        f.dispatchEvent(new Event('change'));
      })
  );
  if ($('#lead-template')) $('#lead-template').onclick = () => {
    if (f.body.value.trim() && !confirm('Thay nội dung đang soạn bằng mẫu nuôi dưỡng lead?')) return;
    f.name.value = LEAD_TPL.name;
    f.goal.value = 'Nuôi dưỡng lead bằng sản phẩm CRM và dịch vụ Nhóm demo';
    f.subject.value = LEAD_TPL.subject;
    f.body.value = LEAD_TPL.body;
    ['hot', 'warm', 'cold'].forEach((segment) => {
      const input = f.querySelector(`input[name="seg"][value="${segment}"]`);
      if (input) input.checked = true;
    });
    f.dispatchEvent(new Event('change'));
  };
  $('#pvb').onclick = () => preview();
  $('#pc').onchange = () => preview(Number($('#pc').value));
  loadRecipientChoices();
  count();
  preview();
  if ($('#save'))
    f.onsubmit = (e) => {
      e.preventDefault();
      act(e.submitter, async () => {
        const r = await api(id ? 'PUT' : 'POST', id ? '/api/campaigns/' + id : '/api/campaigns', read());
        await editCampaign(r.id);
      }, 'Đã lưu chiến dịch');
    };
  if ($('#appr')) $('#appr').onclick = (e) => act(e.target, () => api('POST', `/api/campaigns/${id}/approve`), 'Đã duyệt').then(() => editCampaign(id));
  if ($('#send'))
    $('#send').onclick = (e) => {
      if (!confirm('Gửi chiến dịch ngay? Dữ liệu demo chỉ cập nhật lịch sử mô phỏng; email thật chưa được cấu hình.')) return;
      act(e.target, () => api('POST', `/api/campaigns/${id}/send`), (r) => r.simulated ? `Đã mô phỏng gửi cho ${r.sentNow} khách. Không có email nào gửi ra ngoài.` : `Đưa ${r.queued} email vào hàng đợi, đã gửi ${r.sentNow}${r.waiting ? `, ${r.waiting} đang chờ` : ''}`).then(() => editCampaign(id));
    };
  if ($('#stop')) $('#stop').onclick = (e) => confirm('Dừng chiến dịch?') && act(e.target, () => api('POST', `/api/campaigns/${id}/cancel`), 'Đã dừng').then(() => editCampaign(id));
  if ($('#tsb')) $('#tsb').onclick = (e) => act(e.target, () => api('POST', `/api/campaigns/${id}/test`, { to: $('#tto').value }), (r) => r.message);
}

render().catch((e) => ($('#app').innerHTML = `<p class="loading">Không tải được: ${esc(e.message)}</p>`));
