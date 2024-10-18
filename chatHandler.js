import { FactionManager } from './factionManager.js'
import { BlobManager } from './blobManager.js'
import { commands } from './shared.js'

export const ChatHandler = {
  /**
   * @param {{username: string, command: string, value: string, args: string[]}} chatData
   */
  processMessage: function (chatData) {
    const { username, command, value, args } = chatData

    if (command == '!join' && value) {
      FactionManager.joinFaction(value, username)
    } else if (commands.includes(command)) {
      BlobManager.moveBlob(username, command.slice(1))
    }
    this.updateChatDisplay(chatData)
  },
  updateChatDisplay: function (chatData) {
    const message = `${chatData.command} ${chatData.value} ${chatData.args.join(' ')}`
    const chatDiv = document.getElementById('chat')
    const messageElement = document.createElement('p')
    messageElement.textContent = `${chatData.username}: ${message}`
    chatDiv.appendChild(messageElement)
    chatDiv.scrollTop = chatDiv.scrollHeight
  }
}
