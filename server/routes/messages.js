const { Router } = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const { saveMessage, getMessages } = require('../db')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads'),
  filename(req, file, cb) {
    const ext = path.extname(file.originalname)
    cb(null, `${crypto.randomUUID()}${ext}`)
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

router.get('/', (req, res) => {
  const messages = getMessages()
  res.json({ messages })
})

router.post('/', upload.single('image'), (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未登录' })
  }

  let content = req.body.content || ''
  let type = req.body.type || 'text'

  if (req.file) {
    type = 'image'
    content = `/uploads/${req.file.filename}`
  } else if (!content.trim()) {
    return res.status(400).json({ error: '消息不能为空' })
  }

  const message = saveMessage(req.session.userId, content, type)
  req.app.get('io').emit('new_message', message)
  res.json({ message })
})

module.exports = router
