const { Router } = require('express')
const crypto = require('crypto')
const { getConversations, getConversationParticipants, getPrivateConversationName } = require('../db')

const router = Router()

router.use((req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: '未登录' })
  next()
})

router.get('/', (req, res) => {
  const conversations = getConversations(req.session.userId)
  // fill display name for private conversations
  const result = conversations.map(c => {
    if (c.type === 'private' && (!c.name || c.group_id)) {
      const name = getPrivateConversationName(req.session.userId, c.id)
      return { ...c, name }
    }
    return c
  })
  res.json({ conversations: result })
})

router.get('/private/:friendId', (req, res) => {
  const friendId = parseInt(req.params.friendId)
  const userId = req.session.userId
  // find existing private conversation
  const convs = getConversations(userId)
  // we need to check if any conversation has both users
  const found = convs.find(c => {
    if (c.type !== 'private') return false
    const participants = getConversationParticipants(c.id)
    return participants.includes(userId) && participants.includes(friendId)
  })
  if (found) return res.json({ conversation_id: found.id })
  res.json({ conversation_id: null })
})

module.exports = router
