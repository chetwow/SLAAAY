import { channelId, emotes } from './shared.js'

const url = 'https://7tv.io/v3/users/twitch/'

export async function getEmotes() {
  let emoteSet
  try {
    const response = await fetch(url + channelId)
    const data = await response.json()
    emoteSet = data['emote_set']
  } catch (error) {
    console.error('Error getting emote set: ', error)
  }
  if (!emoteSet || !emoteSet.emotes) return

  emoteSet.emotes.forEach((emote) => {
    let url = `https:${emote.data.host.url}/4x.webp`
    // if (emote.data.animated) {
    //   url += '_static.webp'
    // } else url += '.webp'

    emotes.set(emote.name, {
      url,
      id: emote.id,
      name: emote.name,
      zeroWidth: emote.data.flags === 256,
      animated: emote.data.animated
    })
  })
  return emotes
}
