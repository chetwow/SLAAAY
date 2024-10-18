import 'dotenv/config'
import { commands } from '../shared.js'
import tmi from 'tmi.js'
import { getEmotes } from './emotes.js'
import { WebSocketServer } from 'ws'

// Twitch Chat Client Setup
const twitchClient = new tmi.Client({
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH_TOKEN
  },
  channels: [process.env.TWITCH_CHANNEL]
})

Promise.all([getEmotes(), twitchClient.connect()])
  .then((result) => {
    console.log('Initialized.')
    console.table(result[0])
  })
  .catch((err) => {
    console.error('Initialization failed:', err)
  })

// WebSocket Server Setup
const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  console.log('A new client connected!')

  // Forward Twitch chat messages to the WebSocket client
  twitchClient.on('message', (channel, tags, message, self) => {
    const username = tags['display-name']
    let [command, value, ...args] = message.split(' ')
    command = command.toLowerCase()
    console.log(`${username}: ${message}`)

    // don't send message to client if it isnt a command
    if (!commands.includes(command)) return

    ws.send(JSON.stringify({ username, command, value, args }))
  })
})
