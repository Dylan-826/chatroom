const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const ADMIN_PASSWORD = "admin123";
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
  background-attachment: fixed;
  font-family: system-ui, -apple-system, sans-serif;
}
#chatBox{
  border: 1px solid rgba(255,255,255,0.25);
  padding: 12px;
  height: 62vh;
  overflow-y: auto;
  margin-bottom: 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(4px);
}
.msg-line{
  padding: 8px 10px;
  margin: 5px 0;
  border-radius: 8px;
  background: rgba(0,0,0,0.45);
  color: #fff;
  line-height: 1.5;
  font-size: 16px;
}
.control-row{
  display:flex;
  gap: 8px;
  align-items:center;
  margin-bottom:12px;
  flex-wrap: wrap;
}
.admin-panel{
  background: rgba(255,220,225,0.35);
  border: 1px solid rgba(255,180,190,0.4);
  padding: 12px;
  margin-top:12px;
  border-radius: 12px;
  color: #fff;
}
.admin-panel h4{
  margin:0 0 8px 0;
  font-size:16px;
}
input{
  padding: 10px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.85);
  color: #000;
  font-size: 16px;
  min-width: 120px;
}
button{
  padding: 10px 10px;
  border-radius: 8px;
  border: none;
  background: #ff4d6d;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
}
button:active{
  background: #dd3b58;
}
</style>
</head>
<body>
<div id="chatBox"></div>
<div class="control-row">
  <input id="msgInput" placeholder="输入消息">
  <button onclick="sendMsg()">发送</button>
  <label>
    🖼背景
    <input type="file" id="bgUpload" accept="image/*">
  </label>
  <button onclick="changeNick()">改名</button>
</div>
<div class="admin-panel">
  <h4>管理员控制面板</h4>
  <div class="control-row">
    <input id="adminPwdInput" placeholder="管理员密码">
    <button onclick="loginAdmin()">登录管理员</button>
  </div>
  <div class="control-row">
    <input id="targetNick" placeholder="目标昵称">
    <button onclick="muteUser()">禁言</button>
    <button onclick="unmuteUser()">解除禁言</button>
    <button onclick="kickUser()">踢出</button>
  </div>
</div>
<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const adminPwdInput = document.getElementById("adminPwdInput");
const targetNick = document.getElementById("targetNick");
const bgUpload = document.getElementById("bgUpload");
let isAdmin = false;
let myNickname = "";
function append(text){
  const div = document.createElement("div");
  div.className = "msg-line";
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
function loadNick(){
  const saved = localStorage.getItem("chatNick");
  if(saved && saved.trim() !== ""){
    myNickname = saved.trim();
    socket.emit("setNick", myNickname);
  }else{
    askNick();
  }
}
function askNick(){
  let n = prompt("请输入你的昵称");
  if(!n || n.trim() === ""){
    askNick();
    return;
  }
  myNickname = n.trim();
  localStorage.setItem("chatNick", myNickname);
  socket.emit("setNick", myNickname);
}
function changeNick(){
  let newName = prompt("输入新昵称");
  if(!newName || newName.trim() === ""){
    append("❌昵称不能为空");
    return;
  }
  newName = newName.trim();
  const oldName = myNickname;
  myNickname = newName;
  localStorage.setItem("chatNick", myNickname);
  socket.emit("setNick", myNickname);
  append("✅改名成功：【" + oldName + "】 → 【" + newName + "】");
}
function sendMsg(){
  const content = msgInput.value.trim();
  if(!content) return;
  socket.emit("chat", content);
  msgInput.value = "";
}
function loginAdmin(){
  const pwd = adminPwdInput.value.trim();
  socket.emit("reqAdminLogin", pwd);
  adminPwdInput.value = "";
}
function muteUser(){
  if(!isAdmin){
    append("⚠️你不是管理员，无法操作");
    return;
  }
  const t = targetNick.value.trim();
  if(t) socket.emit("adminMute", t);
}
function unmuteUser(){
  if(!isAdmin){
    append("⚠️你不是管理员，无法操作");
    return;
  }
  const t = targetNick.value.trim();
  if(t) socket.emit("adminUnmute", t);
}
function kickUser(){
  if(!isAdmin){
    append("⚠️你不是管理员，无法操作");
    return;
  }
  const t = targetNick.value.trim();
  if(t) socket.emit("adminKick", t);
}
bgUpload.onchange = function(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(ev){
    socket.emit("changeBg", ev.target.result);
  };
  reader.readAsDataURL(file);
  bgUpload.value = "";
};
socket.on("setBackground", function(bg){
  document.body.style.backgroundImage = "url(" + bg + ")";
});
socket.on("adminOk", function(){
  isAdmin = true;
  append("✅管理员登录成功！现在你可以更换背景、管理用户");
});
socket.on("adminFail", function(){
  append("❌密码错误，登录管理员失败");
});
socket.on("recvMsg", function(data){
  append(data);
});
socket.on("kickNotify", function(){
  append("⚠️你已经被管理员踢出聊天室");
  socket.disconnect();
});
loadNick();
</script>
</body>
</html>
`;
app.get('/', function (req, res) {
  res.send(htmlPage);
});
io.on("connection", function(socket){
  let nick = "";
  let isAdmin = false;
  socket.on("setNick", function(name){
    nick = name;
    userPool.set(socket.id, { nick: nick, muted: false });
    if(globalBg){
      socket.emit("setBackground", globalBg);
    }
  });
  socket.on("chat", function(text){
    if(!nick) return;
    const uInfo = userPool.get(socket.id);
    if(uInfo?.muted){
      socket.emit("recvMsg", "⚠️你当前处于禁言状态，不能发消息");
      return;
    }
    io.emit("recvMsg", nick + ": " + text);
  });
  socket.on("reqAdminLogin", function(pwd){
    if(pwd === ADMIN_PASSWORD){
      isAdmin = true;
      socket.emit("adminOk");
    } else {
      socket.emit("adminFail");
    }
  });
  socket.on("changeBg", function(bgData){
    if(!isAdmin){
      socket.emit("recvMsg", "⚠️只有管理员才能更换背景图");
      return;
    }
    globalBg = bgData;
    io.emit("setBackground", globalBg);
  });
  socket.on("adminMute", function(targetName){
    for(const [sid, user] of userPool){
      if(user.nick === targetName){
        user.muted = true;
        io.to(sid).emit("recvMsg", "⚠️管理员对你执行禁言");
        io.emit("recvMsg", "【管理员操作】已禁言用户：" + targetName);
        break;
      }
    }
  });
  socket.on("adminUnmute", function(targetName){
    for(const [sid, user] of userPool){
      if(user.nick === targetName){
        user.muted = false;
        io.to(sid).emit("recvMsg", "✅管理员解除了你的禁言");
        io.emit("recvMsg", "【管理员操作】解除用户 " + targetName + " 的禁言");
        break;
      }
    }
  });
  socket.on("adminKick", function(targetName){
    for(const [sid, user] of userPool){
      if(user.nick === targetName){
        io.to(sid).emit("kickNotify");
        io.emit("recvMsg", "【管理员操作】踢出用户：" + targetName);
        setTimeout(function(){
          io.sockets.sockets.get(sid)?.disconnect();
          userPool.delete(sid);
        }, 100);
        break;
      }
    }
  });
  socket.on("disconnect", function(){
    userPool.delete(socket.id);
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, function(){
  console.log(`✅服务跑在端口 ${PORT}`);
});
