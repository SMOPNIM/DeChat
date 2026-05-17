const { Router } = require('express')
const { createGroup, getGroups, getGroupMembers, getFriends } = require('../db')

const router = Router()

router.use((req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: '未登录' })
  next()
})

router.get('/', (req, res) => {
  const groups = getGroups(req.session.userId)
  res.json({ groups })
})

router.get('/:id/members', (req, res) => {
  const members = getGroupMembers(parseInt(req.params.id))
  res.json({ members })
})

router.post('/', (req, res) => {
  const { name, member_ids } = req.body
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入群组名称' })
  if (!member_ids || member_ids.length < 1) return res.status(400).json({ error: '请选择至少一位好友' })

  const friends = getFriends(req.session.userId)
  const friendIds = new Set(friends.map(f => f.id))
  for (const id of member_ids) {
    if (!friendIds.has(id)) return res.status(400).json({ error: '只能邀请好友进群' })
  }

  const group = createGroup(name.trim(), req.session.userId, member_ids)
  const allIds = [req.session.userId, ...member_ids]
  const io = req.app.get('io')
  if (io) {
    allIds.forEach(uid => {
      io.to(`user:${uid}`).emit('group_created', { group, user_id: uid })
    })
  }
  res.json({ group })
})

module.exports = router
