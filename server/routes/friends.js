const { Router } = require('express')
const { sendFriendRequest, respondToFriendRequest, getFriendRequests, getFriends, removeFriend, searchUsers } = require('../db')

const router = Router()

router.use((req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: '未登录' })
  next()
})

router.get('/', (req, res) => {
  const friends = getFriends(req.session.userId)
  res.json({ friends })
})

router.get('/requests', (req, res) => {
  const requests = getFriendRequests(req.session.userId)
  res.json({ requests })
})

router.get('/search', (req, res) => {
  const q = req.query.q || ''
  if (q.length < 1) return res.json({ users: [] })
  const users = searchUsers(q)
  res.json({ users })
})

router.post('/request', (req, res) => {
  const { username } = req.body
  if (!username) return res.status(400).json({ error: '请输入用户名' })
  const result = sendFriendRequest(req.session.userId, username)
  if (result.error) return res.status(400).json({ error: result.error })
  const io = req.app.get('io')
  if (result.auto_accepted) {
    io.emit('friend_updated', { user_id: req.session.userId, friend_id: result.friend_id, status: 'accepted' })
  } else {
    if (io) {
      const sockets = require('socket.io')
    }
  }
  res.json(result)
})

router.post('/respond', (req, res) => {
  const { request_id, accept } = req.body
  if (!request_id) return res.status(400).json({ error: '参数错误' })
  const result = respondToFriendRequest(request_id, req.session.userId, accept)
  if (result.error) return res.status(400).json({ error: result.error })
  const io = req.app.get('io')
  if (io) io.emit('friend_updated', { user_id: req.session.userId, status: result.status })
  res.json(result)
})

router.delete('/:id', (req, res) => {
  const friendId = parseInt(req.params.id)
  removeFriend(req.session.userId, friendId)
  res.json({ ok: true })
})

module.exports = router
