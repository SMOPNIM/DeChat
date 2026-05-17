const { Router } = require('express')
const { registerUser, authenticateUser, getUser } = require('../db')

const router = Router()

router.post('/register', (req, res) => {
  const { username, password, nickname } = req.body
  if (!username || !password || !nickname) {
    return res.status(400).json({ error: '请填写所有字段' })
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在 2-20 个字符之间' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度至少 6 位' })
  }
  const user = registerUser(username, password, nickname)
  if (!user) {
    return res.status(409).json({ error: '用户名已存在' })
  }
  req.session.userId = user.id
  res.json({ user })
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' })
  }
  const user = authenticateUser(username, password)
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }
  req.session.userId = user.id
  res.json({ user })
})

router.post('/logout', (req, res) => {
  req.session.destroy()
  res.json({ ok: true })
})

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未登录' })
  }
  const user = getUser(req.session.userId)
  if (!user) {
    return res.status(401).json({ error: '用户不存在' })
  }
  res.json({ user })
})

module.exports = router
