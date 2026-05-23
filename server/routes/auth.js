const { Router } = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const { registerUser, authenticateUser, getUser, updateUserProfile, updateUserPassword } = require('../db')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename(req, file, cb) {
    const ext = path.extname(file.originalname)
    cb(null, `avatar_${crypto.randomUUID()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, allowed.includes(ext))
  },
})

const router = Router()

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '未登录' })
  next()
}

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

router.put('/profile', requireAuth, (req, res) => {
  const { username, nickname } = req.body
  const result = updateUserProfile(req.session.userId, { username, nickname })
  if (result.error) return res.status(400).json({ error: result.error })
  res.json(result)
})

router.put('/password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写所有字段' })
  if (newPassword.length < 6) return res.status(400).json({ error: '新密码长度至少 6 位' })
  const result = updateUserPassword(req.session.userId, oldPassword, newPassword)
  if (result.error) return res.status(400).json({ error: result.error })
  res.json(result)
})

router.post('/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择头像图片' })
  const avatarUrl = `/uploads/${req.file.filename}`
  const result = updateUserProfile(req.session.userId, { avatar: avatarUrl })
  if (result.error) return res.status(400).json({ error: result.error })
  res.json({ avatar: avatarUrl })
})

module.exports = router
