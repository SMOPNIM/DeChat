let currentUser = null
let socket = null

function $(id) { return document.getElementById(id) }

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  })
  return res.json()
}

function renderMarkdown(text) {
  if (typeof marked === 'undefined') return text
  const html = marked.parse(text, { breaks: true, gfm: true })
  return html
}

function renderLatex(html) {
  if (typeof katex === 'undefined') return html
  let result = html

  result = result.replace(/\$\$(.+?)\$\$/gs, (_, expr) => {
    try {
      return katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false })
    } catch { return _ }
  })

  result = result.replace(/\$(.+?)\$/g, (_, expr) => {
    if (expr.length > 100) return _
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false })
    } catch { return _ }
  })

  return result
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const pad = n => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === now.toDateString()) return time
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${time}`
}

function getInitials(name) {
  return name.charAt(0).toUpperCase()
}

function renderMessageContent(content, type) {
  if (type === 'image') {
    return `<img src="${content}" alt="图片" loading="lazy">`
  }
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
    </div>
  `
  return div
}

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

async function sendMessage(content, type = 'text') {
  if (!currentUser) return
  const res = await fetch('/api/messages', {
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
}

async function sendGifMessage(url) {
  await sendMessage(url, 'image')
  $('emoji-picker').style.display = 'none'
}

async function sendImageMessage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch('/api/messages', { method: 'POST', body: formData })
  if (!res.ok) {
    const data = await res.json()
    alert(data.error || '发送失败')
  }
}

function addMessage(msg) {
  const container = $('chat-messages')
  const el = renderMessage(msg)
  container.appendChild(el)
  scrollToBottom()
}

function loadMessages() {
  api('/api/messages').then(data => {
    const container = $('chat-messages')
    container.innerHTML = ''
    data.messages.forEach(msg => {
      container.appendChild(renderMessage(msg))
    })
    scrollToBottom()
  })
}

function initSocket() {
  socket = io()
  socket.on('new_message', (msg) => {
    addMessage(msg)
  })
  socket.on('connect', () => {
    console.log('Socket 已连接')
  })
}

function addSystemMessage(text) {
  const container = $('chat-messages')
  const div = document.createElement('div')
  div.className = 'system-message'
  div.textContent = text
  container.appendChild(div)
  scrollToBottom()
}

/* Auth */
async function checkAuth() {
  const data = await api('/api/auth/me')
  if (data.user) {
    currentUser = data.user
    showChat()
    return true
  }
  showAuth()
  return false
}

function showChat() {
  $('auth-page').style.display = 'none'
  $('chat-page').style.display = 'flex'
  $('my-nickname').textContent = currentUser.nickname
  $('my-avatar').textContent = getInitials(currentUser.nickname)
  $('my-avatar').style.background = getAvatarColor(currentUser.username)
  loadMessages()
  initSocket()
}

function showAuth() {
  $('auth-page').style.display = 'flex'
  $('chat-page').style.display = 'none'
}

function showError(id, msg) {
  $(id).textContent = msg
  setTimeout(() => { $(id).textContent = '' }, 3000)
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth()

  /* Login */
  $('login-btn').addEventListener('click', async () => {
    const username = $('login-username').value.trim()
    const password = $('login-password').value
    if (!username || !password) { showError('login-error', '请填写所有字段'); return }
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    if (data.error) { showError('login-error', data.error); return }
    currentUser = data.user
    showChat()
  })

  $('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('login-btn').click()
  })

  /* Register */
  $('register-btn').addEventListener('click', async () => {
    const username = $('reg-username').value.trim()
    const nickname = $('reg-nickname').value.trim()
    const password = $('reg-password').value
    const confirm = $('reg-confirm').value
    if (!username || !nickname || !password || !confirm) { showError('register-error', '请填写所有字段'); return }
    if (password !== confirm) { showError('register-error', '两次密码不一致'); return }
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    })
    if (data.error) { showError('register-error', data.error); return }
    currentUser = data.user
    showChat()
  })

  /* Toggle auth forms */
  $('show-register').addEventListener('click', (e) => {
    e.preventDefault()
    $('login-form').style.display = 'none'
    $('register-form').style.display = 'block'
  })
  $('show-login').addEventListener('click', (e) => {
    e.preventDefault()
    $('register-form').style.display = 'none'
    $('login-form').style.display = 'block'
  })

  /* Logout */
  $('logout-btn').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' })
    if (socket) socket.disconnect()
    currentUser = null
    showAuth()
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

  /* Emoji picker */
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
  $('image-btn').addEventListener('click', () => {
    $('image-input').click()
  })

  $('image-input').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) {
      sendImageMessage(file)
      e.target.value = ''
    }
  })
})
