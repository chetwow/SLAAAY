// Connect to the WebSocket server
const socket = new WebSocket('ws://localhost:8080');

socket.addEventListener('open', () => {
  console.log('Connected to the WebSocket server');
});

socket.addEventListener('message', (event) => {
  const chatData = JSON.parse(event.data);
  console.log(`${chatData.username}: ${chatData.message}`);
  
  // Display the message in the chat box
  const chatDiv = document.getElementById('chat');
  const messageElement = document.createElement('p');
  messageElement.textContent = `${chatData.username}: ${chatData.message}`;
  chatDiv.appendChild(messageElement);
  chatDiv.scrollTop = chatDiv.scrollHeight; // Auto-scroll to the bottom
});
