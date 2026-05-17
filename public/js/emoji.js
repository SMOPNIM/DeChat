const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗',
  '😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫡',
  '🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴',
  '😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🥳','🥺','😢','😭','😤','😠','😡','🤬',
  '👋','🤚','🖐','✋','🖖','🫶','👌','🤌','🤏','✌','🤞','🫰','🤟','🤘','🤙','👈',
  '👉','👆','🖕','👇','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💕','💞','💗','💖','💘','💝','💟',
  '👍','🔥','⭐','✨','💯','🎉','🎊','🎈','🎁','🎀','💪','👏','🙏','💪','🧠','👀',
]

const GIF_STICKERS = [
  { url: 'https://media.tenor.com/-F1dHghQrD8AAAAC/thanks-sticker.gif', name: '谢谢' },
  { url: 'https://media.tenor.com/HiK99yAYByAAAAAC/clapping-applause.gif', name: '鼓掌' },
  { url: 'https://media.tenor.com/m3rog6YHwP4AAAAC/thumbs-up-ok.gif', name: '赞' },
  { url: 'https://media.tenor.com/h1oJmHKqVX8AAAAC/laughing-funny.gif', name: '大笑' },
  { url: 'https://media.tenor.com/loPSdGYzIaoAAAAC/cute-love.gif', name: '爱你' },
  { url: 'https://media.tenor.com/sJ0YjbLWIMgAAAAC/sad-cry.gif', name: '哭泣' },
  { url: 'https://media.tenor.com/1L4CqmdzRIEAAAAC/wow-sticker.gif', name: '惊讶' },
  { url: 'https://media.tenor.com/qQpECeYEhW4AAAAC/angry.gif', name: '生气' },
  { url: 'https://media.tenor.com/GSJrnAM-FrMAAAAC/hi-hello.gif', name: '你好' },
  { url: 'https://media.tenor.com/Pm9fXMm8cNQAAAAC/bye-wave.gif', name: '再见' },
  { url: 'https://media.tenor.com/-Uj6U3bG7qYAAAAC/ok-hand.gif', name: 'OK' },
  { url: 'https://media.tenor.com/b5uKKnMckFsAAAAC/party.gif', name: '派对' },
  { url: 'https://media.tenor.com/sFbCQe3DPiEAAAAC/thinking-sticker.gif', name: '思考' },
  { url: 'https://media.tenor.com/xtKBO0HRL8EAAAAC/nice-sticker.gif', name: 'Nice' },
  { url: 'https://media.tenor.com/-F1dHghQrD8AAAAC/thanks-sticker.gif', name: '感谢' },
  { url: 'https://media.tenor.com/H7Y_hOJN6RsAAAAC/fist-bump.gif', name: '碰拳' },
  { url: 'https://media.tenor.com/WxVJmHxIYHMAAAAC/coffee-sticker.gif', name: '咖啡' },
  { url: 'https://media.tenor.com/EcGsEBNaQWQAAAAC/music-dance.gif', name: '跳舞' },
]

function renderEmojiPicker(category) {
  const container = document.getElementById('emoji-content')
  if (category === 'emoji') {
    let html = '<div class="emoji-grid">'
    EMOJI_LIST.forEach(e => { html += `<div class="emoji-item" data-emoji="${e}">${e}</div>` })
    html += '</div>'
    container.innerHTML = html
    container.querySelectorAll('.emoji-item').forEach(el => {
      el.addEventListener('click', () => {
        insertEmoji(el.dataset.emoji)
      })
    })
  } else if (category === 'gif') {
    let html = '<div class="emoji-grid">'
    GIF_STICKERS.forEach(g => {
      html += `<div class="gif-item" data-gif="${g.url}" title="${g.name}"><img src="${g.url}" alt="${g.name}" loading="lazy"></div>`
    })
    html += '</div>'
    container.innerHTML = html
    container.querySelectorAll('.gif-item').forEach(el => {
      el.addEventListener('click', () => {
        insertGif(el.dataset.gif)
      })
    })
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById('message-input')
  const start = input.selectionStart
  const end = input.selectionEnd
  input.value = input.value.substring(0, start) + emoji + input.value.substring(end)
  input.selectionStart = input.selectionEnd = start + emoji.length
  input.focus()
}

function insertGif(url) {
  sendGifMessage(url)
}
