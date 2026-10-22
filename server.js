const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ADMIN_PASSWORD = "admin123";

// 连接MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB 连接成功"))
.catch(err => console.log("❌ MongoDB连接失败：", err));

// 消息表结构
const msgSchema = new mongoose.Schema({
  name: String,
  content: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', msgSchema);

// 在线用户
const userPool = new Map();
let globalBg = "";

const htmlPage = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>聊天室</title>
<style>
*{ box-sizing: border-box; }
body{
  margin: 8px;
  background-color: #111;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  color:#fff;
  font-family:system-ui;
}
#chat{
  height:60vh;
  overflow-y:auto;
  border:1px solid #444;
  padding:10px;
  margin-bottom:10px;
  border-radius:8px;
  background:rgba(0,0,0,0.65);
}
.msg{ margin:4px 0; padding:4px; }
.name{ font-weight:bold; color:#7cf; }
.input-row{ display:flex; gap:6px; flex-wrap:wrap; }
input,button{ padding:8px; font-size:16px; border-radius:6px; border:none; }
button{ background:#38f; color:white; cursor:pointer; }
.admin-panel{ margin-top:12px; padding:10px; border:1px solid #fa4; border-radius:8px; background:rgba(60,40,0,0.4); display:none; }
</style>
</head>
<body>
<div id="chat"></div>
<div class="input-row">
  <input id="nameInput" placeholder="你的昵称">
  <button onclick="setName()">改名</button>
</div>
<div class="input-row" style="margin-top:8px">
  <input id="msgInput" placeholder="输入消息">
  <button onclick="sendMsg()">发送</button>
</div>
<div class="input-row" style="margin-top:8px">
  <input id="adminPwd" placeholder="管理员密码">
  <button onclick="loginAdmin()">登录管理员</button>
</div>
<div class="admin-panel" id="adminPanel">
  <p>管理员功能（仅你可用）</p>
  <input type="file" id="bgFile" accept="image/*">
  <button onclick="uploadBg()">更换聊天背景</button>
</div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let myName = localStorage.getItem("chatName") || "";
let isAdmin = false;
const chatBox = document.getElementById("chat");
const nameInput = document.getElementById("nameInput");
nameInput.value = myName;

socket.on("history", (list)=>{
  list.forEach(m=>renderMsg(m));
})
socket.on("chat", (data)=>{
  renderMsg(data);
})
socket.on("bg-update", (url)=>{
  document.body.style.backgroundImage = url ? \`url(\${url})\` : "";
})

function renderMsg(data){
  const div = document.createElement("div");
  div.className="msg";
  div.innerHTML = \`<span class="name">\${data.name}：</span> \${data.content}\`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setName(){
  const n = nameInput.value.trim();
  if(!n) return alert("名字不能为空");
  myName = n;
  localStorage.setItem("chatName", myName);
  alert("改名成功");
}
function sendMsg(){
  const txt = document.getElementById("msgInput").value.trim();
  if(!myName) return alert("先设置昵称！");
  if(!txt) return;
  socket.emit("chat", {name:myName, content:txt});
  document.getElementById("msgInput").value = "";
}
function loginAdmin(){
  const pwd = document.getElementById("adminPwd").value;
  socket.emit("admin-login", pwd);
}
socket.on("admin-ok", ()=>{
  isAdmin = true;
  document.getElementById("adminPanel").style.display="block";
  alert("管理员登录成功！");
})
socket.on("admin-fail", ()=>alert("密码错误"))

function uploadBg(){
  const file = document.getElementById("bgFile").files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    socket.emit("set-bg", e.target.result);
  }
  reader.readAsDataURL(file);
}
</script>
</body>
</html>
`;

app.get('/', (req,res)=>{
  res.send(htmlPage);
})

io.on('connection', async (socket) => {
  console.log('新用户连接', socket.id);
  const history = await Message.find().sort({time:1}).limit(120);
  socket.emit('history', history);
  socket.emit('bg-update', globalBg);

  socket.on('chat', async (data) => {
    const newMsg = await Message.create(data);
    io.emit('chat', newMsg);
  })
  socket.on("admin-login", (pwd)=>{
    if(pwd === ADMIN_PASSWORD){
      socket.emit("admin-ok");
      socket.isAdmin = true;
    }else{
      socket.emit("admin-fail");
    }
  })
  socket.on("set-bg", (bgStr)=>{
    if(!socket.isAdmin) return;
    globalBg = bgStr;
    io.emit("bg-update", globalBg);
  })
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log("服务启动", PORT);
})
