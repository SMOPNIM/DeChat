const express = require('express')
const session = require('express-session')
const path = require('path')
const http = require('http')
const { Server } = require('socket.io')
const { initDb } = require('./db')
const authRoutes = require('./routes/auth')
const messageRoutes = require('./routes/messages')

async function main() {
  await initDb()

  const app = express()
  const server = http.createServer(app)
  const io = new Server(server)

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(session({
    secret: 'dechat-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  }))

  app.use(express.static(path.join(__dirname, '..', 'public')))
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

  app.use('/api/auth', authRoutes)
  app.use('/api/messages', messageRoutes)

  app.set('io', io)

  const onlineUsers = new Map()

  io.on('connection', (socket) => {
    console.log(`[Socket] 用户已连接: ${socket.id}`)

    socket.on('user:online', (user) => {
      onlineUsers.set(socket.id, user)
      io.emit('online_users', Array.from(onlineUsers.values()))
    })

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.id)
      io.emit('online_users', Array.from(onlineUsers.values()))
      console.log(`[Socket] 用户已断开: ${socket.id}`)
    })
  })

  const PORT = process.env.PORT || 3000
  server.listen(PORT, () => {
    console.log(`德信 (DeChat) 聊天室已启动: http://localhost:${PORT}`)
  })
}

main().catch(console.error)
