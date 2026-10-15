/* Raabta service worker: offline app shell + cached libraries.
   Push/notification code: purani sw.js ka naam sw-push.js kar do, wo yahan se load hogi. */
var CACHE="raabta-shell-v1";
var PUSH_OK=false;
try{importScripts("sw-push.js");PUSH_OK=true}catch(e){}
var SCOPE=self.registration.scope;
var EXT=["www.gstatic.com","cdn.jsdelivr.net","fonts.googleapis.com","fonts.gstatic.com","cdnjs.cloudflare.com"];
var PRE=[SCOPE,SCOPE+"index.html",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js"];

self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(PRE.map(function(u){
      var ext=u.indexOf(SCOPE)!==0;
      return fetch(new Request(u,ext?{mode:"cors",credentials:"omit"}:{cache:"reload"}))
        .then(function(r){if(r&&r.ok)return c.put(u,r)}).catch(function(){});
    }));
  }).then(function(){return self.skipWaiting()}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==CACHE&&k.indexOf("raabta-shell-")===0}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});

function navFetch(req,key){
  return caches.open(CACHE).then(function(c){
    var net=fetch(req).then(function(r){if(r&&r.ok)c.put(key,r.clone()).catch(function(){});return r});
    var fb=function(){
      return c.match(key).then(function(m){return m||c.match(SCOPE+"index.html")}).then(function(m){return m||c.match(SCOPE)});
    };
    return new Promise(function(resolve){
      var done=false;
      var t=setTimeout(function(){fb().then(function(m){if(m&&!done){done=true;resolve(m)}})},4000);
      net.then(function(r){if(!done){done=true;clearTimeout(t);resolve(r)}},function(){
        clearTimeout(t);
        fb().then(function(m){
          if(done)return;done=true;
          resolve(m||new Response("Offline - open the app once with internet first.",{status:503,headers:{"Content-Type":"text/plain"}}));
        });
      });
    });
  });
}
function swr(e,req){
  var ext=new URL(req.url).origin!==self.location.origin;
  var nreq=ext?new Request(req.url,{mode:"cors",credentials:"omit"}):req;
  return caches.open(CACHE).then(function(c){
    return c.match(req.url).then(function(m){
      var net=fetch(nreq).then(function(r){if(r&&r.ok)c.put(req.url,r.clone()).catch(function(){});return r}).catch(function(){return null});
      if(m){e.waitUntil(net);return m}
      return net.then(function(r){return r||new Response("",{status:504})});
    });
  });
}
self.addEventListener("fetch",function(e){
  var req=e.request;
  if(req.method!=="GET")return;
  var u;try{u=new URL(req.url)}catch(x){return}
  if(u.protocol!=="http:"&&u.protocol!=="https:")return;
  var same=u.origin===self.location.origin;
  if(req.mode==="navigate"){if(same)e.respondWith(navFetch(req,u.origin+u.pathname));return}
  if(!same&&EXT.indexOf(u.hostname)<0)return;
  if(same&&/\/(sw|sw-push)\.js$/.test(u.pathname))return;
  e.respondWith(swr(e,req));
});

if(!PUSH_OK){
  self.addEventListener("push",function(e){
    var p={};
    try{p=e.data?e.data.json():{}}catch(x){try{p={body:e.data.text()}}catch(y){}}
    var n=p.notification||{},d=p.data||p;
    e.waitUntil(self.registration.showNotification(n.title||d.title||d.from||"Raabta",{body:n.body||d.body||d.text||"New message",data:d}));
  });
  self.addEventListener("notificationclick",function(e){
    e.notification.close();
    var d=e.notification.data||{},k=d.k||d.open||"";
    e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(function(l){
      if(l.length){var c=l[0];if(c.focus)c.focus();if(k)c.postMessage({open:k});return}
      return self.clients.openWindow(SCOPE+(k?"?open="+encodeURIComponent(k):""));
    }));
  });
}
