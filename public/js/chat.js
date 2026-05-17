let currentUser = null
let socket = null
let currentConvId = null

function $(id) { return document.getElementById(id) }

async function api(path, opts = {}) {
  const headers = { ...opts.headers }
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { headers, ...opts })
  return res.json()
}

function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text
  return marked.parse(text, { breaks: true, gfm: true })
}

function renderLatex(html) {
  if (typeof katex === 'undefined') return html
  let r = html
  r = r.replace(/\$\$(.+?)\$\$/gs, (_, expr) => {
    try { return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }) }
    catch { return _ }
  })
  r = r.replace(/\$(.+?)\$/g, (_, expr) => {
    if (expr.length > 100) return _
    try { return katex.renderToString(expr.trim(), { throwOnError: false }) }
    catch { return _ }
  })
  return r
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const t = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return t
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${t}`
}

function getInitials(name) { return name.charAt(0).toUpperCase() }

function getAvatarColor(username) {
  const colors = ['#4f6ef7','#e74c3c','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#3498db']
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function escapeHtml(text) {
  const d = document.createElement('div')
  d.textContent = text
  return d.innerHTML
}

function scrollToBottom() {
  const el = $('chat-messages')
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight })
}

function renderMessageContent(content, type) {
  if (type === 'image') return `<img src="${content}" alt="图片" loading="lazy">`
  let html = renderMarkdown(content)
  html = renderLatex(html)
  return html
}

function renderMessage(msg) {
  const isSelf = currentUser && msg.user_id === currentUser.id
  const div = document.createElement('div')
  div.className = `message ${isSelf ? 'self' : ''}`
  div.innerHTML = `
    <div class="message-avatar" style="background:${getAvatarColor(msg.username)}">${getInitials(msg.nickname)}</div>
    <div class="message-body">
      <div class="message-header">
        <span class="name">${escapeHtml(msg.nickname)}</span>
        <span class="time">${formatTime(msg.created_at)}</span>
      </div>
      <div class="message-content">${renderMessageContent(msg.content, msg.type)}</div>
    </div>`
  return div
}

function addMessage(msg) {
  if (msg.conversation_id !== currentConvId) return
  const container = $('chat-messages')
  const welcome = container.querySelector('.welcome-msg')
  if (welcome) welcome.remove()
  container.appendChild(renderMessage(msg))
  scrollToBottom()
}

/* Auth */
async function checkAuth() {
  const data = await api('/api/auth/me')
  if (data.user) { currentUser = data.user; showChat(); return true }
  showAuth(); return false
}

function showChat() {
  $('auth-page').style.display = 'none'
  $('chat-page').style.display = 'flex'
  $('my-nickname').textContent = currentUser.nickname
  const av = $('my-avatar')
  av.textContent = getInitials(currentUser.nickname)
  av.style.background = getAvatarColor(currentUser.username)
  initSocket()
  loadConversations()
  loadFriends()
  loadFriendRequests()
  loadGroups()
}

function showAuth() {
  if (socket) socket.disconnect()
  $('auth-page').style.display = 'flex'
  $('chat-page').style.display = 'none'
}

function showError(id, msg) {
  $(id).textContent = msg
  setTimeout(() => { $(id).textContent = '' }, 3000)
}

/* Conversations */
function loadConversations() {
  api('/api/conversations').then(data => {
    const list = $('conversation-list')
    list.innerHTML = ''
    if (!data.conversations || data.conversations.length === 0) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px;">暂无会话</div>'
      return
    }
    data.conversations.forEach(c => {
      const name = c.name || '私聊'
      const div = document.createElement('div')
      div.className = `conv-item ${c.id === currentConvId ? 'active' : ''}`
      div.dataset.id = c.id
      const initial = name.charAt(0).toUpperCase()
      const color = c.type === 'group' ? '#2ecc71' : getAvatarColor(name)
      const lastMsg = c.last_msg ? (c.last_msg.length > 25 ? c.last_msg.slice(0,25)+'...' : c.last_msg) : ''
      div.innerHTML = `<div class="conv-avatar" style="background:${color}">${initial}</div>
        <div class="conv-info"><div class="conv-name">${escapeHtml(name)}</div>
        <div class="conv-last">${escapeHtml(lastMsg)}</div></div>`
      div.addEventListener('click', () => selectConversation(c.id))
      list.appendChild(div)
    })
  })
}

function selectConversation(convId) {
  currentConvId = convId
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'))
  const el = document.querySelector(`.conv-item[data-id="${convId}"]`)
  if (el) el.classList.add('active')

  // load messages
  api(`/api/messages/${convId}`).then(data => {
    const container = $('chat-messages')
    container.innerHTML = ''
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(msg => container.appendChild(renderMessage(msg)))
      scrollToBottom()
    } else {
      container.innerHTML = '<div class="welcome-msg"><p>暂无消息，发送第一条吧</p></div>'
    }
  })

  // get conversation name
  api('/api/conversations').then(data => {
    const conv = data.conversations.find(c => c.id === convId)
    if (conv) {
      $('chat-title').textContent = conv.name || '私聊'
      $('chat-meta').textContent = conv.type === 'group' ? '群聊' : '私聊'
    } else {
      $('chat-title').textContent = '会话'
      $('chat-meta').textContent = ''
    }
  })

  $('chat-input-area').style.display = 'block'
}

/* Friends */
function loadFriends() {
  api('/api/friends').then(data => {
    const list = $('friend-list')
    list.innerHTML = ''
    if (!data.friends || data.friends.length === 0) {
      list.innerHTML = '<div style="padding:8px 18px;color:rgba(255,255,255,0.3);font-size:13px;">暂无好友</div>'
      return
    }
    data.friends.forEach(f => {
      const div = document.createElement('div')
      div.className = 'friend-item'
      div.innerHTML = `<span class="dot"></span><span class="friend-name">${escapeHtml(f.nickname)}</span>`
      div.addEventListener('click', () => openPrivateChat(f.id, f.nickname))
      list.appendChild(div)
    })
  })
}

function openPrivateChat(friendId, friendName) {
  // find or create conversation with this friend
  api('/api/conversations').then(data => {
    const convs = data.conversations || []
    // look for existing private conversation with this friend via participants
    // since we can't easily filter on client, fallback to API
    api('/api/conversations/private/' + friendId).then(data2 => {
      if (data2.conversation_id) {
        selectConversation(data2.conversation_id)
        // switch to conversations tab
        switchTab('conversations')
      }
    })
  })
}

function loadFriendRequests() {
  api('/api/friends/requests').then(data => {
    const container = $('friend-requests')
    if (!data.requests || data.requests.length === 0) {
      container.innerHTML = ''
      return
    }
    let html = ''
    data.requests.forEach(r => {
      html += `<div class="request-item">
        <span class="req-name">${escapeHtml(r.nickname)} (${escapeHtml(r.username)})</span>
        <span class="req-actions">
          <button class="btn-tiny btn-accept" data-id="${r.id}">接受</button>
          <button class="btn-tiny btn-reject" data-id="${r.id}">拒绝</button>
        </span>
      </div>`
    })
    container.innerHTML = html
    container.querySelectorAll('.btn-accept').forEach(btn => {
      btn.addEventListener('click', () => respondToRequest(parseInt(btn.dataset.id), true))
    })
    container.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => respondToRequest(parseInt(btn.dataset.id), false))
    })
  })
}

function respondToRequest(requestId, accept) {
  api('/api/friends/respond', {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, accept }),
  }).then(data => {
    if (data.error) return alert(data.error)
    loadFriendRequests()
    loadFriends()
  })
}

function addFriend() {
  const username = $('search-user-input').value.trim()
  if (!username) return
  api('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  }).then(data => {
    if (data.error) {
      $('add-friend-error').textContent = data.error
      setTimeout(() => { $('add-friend-error').textContent = '' }, 3000)
      return
    }
    if (data.auto_accepted) {
      loadFriends()
    }
    $('search-user-input').value = ''
    $('search-results').innerHTML = '<div style="padding:10px;text-align:center;color:#2ecc71;">请求已发送</div>'
    setTimeout(() => { closeModal() }, 1000)
  })
}

/* Groups */
function loadGroups() {
  api('/api/groups').then(data => {
    const list = $('group-list')
    list.innerHTML = ''
    if (!data.groups || data.groups.length === 0) {
      list.innerHTML = '<div style="padding:8px 18px;color:rgba(255,255,255,0.3);font-size:13px;">暂无群组</div>'
      return
    }
    data.groups.forEach(g => {
      const div = document.createElement('div')
      div.className = 'group-item'
      div.innerHTML = `<span style="flex-shrink:0;width:28px;height:28px;border-radius:6px;background:#2ecc71;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;">${getInitials(g.name)}</span>
        <span style="flex:1">${escapeHtml(g.name)}</span>`
      // find conversation_id for this group
      api('/api/conversations').then(data2 => {
        const conv = (data2.conversations || []).find(c => c.group_id === g.id)
        if (conv) {
          div.addEventListener('click', () => { selectConversation(conv.id); switchTab('conversations') })
        }
      })
      list.appendChild(div)
    })
  })
}

/* Socket */
function initSocket() {
  if (socket) socket.disconnect()
  socket = io()
  socket.on('connect', () => {
    socket.emit('user:online', { id: currentUser.id, nickname: currentUser.nickname, username: currentUser.username })
  })
  socket.on('new_message', (msg) => {
    addMessage(msg)
    loadConversations()
  })
  socket.on('online_users', (users) => {
    renderOnlineUsers(users)
  })
  socket.on('friend_updated', () => {
    loadFriends()
    loadFriendRequests()
  })
  socket.on('group_created', () => {
    loadGroups()
    loadConversations()
  })
}

function renderOnlineUsers(users) {
  // update friend list dots
  document.querySelectorAll('.friend-item').forEach(el => {
    const nameEl = el.querySelector('.friend-name')
    if (!nameEl) return
    const name = nameEl.textContent
    const dot = el.querySelector('.dot')
    const isOnline = users.some(u => u.nickname === name)
    if (dot) dot.style.background = isOnline ? '#2ecc71' : '#666'
  })
}

/* Messages */
async function sendMessage(content, type = 'text') {
  if (!currentUser || !currentConvId) return
  const res = await fetch(`/api/messages/${currentConvId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, type }),
  })
  if (!res.ok) {
    const data = await res.json()
    alert(data.error || '发送失败')
    return
  }
  $('message-input').value = ''
  $('message-input').focus()
  loadConversations()
}

async function sendGifMessage(url) {
  await sendMessage(url, 'image')
  $('emoji-picker').style.display = 'none'
}

async function sendImageMessage(file) {
  if (!currentConvId) return
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`/api/messages/${currentConvId}`, { method: 'POST', body: formData })
  if (!res.ok) {
    const data = await res.json()
    alert(data.error || '发送失败')
  }
  loadConversations()
}

/* Tab switching */
function switchTab(name) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'))
  document.querySelector(`.sidebar-tab[data-tab="${name}"]`).classList.add('active')
  $(`pane-${name}`).classList.add('active')
}

/* Modal */
function showModal(id) {
  $('modal-overlay').style.display = 'flex'
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')
  $(id).style.display = 'flex'
}

function closeModal() {
  $('modal-overlay').style.display = 'none'
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth()

  /* Auth */
  $('login-btn').addEventListener('click', async () => {
    const username = $('login-username').value.trim()
    const password = $('login-password').value
    if (!username || !password) { showError('login-error', '请填写所有字段'); return }
    const data = await api('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    })
    if (data.error) { showError('login-error', data.error); return }
    currentUser = data.user; showChat()
  })
  $('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('login-btn').click() })

  $('register-btn').addEventListener('click', async () => {
    const username = $('reg-username').value.trim()
    const nickname = $('reg-nickname').value.trim()
    const password = $('reg-password').value
    const confirm = $('reg-confirm').value
    if (!username || !nickname || !password || !confirm) { showError('register-error', '请填写所有字段'); return }
    if (password !== confirm) { showError('register-error', '两次密码不一致'); return }
    const data = await api('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password, nickname }),
    })
    if (data.error) { showError('register-error', data.error); return }
    currentUser = data.user; showChat()
  })

  $('show-register').addEventListener('click', (e) => {
    e.preventDefault(); $('login-form').style.display = 'none'; $('register-form').style.display = 'block'
  })
  $('show-login').addEventListener('click', (e) => {
    e.preventDefault(); $('register-form').style.display = 'none'; $('login-form').style.display = 'block'
  })

  $('logout-btn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' })
    if (socket) socket.disconnect()
    currentUser = null; showAuth()
  })

  /* Sidebar tabs */
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  })

  /* Send message */
  $('send-btn').addEventListener('click', () => {
    const content = $('message-input').value.trim()
    if (content) sendMessage(content)
  })
  $('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const content = $('message-input').value.trim()
      if (content) sendMessage(content)
    }
  })

  /* Emoji */
  $('emoji-btn').addEventListener('click', () => {
    const picker = $('emoji-picker')
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none'
    if (picker.style.display === 'block') {
      const active = picker.querySelector('.emoji-tab.active')
      renderEmojiPicker(active ? active.dataset.category : 'emoji')
    }
  })
  document.querySelectorAll('.emoji-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      renderEmojiPicker(tab.dataset.category)
    })
  })

  /* Image upload */
  $('image-btn').addEventListener('click', () => $('image-input').click())
  $('image-input').addEventListener('change', (e) => {
    if (e.target.files[0]) { sendImageMessage(e.target.files[0]); e.target.value = '' }
  })

  /* Add friend dialog */
  $('add-friend-btn').addEventListener('click', () => showModal('add-friend-modal'))
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModal)
  })
  $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) closeModal() })

  $('search-user-input').addEventListener('input', () => {
    const q = $('search-user-input').value.trim()
    if (q.length < 1) { $('search-results').innerHTML = ''; return }
    api('/api/friends/search?q=' + encodeURIComponent(q)).then(data => {
      const results = $('search-results')
      results.innerHTML = ''
      if (!data.users || data.users.length === 0) {
        results.innerHTML = '<div style="padding:10px;text-align:center;color:#999;">未找到用户</div>'
        return
      }
      data.users.forEach(u => {
        const div = document.createElement('div')
        div.className = 'search-user-item'
        const isSelf = u.id === currentUser.id
        div.innerHTML = `<span>${escapeHtml(u.nickname)} (${escapeHtml(u.username)})</span>
          ${isSelf ? '<span style="color:#999;font-size:12px;">自己</span>' : '<button class="btn-add-friend" data-username="'+u.username+'">添加</button>'}`
        results.appendChild(div)
      })
      results.querySelectorAll('.btn-add-friend').forEach(btn => {
        btn.addEventListener('click', () => {
          $('search-user-input').value = btn.dataset.username
          addFriend()
        })
      })
    })
  })

  $('search-user-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addFriend()
  })

  /* Create group dialog */
  $('create-group-btn').addEventListener('click', () => {
    showModal('create-group-modal')
    // load friends for selection
    api('/api/friends').then(data => {
      const container = $('friend-select')
      container.innerHTML = ''
      if (!data.friends || data.friends.length === 0) {
        container.innerHTML = '<div style="padding:10px;text-align:center;color:#999;">暂无好友可邀请</div>'
        return
      }
      data.friends.forEach(f => {
        const div = document.createElement('div')
        div.className = 'friend-option'
        div.innerHTML = `<input type="checkbox" value="${f.id}" id="fsel-${f.id}">
          <label for="fsel-${f.id}">${escapeHtml(f.nickname)} (${escapeHtml(f.username)})</label>`
        container.appendChild(div)
      })
    })
  })

  $('confirm-create-group').addEventListener('click', () => {
    const name = $('group-name-input').value.trim()
    const checked = document.querySelectorAll('#friend-select input:checked')
    const memberIds = Array.from(checked).map(cb => parseInt(cb.value))
    if (!name) { showError('create-group-error', '请输入群组名称'); return }
    if (memberIds.length === 0) { showError('create-group-error', '请选择至少一位好友'); return }
    api('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, member_ids: memberIds }),
    }).then(data => {
      if (data.error) { showError('create-group-error', data.error); return }
      closeModal()
      $('group-name-input').value = ''
      loadGroups()
      loadConversations()
    })
  })
})
