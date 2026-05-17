const path = require('path')
const fs = require('fs')
const bcrypt = require('bcryptjs')

const DB_PATH = path.join(__dirname, '..', 'dechat.db')
const initSqlJs = require('sql.js')

let SQL = null
let db = null

async function initDb() {
  SQL = await initSqlJs()
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }
  db.run('PRAGMA foreign_keys=ON')

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    created_at DATETIME DEFAULT (datetime('now'))
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS groups_t (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (creator_id) REFERENCES users(id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups_t(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(group_id, user_id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT 'private',
    name TEXT,
    group_id INTEGER,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES groups_t(id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS conversation_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(conversation_id, user_id)
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    conversation_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  )`)

  // create general conversation if not exists
  const gen = db.exec('SELECT id FROM conversations WHERE id = 1')
  if (gen.length === 0 || gen[0].values.length === 0) {
    db.run("INSERT INTO conversations (id, type, name) VALUES (1, 'group', '所有人')")
  }
  saveDb()
}

function saveDb() {
  if (!db) return
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()))
}

// users
function registerUser(username, password, nickname) {
  const existing = db.exec('SELECT id FROM users WHERE username = ?', [username])
  if (existing.length > 0 && existing[0].values.length > 0) return null
  const hashed = bcrypt.hashSync(password, 10)
  db.run('INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)', [username, hashed, nickname])
  saveDb()
  const r = db.exec('SELECT id, username, nickname FROM users WHERE username = ?', [username])
  const row = r[0].values[0]
  // auto-join general conversation
  db.run('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (1, ?)', [row[0]])
  saveDb()
  return { id: row[0], username: row[1], nickname: row[2] }
}

function authenticateUser(username, password) {
  const r = db.exec('SELECT id, username, password, nickname, avatar FROM users WHERE username = ?', [username])
  if (r.length === 0 || r[0].values.length === 0) return null
  const row = r[0].values[0]
  if (!bcrypt.compareSync(password, row[2])) return null
  return { id: row[0], username: row[1], nickname: row[3], avatar: row[4] }
}

function getUser(id) {
  const r = db.exec('SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?', [id])
  if (r.length === 0 || r[0].values.length === 0) return null
  const row = r[0].values[0]
  return { id: row[0], username: row[1], nickname: row[2], avatar: row[3], created_at: row[4] }
}

function searchUsers(query) {
  const r = db.exec('SELECT id, username, nickname FROM users WHERE username LIKE ? OR nickname LIKE ? LIMIT 20',
    [`%${query}%`, `%${query}%`])
  if (r.length === 0) return []
  return r[0].values.map(row => ({ id: row[0], username: row[1], nickname: row[2] }))
}

// friendships
function sendFriendRequest(userId, friendUsername) {
  const target = db.exec('SELECT id FROM users WHERE username = ?', [friendUsername])
  if (target.length === 0 || target[0].values.length === 0) return { error: '用户不存在' }
  const friendId = target[0].values[0][0]
  if (friendId === userId) return { error: '不能加自己为好友' }
  const existing = db.exec('SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?', [userId, friendId])
  if (existing.length > 0 && existing[0].values.length > 0) {
    const s = existing[0].values[0][0]
    if (s === 'accepted') return { error: '已是好友' }
    if (s === 'pending') return { error: '已发送过请求' }
  }
  // check reverse
  const rev = db.exec('SELECT status FROM friendships WHERE user_id = ? AND friend_id = ?', [friendId, userId])
  if (rev.length > 0 && rev[0].values.length > 0) {
    const s = rev[0].values[0][0]
    if (s === 'accepted') return { error: '已是好友' }
    if (s === 'pending') {
      // auto-accept
      db.run('UPDATE friendships SET status = ? WHERE user_id = ? AND friend_id = ?', ['accepted', friendId, userId])
      db.run('INSERT OR IGNORE INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)', [userId, friendId, 'accepted'])
      createPrivateConversation(userId, friendId)
      saveDb()
      return { ok: true, auto_accepted: true, friend_id: friendId }
    }
  }
  db.run('INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)', [userId, friendId, 'pending'])
  saveDb()
  return { ok: true, friend_id: friendId }
}

function respondToFriendRequest(requestId, userId, accept) {
  const r = db.exec('SELECT user_id, friend_id FROM friendships WHERE id = ? AND friend_id = ? AND status = ?',
    [requestId, userId, 'pending'])
  if (r.length === 0 || r[0].values.length === 0) return { error: '请求不存在' }
  const requesterId = r[0].values[0][0]
  const status = accept ? 'accepted' : 'rejected'
  db.run('UPDATE friendships SET status = ? WHERE id = ?', [status, requestId])
  if (accept) {
    db.run('INSERT OR IGNORE INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)', [userId, requesterId, 'accepted'])
    createPrivateConversation(userId, requesterId)
  }
  saveDb()
  return { ok: true, status }
}

function createPrivateConversation(u1, u2) {
  // check if conversation exists
  const existing = db.exec(`SELECT cp1.conversation_id FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN conversations c ON c.id = cp1.conversation_id
    WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.type = 'private'
    AND c.group_id IS NULL`, [u1, u2])
  if (existing.length > 0 && existing[0].values.length > 0) return existing[0].values[0][0]
  db.run("INSERT INTO conversations (type) VALUES ('private')")
  const cid = db.exec('SELECT MAX(id) FROM conversations')[0].values[0][0]
  db.run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [cid, u1])
  db.run('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [cid, u2])
  saveDb()
  return cid
}

function getFriendRequests(userId) {
  const r = db.exec(`SELECT f.id, f.user_id, f.created_at,
    u.username, u.nickname FROM friendships f
    JOIN users u ON f.user_id = u.id
    WHERE f.friend_id = ? AND f.status = 'pending'`, [userId])
  if (r.length === 0) return []
  return r[0].values.map(row => ({
    id: row[0], user_id: row[1], created_at: row[2],
    username: row[3], nickname: row[4],
  }))
}

function getFriends(userId) {
  const r = db.exec(`SELECT u.id, u.username, u.nickname, u.avatar FROM friendships f
    JOIN users u ON (f.friend_id = u.id)
    WHERE f.user_id = ? AND f.status = 'accepted'`, [userId])
  if (r.length === 0) return []
  return r[0].values.map(row => ({ id: row[0], username: row[1], nickname: row[2], avatar: row[3] }))
}

function removeFriend(userId, friendId) {
  db.run('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', [userId, friendId])
  db.run('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?', [friendId, userId])
  saveDb()
  return { ok: true }
}

// groups
function createGroup(name, creatorId, memberIds) {
  db.run('INSERT INTO groups_t (name, creator_id) VALUES (?, ?)', [name, creatorId])
  const gid = db.exec('SELECT MAX(id) FROM groups_t')[0].values[0][0]
  db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [gid, creatorId])
  const allIds = [...new Set([creatorId, ...memberIds])]
  allIds.forEach(uid => {
    db.run('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [gid, uid])
  })
  db.run("INSERT INTO conversations (type, name, group_id) VALUES ('group', ?, ?)", [name, gid])
  const cid = db.exec('SELECT MAX(id) FROM conversations')[0].values[0][0]
  allIds.forEach(uid => {
    db.run('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)', [cid, uid])
  })
  saveDb()
  return { id: gid, name, creator_id: creatorId, conversation_id: cid }
}

function getGroups(userId) {
  const r = db.exec(`SELECT g.id, g.name, g.creator_id, c.id as conversation_id FROM groups_t g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN conversations c ON c.group_id = g.id
    WHERE gm.user_id = ?`, [userId])
  if (r.length === 0) return []
  return r[0].values.map(row => ({ id: row[0], name: row[1], creator_id: row[2], conversation_id: row[3] }))
}

function getGroupMembers(groupId) {
  const r = db.exec(`SELECT u.id, u.username, u.nickname FROM group_members gm
    JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ?`, [groupId])
  if (r.length === 0) return []
  return r[0].values.map(row => ({ id: row[0], username: row[1], nickname: row[2] }))
}

// conversations
function getConversations(userId) {
  const r = db.exec(`SELECT c.id, c.type, c.name, c.group_id,
    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_msg,
    (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as msg_count
    FROM conversations c JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = ?
    ORDER BY (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id) DESC`, [userId])
  if (r.length === 0) return []
  return r[0].values.map(row => ({
    id: row[0], type: row[1], name: row[2], group_id: row[3],
    last_msg: row[4], msg_count: row[5],
  }))
}

function getConversationParticipants(conversationId) {
  const r = db.exec('SELECT user_id FROM conversation_participants WHERE conversation_id = ?', [conversationId])
  if (r.length === 0) return []
  return r[0].values.map(row => row[0])
}

function getPrivateConversationName(userId, conversationId) {
  const r = db.exec(`SELECT u.nickname FROM conversation_participants cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.conversation_id = ? AND cp.user_id != ?`, [conversationId, userId])
  if (r.length === 0 || r[0].values.length === 0) return '私聊'
  return r[0].values[0][0]
}

// messages
function saveMessage(userId, conversationId, content, type = 'text') {
  db.run('INSERT INTO messages (user_id, content, type, conversation_id) VALUES (?, ?, ?, ?)',
    [userId, content, type, conversationId])
  saveDb()
  const r = db.exec(`SELECT m.id, m.content, m.type, m.created_at, m.conversation_id,
    u.id as user_id, u.username, u.nickname, u.avatar
    FROM messages m JOIN users u ON m.user_id = u.id
    WHERE m.id = (SELECT MAX(id) FROM messages)`)
  if (r.length === 0 || r[0].values.length === 0) return null
  const row = r[0].values[0]
  return {
    id: row[0], content: row[1], type: row[2], created_at: row[3], conversation_id: row[4],
    user_id: row[5], username: row[6], nickname: row[7], avatar: row[8],
  }
}

function getMessages(conversationId) {
  const r = db.exec(`SELECT m.id, m.content, m.type, m.created_at, m.conversation_id,
    u.id as user_id, u.username, u.nickname, u.avatar
    FROM messages m JOIN users u ON m.user_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC LIMIT 100`, [conversationId])
  if (r.length === 0) return []
  return r[0].values.map(row => ({
    id: row[0], content: row[1], type: row[2], created_at: row[3], conversation_id: row[4],
    user_id: row[5], username: row[6], nickname: row[7], avatar: row[8],
  }))
}

module.exports = {
  initDb, registerUser, authenticateUser, getUser, searchUsers,
  sendFriendRequest, respondToFriendRequest, getFriendRequests, getFriends, removeFriend,
  createGroup, getGroups, getGroupMembers,
  getConversations, getConversationParticipants, getPrivateConversationName,
  saveMessage, getMessages,
}
