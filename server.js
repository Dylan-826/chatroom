const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASSWORD = "Dylan001388";
let globalBg = "";
let messageList = [];
// 在线用户
const onlineUsers = new Map();
// 被禁言名单
const mutedSet = new Set();

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
  height:50vh;
  overflow-y:auto;
  border:1px solid #444;
  padding:10px;
  margin-bottom:10px;
  border-radius:8px;
  background:rgba(0,0,0,0.65);
}
.msg{ margin:4px 0; padding:4px; }
.name{ font-weight:bold; color:#7cf; }
.input-row{ display:flex; gap:6px; flex-wrap:wrap; margin:6px 0; }
input,button{ padding:8px; font-size:16px; border-radius:6px; border:none; }
button{ background:#38f; color:white; cursor:pointer; }
.admin-panel{ margin-top:12px; padding:10px; border:1px solid #fa4; border-radius:8px; background:rgba(60,40,0,0.4); display:none; }
#userList{
  background:rgba(255,255,255,0.1);
  padding:8px;
  border-radius:6px;
  margin:8px 0;
}
.user-item{
  display:flex;
  gap:4px;
  align-items:center;
  margin:4px 0;
}
</style>
</head>
<body>
<div id="chat"></div>

<div id="userList">
<div>在线用户列表：</div>
<div id="userBox"></div>
</div>

<div class="input-row">
  <input id="nameInput" placeholder="你的昵称">
  <button onclick="setName()">申请改名（管理员审核）</button>
</div>
<div class="input-row">
  <input id="msgInput" placeholder="输入消息">
  <button onclick="sendMsg()">发送</button>
</div>
<div class="input-row">
  <input id="adminPwd" placeholder="管理员密码">
  <button onclick="loginAdmin()">登录管理员</button>
</div>

<div class="admin-panel" id="adminPanel">
  <p>管理员面板</p>
  <div class="input-row">
    <input type="file" id="bgFile" accept="image/*">
    <button onclick="uploadBg()">更换背景图</button>
  </div>
  <div class="input-row">
    <input id="targetIdInput" placeholder="用户SocketID">
    <button onclick="muteUser()">禁言/解除禁言</button>
    <button onclick="kickUser()">踢出该用户</button>
  </div>
  <div class="input-row">
    <input id="assignId" placeholder="用户ID">
    <input id="assignName" placeholder="分配昵称">
    <button onclick="assignNick()">给用户分配昵称</button>
  </div>
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
socket.on("userlist", renderUserList);
socket.on("kicked", ()=>{
  alert("你被管理员踢出聊天室！");
  location.reload();
})

function renderMsg(data){
  const div = document.createElement("div");
  div.className="msg";
  div.innerHTML = \`<span class="name">\${data.name}：</span> \${data.content}\`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function renderUserList(users){
  const box = document.getElementById("userBox");
  box.innerHTML = "";
  users.forEach(u=>{
    const d = document.createElement("div");
    d.className = "user-item";
    d.innerHTML = \`[\${u.id}] \${u.name} \${u.muted ? "(已禁言)" : ""}\`;
    box.appendChild(d);
  })
}

function setName(){
  const n = nameInput.value.trim();
  if(!n) return alert("昵称不能为空");
  socket.emit("request-rename", n);
}
function sendMsg(){
  const txt = document.getElementById("msgInput").value.trim();
  if(!myName) return alert("请先设置昵称！");
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
  alert("管理员登录成功");
})
socket.on("admin-fail", ()=>alert("密码错误！"))

function uploadBg(){
  const file = document.getElementById("bgFile").files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    socket.emit("set-bg", e.target.result);
  }
  reader.readAsDataURL(file);
}
function muteUser(){
  const tid = document.getElementById("targetIdInput").value.trim();
  socket.emit("mute", tid);
}
function kickUser(){
  const tid = document.getElementById("targetIdInput").value.trim();
  socket.emit("kick", tid);
}
function assignNick(){
  const tid = document.getElementById("assignId").value.trim();
  const newN = document.getElementById("assignName").value.trim();
  socket.emit("assign-name", {id:tid, name:newN});
}
socket.on("rename-success", (newname)=>{
  myName = newname;
  localStorage.setItem("chatName", myName);
  alert("昵称已更新："+newname);
})
</script>
</body>
</html>
`;

app.get('/', (req,res)=>{
  res.send(htmlPage);
})

io.on('connection', (socket) => {
  onlineUsers.set(socket.id, {
    id:socket.id,
    name:"访客",
    muted:false
  });
  broadcastUserList();
  socket.emit('history', messageList);
  socket.emit('bg-update', globalBg);

  socket.on("request-rename", (newName)=>{
    if(!onlineUsers.has(socket.id)) return;
    if(onlineUsers.get(socket.id).muted) return;
    onlineUsers.get(socket.id).name = newName;
    socket.emit("rename-success", newName);
    broadcastUserList();
  })

  socket.on('chat', (data) => {
    const u = onlineUsers.get(socket.id);
    if(!u) return;
    if(u.muted){
      socket.emit("msg", "你已经被禁言，不能发送消息");
      return;
    }
    messageList.push(data);
    if(messageList.length>120) messageList.shift();
    io.emit('chat', data);
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

  socket.on("mute", (targetId)=>{
    if(!socket.isAdmin) return;
    if(!onlineUsers.has(targetId)) return;
    const user = onlineUsers.get(targetId);
    user.muted = !user.muted;
    broadcastUserList();
  })

  socket.on("kick", (targetId)=>{
    if(!socket.isAdmin) return;
    const targetSocket = io.sockets.sockets.get(targetId);
    if(targetSocket){
      targetSocket.emit("kicked");
      targetSocket.disconnect(true);
    }
    onlineUsers.delete(targetId);
    broadcastUserList();
  })

  socket.on("assign-name", ({id,name})=>{
    if(!socket.isAdmin) return;
    if(!onlineUsers.has(id)) return;
    onlineUsers.get(id).name = name;
    const targetSocket = io.sockets.sockets.get(id);
    if(targetSocket) targetSocket.emit("rename-success", name);
    broadcastUserList();
  })

  socket.on("disconnect", ()=>{
    onlineUsers.delete(socket.id);
    broadcastUserList();
  })

  function broadcastUserList(){
    io.emit("userlist", Array.from(onlineUsers.values()));
  }
})

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>{
  console.log("✅ 聊天室启动成功");
})
