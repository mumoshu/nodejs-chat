function message(obj){
  if (obj.type === 'message') {
      var el = null;
      if (obj.message =~ /http:.+\.(png|gif|jpg)/) {
	  el = createPictureMessage(obj);
      } else {
	  el = createTextMessage(obj);
      }
      document.getElementById('chat').appendChild(el);
      document.getElementById('chat').scrollTop = 1000000;
  } else if (obj.type == 'pointer') {
    handlePointerMessage(obj);
  }
}

function createTextMessage(obj) {
    var el = document.createElement('p');
    if ('announcement' in obj) el.innerHTML = '<em>' + esc(obj.announcement) + '</em>';
    else if ('message' in obj) el.innerHTML = '<b>' + esc(obj.message[0]) + ':</b> ' + esc(obj.message[1]);
    return el;
}

function createPictureMessage(obj) {
    var e = document.createElement('p');
    var d = docuemnt.createElement('d');
    var b = document.createElement('b');
    var img = document.createElement('img');
    img.src = obj.message[1];
    b.innerHTML = obj.message[0];
    d.appendChild(b);
    e.appendChild(d);
    e.appendChild(img);
    return e;
}

var pointers = {};

function handlePointerMessage(msg) {
  console.log('handlePointerMessage', msg);
  var div = $('<div></div>');
  var h1 = $('<h1></h1>');
  var img = $('<img></img>');
  div.addClass('pointer');
  div.css('top', msg.y);
  div.css('left', msg.x);
  if (msg.profile_image_url){
    img.attr('src', msg.profile_image_url);
  }
  h1.text(msg.screen_name);
  div.append(h1).append(img);
  $(document.body).append(div);
  var p = pointers[msg.session_id];
  if (p) {
    p.remove();
  }
  pointers[msg.session_id] = div;
}

function send(){
  var val = document.getElementById('text').value;
  socket.send({type: "text", text: val});
  message({ type: 'message', message: ['you', val] });
  document.getElementById('text').value = '';
}

function esc(msg){
  return msg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

var socket = new io.Socket(null, {port: 8080});

function onMessage(obj) {
  if ('buffer' in obj){
    document.getElementById('form').style.display='block';
    document.getElementById('chat').innerHTML = '';
    
    for (var i in obj.buffer) message(obj.buffer[i]);
  } else message(obj);
}

socket.connect();
socket.on('message', onMessage);

$('#form').submit(function(e) {
  send();
  e.preventDefault();
});

var interval = 1000;
var lastSentAt = new Date - interval;

$(document).mousemove(function(e) {
  if (new Date - lastSentAt > interval) {
    var message = {
      type: "pointer",
      x: e.pageX,
      y: e.pageY
    };
    socket.send(message);
    lastSentAt = new Date;
  }
});
