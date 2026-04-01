// =================================================================
// State
// =================================================================
const state = {
  deals: [],
  actions: [],
  currentView: 'dashboard',
  selectedDealId: null,
  dealFilter: 'all',
  actionFilter: 'pending',
  calWeekOffset: 0,   // 0 = current week
  calEvents: [],      // events from Google Calendar
  editingDealId: null,
  editingActionId: null,
  accessToken: null,
  tokenExpiry: null,
  settings: {
    clientId: '',
    apiKey: '',
    myName: '',
    myCompany: '',
    myEmail: ''
  }
};

// =================================================================
// Constants
// =================================================================
const STAGES = {
  approach: { label: 'アプローチ', cls: 'stage-approach' },
  hearing:  { label: 'ヒアリング',  cls: 'stage-hearing'  },
  proposal: { label: '提案',        cls: 'stage-proposal' },
  quote:    { label: '見積',        cls: 'stage-quote'    },
  nego:     { label: '交渉',        cls: 'stage-nego'     },
  won:      { label: '受注',        cls: 'stage-won'      },
  lost:     { label: '失注',        cls: 'stage-lost'     }
};

const ACTION_TYPES = {
  call:   { label: '電話',          icon: '📞' },
  email:  { label: 'メール',        icon: '📧' },
  visit:  { label: '訪問',          icon: '🏢' },
  online: { label: 'オンライン会議', icon: '💻' },
  doc:    { label: '資料送付',       icon: '📄' },
  other:  { label: 'その他',         icon: '📝' }
};

const STATUS_META = {
  active: { label: '進行中', cls: 'status-active' },
  won:    { label: '受注',   cls: 'status-won'    },
  lost:   { label: '失注',   cls: 'status-lost'   },
  paused: { label: '保留',   cls: 'status-paused' }
};

// =================================================================
// Storage
// =================================================================
function loadStorage() {
  try {
    const d = localStorage.getItem('crm_deals');
    if (d) state.deals = JSON.parse(d);
    const a = localStorage.getItem('crm_actions');
    if (a) state.actions = JSON.parse(a);
    const s = localStorage.getItem('crm_settings');
    if (s) state.settings = { ...state.settings, ...JSON.parse(s) };
    const tok = localStorage.getItem('crm_token');
    if (tok) {
      const t = JSON.parse(tok);
      if (t.expiry > Date.now()) {
        state.accessToken = t.token;
        state.tokenExpiry = t.expiry;
      }
    }
  } catch(e) { console.error('Storage error:', e); }
}

function saveDeals()    { localStorage.setItem('crm_deals',    JSON.stringify(state.deals));    }
function saveActions()  { localStorage.setItem('crm_actions',  JSON.stringify(state.actions));  }
function saveSettings() { localStorage.setItem('crm_settings', JSON.stringify(state.settings)); }
function saveToken()    { localStorage.setItem('crm_token',    JSON.stringify({ token: state.accessToken, expiry: state.tokenExpiry })); }

// =================================================================
// Navigation
// =================================================================
function navigate(view, dealId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');
  const navEl = document.getElementById(`nav-${view}`);
  if (navEl) navEl.classList.add('active');

  state.currentView = view;

  const titles = {
    dashboard: 'ダッシュボード',
    deals: '商談一覧',
    'deal-detail': '商談詳細',
    actions: 'アクション管理',
    calendar: 'カレンダー',
    settings: '設定'
  };
  document.getElementById('page-title').textContent = titles[view] || '';

  // Topbar actions
  const ta = document.getElementById('topbar-actions');
  if (view === 'deals') {
    ta.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openDealModal()">＋ 新規商談</button>`;
  } else if (view === 'actions') {
    ta.innerHTML = `<button class="btn btn-primary btn-sm" onclick="openActionModal()">＋ アクション追加</button>`;
  } else {
    ta.innerHTML = '';
  }

  if (view === 'dashboard')    renderDashboard();
  else if (view === 'deals')   renderDeals();
  else if (view === 'deal-detail' && dealId) { state.selectedDealId = dealId; renderDealDetail(); }
  else if (view === 'actions') { populateActionDealFilter(); renderActions(); }
  else if (view === 'calendar') renderCalendar();
  else if (view === 'settings') loadSettingsForm();

  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =================================================================
// Sidebar (mobile)
// =================================================================
function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  s.classList.toggle('open');
  o.style.display = s.classList.contains('open') ? 'block' : 'none';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

// =================================================================
// Dashboard
// =================================================================
function renderDashboard() {
  const today = todayStr();
  document.getElementById('today-date').textContent = formatDateJp(today);

  const active = state.deals.filter(d => d.status === 'active');
  const pipeline = active.reduce((s, d) => s + ((d.amount || 0) * (d.probability || 50) / 100), 0);
  const todayActions = state.actions.filter(a => a.status === 'pending' && a.dueDate === today);
  const overdue = state.actions.filter(a => a.status === 'pending' && a.dueDate < today);

  document.getElementById('stat-active').textContent = active.length;
  document.getElementById('stat-pipeline').textContent = formatMoney(pipeline);
  document.getElementById('stat-today-actions').textContent = todayActions.length;
  document.getElementById('stat-overdue').textContent = overdue.length;

  const overdueBadge = document.getElementById('overdue-badge');
  if (overdue.length > 0) {
    overdueBadge.style.display = 'flex';
    overdueBadge.textContent = overdue.length;
  } else {
    overdueBadge.style.display = 'none';
  }

  // Today's meetings from Google Calendar
  renderTodayMeetings();

  // Upcoming actions (next 7 days + overdue)
  const soon = [...overdue, ...todayActions, ...state.actions.filter(a => a.status === 'pending' && a.dueDate > today)]
    .slice(0, 8);
  const actEl = document.getElementById('dashboard-actions');
  if (soon.length === 0) {
    actEl.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p>未完了のアクションがありません 🎉</p></div>`;
  } else {
    actEl.innerHTML = soon.map(a => actionItemHTML(a, true)).join('');
  }

  // Pipeline summary
  renderPipelineSummary();
}

function renderTodayMeetings() {
  const today = todayStr();
  const el = document.getElementById('today-meetings');

  if (!state.accessToken) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem">
      <p>Googleカレンダーと連携すると今日の予定が表示されます</p>
      <button class="btn btn-secondary btn-sm" onclick="navigate('settings')">設定へ</button>
    </div>`;
    return;
  }

  const todayEvents = state.calEvents.filter(e => {
    const start = (e.start.dateTime || e.start.date || '').substring(0, 10);
    return start === today;
  }).sort((a, b) => (a.start.dateTime || a.start.date) > (b.start.dateTime || b.start.date) ? 1 : -1);

  if (todayEvents.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p>今日の予定はありません</p></div>`;
    return;
  }

  el.innerHTML = todayEvents.map(e => {
    const start = e.start.dateTime ? formatTime(e.start.dateTime) : '終日';
    const end   = e.end.dateTime   ? formatTime(e.end.dateTime)   : '';
    const deal  = state.deals.find(d => d.calEventIds && d.calEventIds.includes(e.id));
    return `<div class="meeting-item">
      <div class="meeting-time-block">
        <div class="meeting-start">${start}</div>
        <div class="meeting-dot"></div>
        ${end ? `<div style="font-size:0.7rem">${end}</div>` : ''}
      </div>
      <div class="meeting-info">
        <div class="meeting-title">${esc(e.summary || '（タイトルなし）')}</div>
        <div class="meeting-meta">
          ${e.location ? `<span>📍 ${esc(e.location)}</span>` : ''}
          ${deal ? `<span class="meeting-deal-link" onclick="navigate('deal-detail','${deal.id}')">💼 ${esc(deal.company)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderPipelineSummary() {
  const el = document.getElementById('pipeline-summary');
  const active = state.deals.filter(d => d.status === 'active');
  if (active.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:2rem">
      <p>商談がありません</p>
      <button class="btn btn-primary" onclick="openDealModal()">＋ 商談を追加する</button>
    </div>`;
    return;
  }

  const byStage = {};
  for (const s of Object.keys(STAGES)) byStage[s] = [];
  for (const d of active) byStage[d.stage] = (byStage[d.stage] || []).concat(d);

  el.innerHTML = `<div style="overflow-x:auto"><table class="deal-table">
    <thead><tr>
      <th>会社名 / 担当者</th><th>フェーズ</th><th>金額</th><th>成約予定日</th><th>次回アクション</th>
    </tr></thead>
    <tbody>
    ${active.sort((a,b) => (a.closingDate||'') < (b.closingDate||'') ? -1 : 1).slice(0, 10).map(d => {
      const nextAct = state.actions.filter(a => a.dealId === d.id && a.status === 'pending')
        .sort((a,b) => a.dueDate > b.dueDate ? 1 : -1)[0];
      return `<tr onclick="navigate('deal-detail','${d.id}')">
        <td><div class="deal-company">${esc(d.company)}</div>${d.contact ? `<div class="deal-contact">${esc(d.contact)}</div>` : ''}</td>
        <td><span class="stage-badge ${STAGES[d.stage]?.cls}">${STAGES[d.stage]?.label}</span></td>
        <td class="amount">${d.amount ? formatMoney(d.amount) : '—'}</td>
        <td class="${d.closingDate && d.closingDate < todayStr() ? 'text-danger' : ''}">${d.closingDate ? formatDateJp(d.closingDate) : '—'}</td>
        <td>${nextAct ? `<span class="${nextAct.dueDate < todayStr() ? 'text-danger' : ''}">${esc(nextAct.title)}</span>` : '<span class="text-muted">—</span>'}</td>
      </tr>`;
    }).join('')}
    </tbody></table></div>`;
}

// =================================================================
// Deal List
// =================================================================
let dealFilterVal = 'all';

function setDealFilter(val, btn) {
  dealFilterVal = val;
  document.querySelectorAll('#view-deals .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDeals();
}

function renderDeals() {
  const q = (document.getElementById('deal-search')?.value || '').toLowerCase();
  let deals = state.deals.filter(d => {
    if (dealFilterVal !== 'all' && d.status !== dealFilterVal) return false;
    if (q && !d.company.toLowerCase().includes(q) && !(d.contact||'').toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => a.updatedAt > b.updatedAt ? -1 : 1);

  const tbody = document.getElementById('deals-tbody');
  const empty = document.getElementById('deals-empty');

  if (deals.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    document.querySelector('#view-deals .panel').style.display = 'none';
    return;
  }
  document.querySelector('#view-deals .panel').style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = deals.map(d => {
    const nextAct = state.actions.filter(a => a.dealId === d.id && a.status === 'pending')
      .sort((a,b) => a.dueDate > b.dueDate ? 1 : -1)[0];
    const isOverdue = nextAct && nextAct.dueDate < todayStr();
    return `<tr onclick="navigate('deal-detail','${d.id}')">
      <td>
        <div class="deal-company">${esc(d.company)}</div>
        ${d.contact ? `<div class="deal-contact">${esc(d.contact)}</div>` : ''}
      </td>
      <td><span class="stage-badge ${STAGES[d.stage]?.cls}">${STAGES[d.stage]?.label || d.stage}</span></td>
      <td class="amount">${d.amount ? formatMoney(d.amount) : '—'}</td>
      <td style="min-width:50px">${d.probability != null ? `${d.probability}%` : '—'}</td>
      <td style="max-width:180px">
        ${nextAct ? `<span class="${isOverdue ? 'text-danger' : ''}" title="${esc(nextAct.title)}">${ACTION_TYPES[nextAct.type]?.icon} ${esc(nextAct.title).substring(0,22)}${nextAct.title.length>22?'…':''}</span>` : '<span class="text-muted">—</span>'}
      </td>
      <td class="${nextAct && isOverdue ? 'text-danger' : ''}">${nextAct?.dueDate ? formatDateJp(nextAct.dueDate) : '—'}</td>
      <td><span class="status-badge ${STATUS_META[d.status]?.cls}">${STATUS_META[d.status]?.label}</span></td>
      <td>
        <div class="btn-row" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-icon btn-sm" title="編集" onclick="openDealModal('${d.id}')">✏️</button>
          <button class="btn btn-ghost btn-icon btn-sm" title="削除" onclick="deleteDeal('${d.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// =================================================================
// Deal Detail
// =================================================================
function renderDealDetail() {
  const deal = state.deals.find(d => d.id === state.selectedDealId);
  if (!deal) { navigate('deals'); return; }

  document.getElementById('detail-deal-name').textContent = deal.company;

  // Pipeline stages
  const pipelineEl = document.getElementById('detail-pipeline');
  pipelineEl.innerHTML = Object.entries(STAGES).map(([key, meta]) => `
    <div class="pipeline-stage ${meta.cls} ${deal.stage === key ? 'active' : ''}"
      onclick="setDealStage('${deal.id}','${key}')">
      ${meta.label}
    </div>
  `).join('');

  // Info grid
  document.getElementById('detail-info-grid').innerHTML = `
    <div class="detail-field">
      <label>会社名</label>
      <p>${esc(deal.company)}</p>
    </div>
    <div class="detail-field">
      <label>ステータス</label>
      <p><span class="status-badge ${STATUS_META[deal.status]?.cls}">${STATUS_META[deal.status]?.label}</span></p>
    </div>
    <div class="detail-field">
      <label>見込み金額</label>
      <p class="amount">${deal.amount ? formatMoney(deal.amount) : '—'}</p>
    </div>
    <div class="detail-field">
      <label>成約予定日</label>
      <p class="${deal.closingDate && deal.closingDate < todayStr() ? 'text-danger' : ''}">${deal.closingDate ? formatDateJp(deal.closingDate) : '—'}</p>
    </div>
  `;

  // Probability bar
  const prob = deal.probability != null ? deal.probability : 50;
  document.getElementById('detail-prob-fill').style.width = `${prob}%`;
  document.getElementById('detail-prob-fill').style.background =
    prob >= 70 ? '#22c55e' : prob >= 40 ? '#f59e0b' : '#ef4444';
  document.getElementById('detail-prob-text').textContent = `${prob}%`;

  // Notes
  const notesEl = document.getElementById('detail-notes');
  const notesSec = document.getElementById('detail-notes-section');
  if (deal.notes) {
    notesSec.style.display = 'block';
    notesEl.textContent = deal.notes;
  } else {
    notesSec.style.display = 'none';
  }

  // Contact info
  document.getElementById('detail-contact-info').innerHTML = [
    deal.contact ? `<div class="detail-field" style="margin-bottom:0.75rem"><label>担当者</label><p>${esc(deal.contact)}</p></div>` : '',
    deal.contactEmail ? `<div class="detail-field" style="margin-bottom:0.75rem"><label>メール</label><p><a href="mailto:${esc(deal.contactEmail)}" style="color:var(--primary)">${esc(deal.contactEmail)}</a></p></div>` : '',
    deal.contactPhone ? `<div class="detail-field" style="margin-bottom:0.75rem"><label>電話</label><p><a href="tel:${esc(deal.contactPhone)}">${esc(deal.contactPhone)}</a></p></div>` : '',
  ].filter(Boolean).join('') || '<p class="text-muted text-sm">担当者情報がありません</p>';

  // Activity
  document.getElementById('detail-activity').innerHTML = `
    <div style="margin-bottom:0.5rem">📅 作成日: ${formatDateJp(deal.createdAt?.substring(0,10) || '')}</div>
    <div>🔄 更新日: ${formatDateJp(deal.updatedAt?.substring(0,10) || '')}</div>
  `;

  // Actions for this deal
  document.getElementById('btn-add-action-deal').onclick = () => openActionModal(null, deal.id);
  renderDealActions(deal.id);
  renderDealMeetings(deal.id);
}

function renderDealActions(dealId) {
  const actions = state.actions.filter(a => a.dealId === dealId)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
      return a.dueDate > b.dueDate ? 1 : -1;
    });
  const el = document.getElementById('detail-actions');
  if (actions.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p>アクションがありません</p></div>`;
    return;
  }
  el.innerHTML = actions.map(a => actionItemHTML(a)).join('');
}

function renderDealMeetings(dealId) {
  const deal = state.deals.find(d => d.id === dealId);
  const el = document.getElementById('detail-meetings');
  if (!state.accessToken) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p>Googleカレンダーと連携してください</p></div>`;
    return;
  }
  const ids = deal?.calEventIds || [];
  const meetings = state.calEvents.filter(e => ids.includes(e.id));
  if (meetings.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:1.5rem"><p>紐付けられたミーティングがありません</p><button class="btn btn-secondary btn-sm" onclick="linkMeetingToDeal()">カレンダーから追加</button></div>`;
    return;
  }
  el.innerHTML = meetings.sort((a,b) => (a.start.dateTime||a.start.date) > (b.start.dateTime||b.start.date) ? -1:1)
    .map(e => {
      const start = e.start.dateTime ? `${formatDateJp(e.start.dateTime.substring(0,10))} ${formatTime(e.start.dateTime)}` : formatDateJp(e.start.date);
      return `<div class="meeting-item">
        <div class="meeting-dot" style="margin:4px 0 0"></div>
        <div class="meeting-info">
          <div class="meeting-title">${esc(e.summary || '（タイトルなし）')}</div>
          <div class="meeting-meta">${start}${e.location ? ` · 📍${esc(e.location)}` : ''}</div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" title="紐付けを解除" onclick="unlinkMeeting('${dealId}','${e.id}')">✕</button>
      </div>`;
    }).join('');
}

function setDealStage(dealId, stage) {
  const deal = state.deals.find(d => d.id === dealId);
  if (!deal) return;
  deal.stage = stage;
  if (stage === 'won')  deal.status = 'won';
  if (stage === 'lost') deal.status = 'lost';
  if (stage !== 'won' && stage !== 'lost') deal.status = 'active';
  deal.updatedAt = new Date().toISOString();
  saveDeals();
  renderDealDetail();
  showToast(`フェーズを「${STAGES[stage].label}」に変更しました`, 'success');
}

function editCurrentDeal() { openDealModal(state.selectedDealId); }
function deleteCurrentDeal() { deleteDeal(state.selectedDealId, true); }

function deleteDeal(id, goBack = false) {
  const deal = state.deals.find(d => d.id === id);
  if (!deal) return;
  if (!confirm(`「${deal.company}」の商談を削除しますか？\n関連アクションも削除されます。`)) return;
  state.deals   = state.deals.filter(d => d.id !== id);
  state.actions = state.actions.filter(a => a.dealId !== id);
  saveDeals(); saveActions();
  showToast('商談を削除しました', 'info');
  if (goBack) navigate('deals');
  else renderDeals();
}

// =================================================================
// Actions
// =================================================================
let actionFilterVal = 'pending';

function setActionFilter(val, btn) {
  actionFilterVal = val;
  document.querySelectorAll('#view-actions .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderActions();
}

function populateActionDealFilter() {
  const sel = document.getElementById('action-deal-filter');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">すべての商談</option>' +
    state.deals.map(d => `<option value="${d.id}"${d.id===current?' selected':''}>${esc(d.company)}</option>`).join('');
}

function renderActions() {
  const dealF = document.getElementById('action-deal-filter')?.value || '';
  let actions = state.actions.filter(a => {
    if (dealF && a.dealId !== dealF) return false;
    if (actionFilterVal === 'pending' && a.status !== 'pending') return false;
    if (actionFilterVal === 'done'    && a.status !== 'done')    return false;
    return true;
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    return a.dueDate > b.dueDate ? 1 : -1;
  });

  const el = document.getElementById('actions-list');
  const emptyEl = document.getElementById('actions-empty');

  if (actions.length === 0) {
    el.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  const today = todayStr();
  const groups = {};
  for (const a of actions) {
    const key = a.status === 'done' ? 'done' :
      a.dueDate < today ? 'overdue' :
      a.dueDate === today ? 'today' : a.dueDate;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  const groupOrder = ['overdue', 'today', ...Object.keys(groups).filter(k => k !== 'overdue' && k !== 'today' && k !== 'done').sort(), 'done'];
  const groupLabels = { overdue: '⚠️ 期限切れ', today: '📅 今日', done: '✅ 完了済' };

  el.innerHTML = groupOrder.filter(k => groups[k]).map(k => {
    const label = groupLabels[k] || formatDateJp(k);
    return `<div class="section-date-header">${label}</div>` +
      groups[k].map(a => actionItemHTML(a)).join('');
  }).join('');
}

function actionItemHTML(action, showDeal = false) {
  const today = todayStr();
  const isDone = action.status === 'done';
  const isOverdue = !isDone && action.dueDate < today;
  const isToday   = !isDone && action.dueDate === today;
  const deal = state.deals.find(d => d.id === action.dealId);
  const typeInfo = ACTION_TYPES[action.type] || { icon: '📝', label: action.type };

  return `<div class="action-item ${isDone ? 'done' : ''}" id="action-row-${action.id}">
    <div class="action-check ${isDone ? 'done' : ''}" onclick="toggleAction('${action.id}')" title="${isDone ? '未完了に戻す' : '完了にする'}">
      ${isDone ? '✓' : ''}
    </div>
    <div class="action-main">
      <div class="action-title">${esc(action.title)}</div>
      <div class="action-meta">
        <span class="action-type-badge">${typeInfo.icon} ${typeInfo.label}</span>
        ${deal && showDeal ? `<span class="action-deal meeting-deal-link" onclick="navigate('deal-detail','${deal.id}')">${esc(deal.company)}</span>` : ''}
        ${deal && !showDeal && state.currentView !== 'deal-detail' ? `<span class="action-deal text-muted">${esc(deal.company)}</span>` : ''}
        <span class="action-due ${isOverdue ? 'overdue' : isToday ? 'today' : ''}">
          ${isOverdue ? '⚠️ ' : isToday ? '📅 ' : ''}${action.dueDate ? formatDateJp(action.dueDate) : ''}
          ${action.dueTime ? ' ' + action.dueTime : ''}
        </span>
        ${action.calendarEventId ? '<span class="text-muted text-xs">📅 GCal</span>' : ''}
      </div>
    </div>
    <div class="action-controls">
      <button class="btn btn-ghost btn-icon btn-sm" onclick="openActionModal('${action.id}')" title="編集">✏️</button>
      <button class="btn btn-ghost btn-icon btn-sm" onclick="deleteAction('${action.id}')" title="削除">🗑️</button>
    </div>
  </div>`;
}

function toggleAction(id) {
  const action = state.actions.find(a => a.id === id);
  if (!action) return;
  action.status = action.status === 'done' ? 'pending' : 'done';
  action.completedAt = action.status === 'done' ? new Date().toISOString() : null;
  saveActions();
  // Re-render current view
  if (state.currentView === 'actions') renderActions();
  else if (state.currentView === 'deal-detail') renderDealActions(action.dealId);
  else if (state.currentView === 'dashboard') renderDashboard();
}

function deleteAction(id) {
  const action = state.actions.find(a => a.id === id);
  if (!action || !confirm('このアクションを削除しますか？')) return;
  state.actions = state.actions.filter(a => a.id !== id);
  saveActions();
  showToast('アクションを削除しました', 'info');
  if (state.currentView === 'actions') renderActions();
  else if (state.currentView === 'deal-detail') renderDealActions(action.dealId);
  else if (state.currentView === 'dashboard') renderDashboard();
}

// =================================================================
// Calendar
// =================================================================
const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

function calPrevWeek() { state.calWeekOffset--; renderCalendar(); }
function calNextWeek() { state.calWeekOffset++; renderCalendar(); }
function calGoToday()  { state.calWeekOffset = 0; renderCalendar(); }

function getWeekDays(offset = 0) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() || 7) + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

async function renderCalendar() {
  const days = getWeekDays(state.calWeekOffset);
  const startStr = days[0].toISOString().substring(0, 10);
  const endStr   = days[6].toISOString().substring(0, 10);
  const today    = todayStr();

  document.getElementById('week-label').textContent =
    `${days[0].getMonth()+1}月${days[0].getDate()}日 〜 ${days[6].getMonth()+1}月${days[6].getDate()}日`;

  const noAuth = document.getElementById('calendar-no-auth');
  const wrapper = document.getElementById('calendar-grid-wrapper');

  if (!state.accessToken) {
    noAuth.style.display = 'block';
    wrapper.style.display = 'none';
    return;
  }
  noAuth.style.display = 'none';
  wrapper.style.display = 'block';

  // Fetch events if needed
  if (state.accessToken) {
    await fetchCalendarEvents(`${startStr}T00:00:00Z`, `${endStr}T23:59:59Z`);
  }

  const grid = document.getElementById('calendar-grid');
  const HOUR_START = 8, HOUR_END = 20;
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  // Build grid HTML
  let html = '';

  // Header row
  html += `<div class="wg-corner"></div>`;
  for (const d of days) {
    const ds = d.toISOString().substring(0,10);
    const isToday = ds === today;
    html += `<div class="wg-day-header${isToday ? ' today' : ''}">
      <div class="wg-day-name">${DAYS_JA[d.getDay()]}</div>
      <div class="wg-day-num">${d.getDate()}</div>
    </div>`;
  }

  // All-day row
  html += `<div class="wg-allday-corner">終日</div>`;
  for (const d of days) {
    const ds = d.toISOString().substring(0,10);
    const allDayEvs = state.calEvents.filter(e => e.start.date === ds);
    html += `<div class="wg-allday-cell">` +
      allDayEvs.map(e => `<div class="allday-event" title="${esc(e.summary||'')}">${esc((e.summary||'').substring(0,12))}</div>`).join('') +
      `</div>`;
  }

  // Time rows
  for (const h of hours) {
    html += `<div class="wg-time-col"><div class="wg-time-slot">${h}:00</div></div>`;
    for (const d of days) {
      html += `<div class="wg-day-col" data-date="${d.toISOString().substring(0,10)}"><div class="wg-hour-line"></div></div>`;
    }
  }

  grid.innerHTML = html;
  grid.style.gridTemplateRows = `auto auto repeat(${hours.length}, 48px)`;
  grid.style.gridTemplateColumns = `60px repeat(7, 1fr)`;

  // Place events
  const timedEvents = state.calEvents.filter(e => e.start.dateTime);
  for (const ev of timedEvents) {
    const evDate = ev.start.dateTime.substring(0, 10);
    const dayIdx = days.findIndex(d => d.toISOString().substring(0,10) === evDate);
    if (dayIdx < 0) continue;

    const startH = parseFloat(ev.start.dateTime.substring(11,16).replace(':','.').replace(/\.(\d+)/, (_, m) => '.' + parseInt(m) * 100 / 60 / 100));
    const endH   = parseFloat(ev.end.dateTime.substring(11,16).replace(':','.').replace(/\.(\d+)/, (_, m) => '.' + parseInt(m) * 100 / 60 / 100));
    if (endH <= HOUR_START || startH >= HOUR_END) continue;

    const top    = Math.max(0, (startH - HOUR_START)) * 48;
    const height = Math.min((HOUR_END - HOUR_START) * 48 - top, (endH - startH) * 48);
    const linked = state.deals.some(d => d.calEventIds && d.calEventIds.includes(ev.id));

    // Find the column
    const cols = grid.querySelectorAll(`[data-date="${evDate}"]`);
    if (cols.length === 0) continue;
    const col = cols[Math.floor(top / 48) > 0 ? 0 : 0]; // simplified

    const evEl = document.createElement('div');
    evEl.className = `cal-event${linked ? ' linked' : ''}`;
    evEl.style.top    = `${top}px`;
    evEl.style.height = `${Math.max(18, height)}px`;
    evEl.innerHTML = `<div class="cal-event-title">${esc(ev.summary || '（タイトルなし）')}</div>
      <div class="cal-event-time">${formatTime(ev.start.dateTime)}</div>`;
    evEl.title = `${ev.summary || ''}\n${formatTime(ev.start.dateTime)} - ${formatTime(ev.end.dateTime)}`;
    evEl.onclick = () => showEventPopup(ev);

    // Find correct column el
    const allCols = grid.querySelectorAll('.wg-day-col');
    // columns are laid out: row 3+ (after 2 header rows), 7 cols per row
    // col index = dayIdx, row index = (hour - HOUR_START)
    const hourIdx = Math.max(0, Math.floor(Math.max(HOUR_START, startH) - HOUR_START));
    const colIdx  = dayIdx + hourIdx * 7;
    if (allCols[colIdx]) {
      allCols[colIdx].style.position = 'relative';
      allCols[colIdx].appendChild(evEl);
    }
  }
}

function showEventPopup(ev) {
  const deal = state.deals.find(d => d.calEventIds && d.calEventIds.includes(ev.id));
  const msg = [
    `📅 ${ev.summary || '（タイトルなし）'}`,
    ev.start.dateTime ? `⏰ ${formatTime(ev.start.dateTime)} - ${formatTime(ev.end.dateTime)}` : '',
    ev.location ? `📍 ${ev.location}` : '',
    deal ? `💼 商談: ${deal.company}` : ''
  ].filter(Boolean).join('\n');
  alert(msg);
}

async function refreshCalendar() {
  const days = getWeekDays(state.calWeekOffset);
  const startStr = days[0].toISOString().substring(0, 10);
  const endStr   = days[6].toISOString().substring(0, 10);
  await fetchCalendarEvents(`${startStr}T00:00:00Z`, `${endStr}T23:59:59Z`);
  renderCalendar();
  showToast('カレンダーを更新しました', 'success');
}

// =================================================================
// Google Calendar API
// =================================================================
const GCAL = {
  BASE: 'https://www.googleapis.com/calendar/v3',

  async req(path, opts = {}) {
    if (!state.accessToken) throw new Error('Not authenticated');
    const res = await fetch(`${this.BASE}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      }
    });
    if (res.status === 401) {
      state.accessToken = null;
      updateGCalUI(false);
      throw new Error('Token expired');
    }
    if (res.status === 204) return null;
    return res.json();
  },

  async listEvents(timeMin, timeMax) {
    const p = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' });
    return this.req(`/calendars/primary/events?${p}`);
  },

  async createEvent(ev) {
    return this.req('/calendars/primary/events', { method: 'POST', body: JSON.stringify(ev) });
  },

  async deleteEvent(id) {
    return this.req(`/calendars/primary/events/${id}`, { method: 'DELETE' });
  }
};

async function fetchCalendarEvents(timeMin, timeMax) {
  if (!state.accessToken) return;
  try {
    const res = await GCAL.listEvents(timeMin, timeMax);
    if (res?.items) {
      // Merge with existing (avoid duplicates)
      const newIds = new Set(res.items.map(e => e.id));
      state.calEvents = [
        ...state.calEvents.filter(e => !newIds.has(e.id)),
        ...res.items
      ];
    }
  } catch(e) {
    console.error('Calendar fetch error:', e);
    if (!e.message.includes('expired')) showToast('カレンダーの取得でエラーが発生しました', 'error');
  }
}

async function addEventToCalendar(action, deal) {
  if (!state.accessToken) {
    showToast('Googleカレンダーと連携してください', 'warning');
    return null;
  }
  try {
    const start = `${action.dueDate}T${action.dueTime || '09:00'}:00`;
    const end   = `${action.dueDate}T${action.dueTime ? addHour(action.dueTime) : '10:00'}:00`;
    const typeInfo = ACTION_TYPES[action.type] || { icon: '📝' };
    const event = {
      summary: `${typeInfo.icon} ${action.title}${deal ? ` (${deal.company})` : ''}`,
      description: `商談管理アプリより作成\n${deal ? `会社: ${deal.company}\n担当者: ${deal.contact || ''}` : ''}\n\nメモ: ${action.notes || ''}`,
      start: { dateTime: start, timeZone: 'Asia/Tokyo' },
      end:   { dateTime: end,   timeZone: 'Asia/Tokyo' }
    };
    const created = await GCAL.createEvent(event);
    showToast('Googleカレンダーに追加しました', 'success');
    return created;
  } catch(e) {
    console.error('GCal create error:', e);
    showToast('カレンダーへの追加に失敗しました', 'error');
    return null;
  }
}

function addHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// =================================================================
// Google OAuth
// =================================================================
let tokenClient = null;

function initGIS() {
  if (!state.settings.clientId || typeof google === 'undefined') return;
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: state.settings.clientId,
      scope: 'https://www.googleapis.com/auth/calendar',
      callback: handleTokenResponse
    });
  } catch(e) {
    console.error('GIS init error:', e);
  }
}

function handleGCalAuth() {
  if (!state.settings.clientId) {
    showToast('先に設定ページでクライアントIDを入力してください', 'warning');
    navigate('settings');
    return;
  }
  if (!tokenClient) initGIS();
  if (!tokenClient) {
    showToast('Google Identity Servicesの読み込みを待ってください', 'warning');
    return;
  }
  tokenClient.requestAccessToken({ prompt: state.accessToken ? '' : 'consent' });
}

function handleTokenResponse(resp) {
  if (resp.error) {
    showToast(`認証エラー: ${resp.error}`, 'error');
    return;
  }
  state.accessToken = resp.access_token;
  state.tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
  saveToken();
  updateGCalUI(true);
  showToast('Googleカレンダーと連携しました ✓', 'success');

  // Fetch this week's events
  const days = getWeekDays(state.calWeekOffset);
  fetchCalendarEvents(`${days[0].toISOString().substring(0,10)}T00:00:00Z`, `${days[6].toISOString().substring(0,10)}T23:59:59Z`)
    .then(() => {
      if (state.currentView === 'dashboard') renderTodayMeetings();
      if (state.currentView === 'calendar') renderCalendar();
    });
}

function gcalLogout() {
  if (state.accessToken && typeof google !== 'undefined') {
    google.accounts.oauth2.revoke(state.accessToken);
  }
  state.accessToken = null;
  state.tokenExpiry = null;
  localStorage.removeItem('crm_token');
  updateGCalUI(false);
  showToast('Googleカレンダーとの連携を解除しました', 'info');
}

function updateGCalUI(connected) {
  const dot  = document.getElementById('gcal-dot');
  const text = document.getElementById('gcal-status-text');
  const btn  = document.getElementById('btn-gcal-auth');
  const btn2 = document.getElementById('btn-gcal-auth2');
  const logout = document.getElementById('btn-gcal-logout');
  const settingsStatus = document.getElementById('gcal-status-settings');

  if (dot)  dot.className = `gcal-dot${connected ? ' connected' : ''}`;
  if (text) text.textContent = connected ? 'カレンダー連携中' : '未接続';
  if (btn)  btn.style.display = connected ? 'none' : 'inline-flex';
  if (logout) logout.style.display = connected ? 'inline-flex' : 'none';
  if (settingsStatus) settingsStatus.textContent = connected ? '✅ Googleカレンダー: 連携済み' : 'Googleカレンダー: 未接続';
}

// =================================================================
// Link meeting to deal
// =================================================================
function linkMeetingToDeal() {
  const today = todayStr();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  document.getElementById('link-from').value = from.toISOString().substring(0,10);
  document.getElementById('link-to').value   = today;
  document.getElementById('link-events-list').innerHTML = '';
  openModal('link');
}

async function fetchEventsForLinking() {
  const from = document.getElementById('link-from').value;
  const to   = document.getElementById('link-to').value;
  if (!from || !to) { showToast('期間を選択してください', 'warning'); return; }
  if (!state.accessToken) { showToast('Googleカレンダーと連携してください', 'warning'); return; }

  const el = document.getElementById('link-events-list');
  el.innerHTML = '<p class="text-muted text-sm">取得中...</p>';

  await fetchCalendarEvents(`${from}T00:00:00Z`, `${to}T23:59:59Z`);

  const deal = state.deals.find(d => d.id === state.selectedDealId);
  const linked = deal?.calEventIds || [];

  const events = state.calEvents.filter(e => {
    const d = (e.start.dateTime || e.start.date || '').substring(0,10);
    return d >= from && d <= to;
  }).sort((a,b) => (a.start.dateTime||a.start.date) < (b.start.dateTime||b.start.date) ? 1 : -1);

  if (events.length === 0) { el.innerHTML = '<p class="text-muted text-sm">イベントが見つかりませんでした</p>'; return; }

  el.innerHTML = events.map(e => {
    const isLinked = linked.includes(e.id);
    const start = e.start.dateTime ? `${formatDateJp(e.start.dateTime.substring(0,10))} ${formatTime(e.start.dateTime)}` : formatDateJp(e.start.date);
    return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.625rem 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" ${isLinked ? 'checked' : ''} id="link-ev-${e.id}" style="accent-color:var(--primary);width:16px;height:16px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:500;font-size:0.875rem">${esc(e.summary||'（タイトルなし）')}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${start}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="toggleEventLink('${e.id}','${isLinked}')">
        ${isLinked ? '解除' : '紐付け'}
      </button>
    </div>`;
  }).join('');
}

function toggleEventLink(eventId, wasLinked) {
  const deal = state.deals.find(d => d.id === state.selectedDealId);
  if (!deal) return;
  if (!deal.calEventIds) deal.calEventIds = [];
  if (wasLinked === 'true') {
    deal.calEventIds = deal.calEventIds.filter(id => id !== eventId);
    showToast('紐付けを解除しました', 'info');
  } else {
    if (!deal.calEventIds.includes(eventId)) deal.calEventIds.push(eventId);
    showToast('ミーティングを紐付けました', 'success');
  }
  deal.updatedAt = new Date().toISOString();
  saveDeals();
  fetchEventsForLinking();
  renderDealMeetings(deal.id);
}

function unlinkMeeting(dealId, eventId) {
  const deal = state.deals.find(d => d.id === dealId);
  if (!deal) return;
  deal.calEventIds = (deal.calEventIds || []).filter(id => id !== eventId);
  deal.updatedAt = new Date().toISOString();
  saveDeals();
  renderDealMeetings(dealId);
  showToast('紐付けを解除しました', 'info');
}

// =================================================================
// Deal Modal
// =================================================================
function openDealModal(id) {
  state.editingDealId = id || null;
  document.getElementById('deal-modal-title').textContent = id ? '商談を編集' : '新規商談';

  if (id) {
    const d = state.deals.find(x => x.id === id);
    if (!d) return;
    document.getElementById('dm-company').value       = d.company || '';
    document.getElementById('dm-contact').value       = d.contact || '';
    document.getElementById('dm-contact-email').value = d.contactEmail || '';
    document.getElementById('dm-contact-phone').value = d.contactPhone || '';
    document.getElementById('dm-stage').value         = d.stage || 'approach';
    document.getElementById('dm-status').value        = d.status || 'active';
    document.getElementById('dm-amount').value        = d.amount || '';
    document.getElementById('dm-probability').value   = d.probability != null ? d.probability : '';
    document.getElementById('dm-closing-date').value  = d.closingDate || '';
    document.getElementById('dm-notes').value         = d.notes || '';
  } else {
    ['dm-company','dm-contact','dm-contact-email','dm-contact-phone','dm-amount','dm-probability','dm-closing-date','dm-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('dm-stage').value  = 'approach';
    document.getElementById('dm-status').value = 'active';
  }
  openModal('deal');
}

function saveDeal() {
  const company = document.getElementById('dm-company').value.trim();
  if (!company) { showToast('会社名を入力してください', 'error'); return; }

  const now = new Date().toISOString();

  if (state.editingDealId) {
    const deal = state.deals.find(d => d.id === state.editingDealId);
    if (!deal) return;
    Object.assign(deal, {
      company,
      contact:      document.getElementById('dm-contact').value.trim(),
      contactEmail: document.getElementById('dm-contact-email').value.trim(),
      contactPhone: document.getElementById('dm-contact-phone').value.trim(),
      stage:        document.getElementById('dm-stage').value,
      status:       document.getElementById('dm-status').value,
      amount:       Number(document.getElementById('dm-amount').value) || 0,
      probability:  Number(document.getElementById('dm-probability').value) || 0,
      closingDate:  document.getElementById('dm-closing-date').value,
      notes:        document.getElementById('dm-notes').value.trim(),
      updatedAt:    now
    });
    showToast('商談を更新しました', 'success');
  } else {
    state.deals.push({
      id:           Date.now().toString(),
      company,
      contact:      document.getElementById('dm-contact').value.trim(),
      contactEmail: document.getElementById('dm-contact-email').value.trim(),
      contactPhone: document.getElementById('dm-contact-phone').value.trim(),
      stage:        document.getElementById('dm-stage').value,
      status:       document.getElementById('dm-status').value,
      amount:       Number(document.getElementById('dm-amount').value) || 0,
      probability:  Number(document.getElementById('dm-probability').value) || 0,
      closingDate:  document.getElementById('dm-closing-date').value,
      notes:        document.getElementById('dm-notes').value.trim(),
      calEventIds:  [],
      createdAt:    now,
      updatedAt:    now
    });
    showToast('商談を追加しました', 'success');
  }

  saveDeals();
  closeModal('deal');
  if (state.currentView === 'deals') renderDeals();
  else if (state.currentView === 'dashboard') renderDashboard();
  else if (state.currentView === 'deal-detail') renderDealDetail();
}

// =================================================================
// Action Modal
// =================================================================
function openActionModal(id, dealId) {
  state.editingActionId = id || null;
  document.getElementById('action-modal-title').textContent = id ? 'アクションを編集' : 'アクションを追加';

  // Populate deal selector
  const sel = document.getElementById('am-deal-id');
  sel.innerHTML = '<option value="">商談を選択...</option>' +
    state.deals.filter(d => d.status !== 'won' && d.status !== 'lost')
      .map(d => `<option value="${d.id}">${esc(d.company)}</option>`).join('');

  if (id) {
    const a = state.actions.find(x => x.id === id);
    if (!a) return;
    document.getElementById('am-title').value    = a.title || '';
    document.getElementById('am-type').value     = a.type  || 'call';
    document.getElementById('am-deal-id').value  = a.dealId || '';
    document.getElementById('am-due-date').value = a.dueDate || '';
    document.getElementById('am-due-time').value = a.dueTime || '';
    document.getElementById('am-notes').value    = a.notes || '';
    document.getElementById('am-add-to-cal').checked = false;
  } else {
    ['am-title','am-notes'].forEach(i => { const el=document.getElementById(i); if(el) el.value=''; });
    document.getElementById('am-type').value     = 'call';
    document.getElementById('am-deal-id').value  = dealId || (state.selectedDealId && state.currentView === 'deal-detail' ? state.selectedDealId : '') || '';
    document.getElementById('am-due-date').value = todayStr();
    document.getElementById('am-due-time').value = '';
    document.getElementById('am-add-to-cal').checked = !!state.accessToken;
  }
  openModal('action');
}

async function saveAction() {
  const title = document.getElementById('am-title').value.trim();
  const due   = document.getElementById('am-due-date').value;
  if (!title) { showToast('アクション内容を入力してください', 'error'); return; }
  if (!due)   { showToast('期日を選択してください', 'error'); return; }

  const addToCal = document.getElementById('am-add-to-cal').checked;
  const dealId   = document.getElementById('am-deal-id').value;
  const deal     = state.deals.find(d => d.id === dealId);
  const now      = new Date().toISOString();

  if (state.editingActionId) {
    const a = state.actions.find(x => x.id === state.editingActionId);
    if (!a) return;
    Object.assign(a, {
      title,
      type:    document.getElementById('am-type').value,
      dealId:  dealId,
      dueDate: due,
      dueTime: document.getElementById('am-due-time').value,
      notes:   document.getElementById('am-notes').value.trim(),
      updatedAt: now
    });
    showToast('アクションを更新しました', 'success');
  } else {
    const action = {
      id:        Date.now().toString(),
      title,
      type:      document.getElementById('am-type').value,
      dealId:    dealId,
      dueDate:   due,
      dueTime:   document.getElementById('am-due-time').value,
      notes:     document.getElementById('am-notes').value.trim(),
      status:    'pending',
      calendarEventId: null,
      createdAt: now,
      updatedAt: now
    };

    if (addToCal) {
      const ev = await addEventToCalendar(action, deal);
      if (ev) action.calendarEventId = ev.id;
    }

    state.actions.push(action);
    showToast('アクションを追加しました', 'success');
  }

  saveActions();
  closeModal('action');

  if (state.currentView === 'actions') { populateActionDealFilter(); renderActions(); }
  else if (state.currentView === 'deal-detail') renderDealActions(state.selectedDealId);
  else if (state.currentView === 'dashboard') renderDashboard();
}

// =================================================================
// Modal helpers
// =================================================================
function openModal(name) {
  document.getElementById(`overlay-${name}`).classList.add('open');
  document.getElementById(`modal-${name}`).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(name) {
  document.getElementById(`overlay-${name}`).classList.remove('open');
  document.getElementById(`modal-${name}`).classList.remove('open');
  document.body.style.overflow = '';
}

// =================================================================
// Settings
// =================================================================
function loadSettingsForm() {
  document.getElementById('s-client-id').value  = state.settings.clientId || '';
  document.getElementById('s-api-key').value    = state.settings.apiKey   || '';
  document.getElementById('s-my-name').value    = state.settings.myName   || '';
  document.getElementById('s-my-company').value = state.settings.myCompany|| '';
  document.getElementById('s-my-email').value   = state.settings.myEmail  || '';
  updateGCalUI(!!state.accessToken);
}

function saveGcalSettings() {
  state.settings.clientId = document.getElementById('s-client-id').value.trim();
  state.settings.apiKey   = document.getElementById('s-api-key').value.trim();
  saveSettings();
  initGIS();
  showToast('保存しました。Googleでログインをクリックして連携してください', 'success');
}

function saveUserSettings() {
  state.settings.myName    = document.getElementById('s-my-name').value.trim();
  state.settings.myCompany = document.getElementById('s-my-company').value.trim();
  state.settings.myEmail   = document.getElementById('s-my-email').value.trim();
  saveSettings();
  showToast('設定を保存しました', 'success');
}

function exportData() {
  const data = { deals: state.deals, actions: state.actions, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `saleshub-export-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('エクスポートしました', 'success');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm(`${data.deals?.length || 0}件の商談と${data.actions?.length || 0}件のアクションをインポートします。現在のデータに追加されます。`)) return;
      if (data.deals)   state.deals   = [...state.deals,   ...data.deals.filter(d => !state.deals.find(x => x.id === d.id))];
      if (data.actions) state.actions = [...state.actions, ...data.actions.filter(a => !state.actions.find(x => x.id === a.id))];
      saveDeals(); saveActions();
      showToast('インポート完了', 'success');
    } catch(err) {
      showToast('JSONファイルの読み込みに失敗しました', 'error');
    }
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('すべての商談・アクションデータを削除しますか？\nこの操作は取り消せません。')) return;
  localStorage.removeItem('crm_deals');
  localStorage.removeItem('crm_actions');
  location.reload();
}

// =================================================================
// Utilities
// =================================================================
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function todayStr() {
  return new Date().toISOString().substring(0, 10);
}

function formatDateJp(str) {
  if (!str || str.length < 10) return '—';
  const [y, m, d] = str.substring(0, 10).split('-');
  return `${y}/${m}/${d}`;
}

function formatTime(dtStr) {
  if (!dtStr) return '';
  // Handle both "2024-01-15T09:30:00+09:00" and "2024-01-15T00:30:00Z"
  const d = new Date(dtStr);
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tokyo' });
}

function formatMoney(n) {
  if (n >= 100000000) return `¥${(n/100000000).toFixed(1)}億`;
  if (n >= 10000)     return `¥${(n/10000).toFixed(0)}万`;
  return `¥${n.toLocaleString()}`;
}

function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity 0.3s, transform 0.3s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 320);
  }, 3500);
}

// =================================================================
// Init
// =================================================================
function init() {
  loadStorage();

  // Render initial view
  renderDashboard();

  // Init GIS if clientId already saved
  if (state.settings.clientId) {
    // Wait for GIS script to load
    const waitGIS = setInterval(() => {
      if (typeof google !== 'undefined') {
        clearInterval(waitGIS);
        initGIS();
        if (state.accessToken) {
          updateGCalUI(true);
          // Fetch today's events
          const days = getWeekDays(0);
          fetchCalendarEvents(`${days[0].toISOString().substring(0,10)}T00:00:00Z`, `${days[6].toISOString().substring(0,10)}T23:59:59Z`)
            .then(() => {
              if (state.currentView === 'dashboard') renderTodayMeetings();
            });
        }
      }
    }, 300);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['deal','action','link'].forEach(name => closeModal(name));
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
