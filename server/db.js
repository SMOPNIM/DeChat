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
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`)
  saveDb()
}

function saveDb() {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function registerUser(username, password, nickname) {
  const existing = db.exec('SELECT id FROM users WHERE username = ?', [username])
  if (existing.length > 0 && existing[0].values.length > 0) return null
  const hashed = bcrypt.hashSync(password, 10)
  db.run('INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)', [username, hashed, nickname])
  saveDb()
  const result = db.exec('SELECT id, username, nickname FROM users WHERE username = ?', [username])
  const row = result[0].values[0]
  return { id: row[0], username: row[1], nickname: row[2] }
}

function authenticateUser(username, password) {
  const result = db.exec('SELECT id, username, password, nickname, avatar FROM users WHERE username = ?', [username])
  if (result.length === 0 || result[0].values.length === 0) return null
  const row = result[0].values[0]
  if (!bcrypt.compareSync(password, row[2])) return null
  return { id: row[0], username: row[1], nickname: row[3], avatar: row[4] }
}

function getUser(id) {
  const result = db.exec('SELECT id, username, nickname, avatar, created_at FROM users WHERE id = ?', [id])
  if (result.length === 0 || result[0].values.length === 0) return null
  const row = result[0].values[0]
  return { id: row[0], username: row[1], nickname: row[2], avatar: row[3], created_at: row[4] }
}

function saveMessage(userId, content, type = 'text') {
  db.run('INSERT INTO messages (user_id, content, type) VALUES (?, ?, ?)', [userId, content, type])
  saveDb()
  const result = db.exec(`SELECT m.id, m.content, m.type, m.created_at,
    u.id as user_id, u.username, u.nickname, u.avatar
    FROM messages m JOIN users u ON m.user_id = u.id
    WHERE m.id = (SELECT MAX(id) FROM messages)`)
  const row = result[0].values[0]
  return { id: row[0], content: row[1], type: row[2], created_at: row[3],
    user_id: row[4], username: row[5], nickname: row[6], avatar: row[7] }
}

function getMessages() {
  const result = db.exec(`SELECT m.id, m.content, m.type, m.created_at,
    u.id as user_id, u.username, u.nickname, u.avatar
    FROM messages m JOIN users u ON m.user_id = u.id
    ORDER BY m.created_at ASC LIMIT 100`)
  if (result.length === 0) return []
  return result[0].values.map(row => ({
    id: row[0], content: row[1], type: row[2], created_at: row[3],
    user_id: row[4], username: row[5], nickname: row[6], avatar: row[7],
  }))
}

module.exports = { initDb, registerUser, authenticateUser, getUser, saveMessage, getMessages }
