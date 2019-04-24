/**
 * boot.js -- loads lively in any page that inserts through a script tag
 *
 **/

/* global lively4performance */
/* eslint no-console: off */

/*
 #TODO refactor booting/loading/init of lively4
  - currently we have different entry points we should unify
 */


// BEGIN COPIED HERE BECAUSE resuse through libs does not work yet
function loadJavaScriptThroughDOM(name, src, force) {
  return new Promise(function (resolve) {
    var scriptNode = document.querySelector(name);
    if (scriptNode) {
      scriptNode.remove();
    }
    var script = document.createElement("script");
    script.id = name;
    script.charset = "utf-8";
    script.type = "text/javascript";
    script.setAttribute("data-lively4-donotpersist","all");
    if (force) {
      src += +"?" + Date.now();
    }
    script.src = src;
    script.onload = function () {
      resolve();
    };
    document.head.appendChild(script);
  });
}
// END COPIED


async function lively4fillCachedFileMap(filelist) {
  var root = lively4url +  "/"
  if (!filelist) {
    filelist =   await fetch(root, {
      method: "OPTIONS",
      headers: {
        filelist: true
      }
    }).then(r => r.json()).then(r => r.contents.map(ea => ea.name.replace(/^\.\//,url)))
  }
  if (!self.lively4cacheFiles) {
    self.lively4cacheFiles = new Map()  // indexDB or dexie are to slow (60ms for simple checking if it is there #TODO)
  } 
  var map =self.lively4cacheFiles 
  for(var url of filelist) {
    map.set(url, {exists: true})
  }
}
  
// #BUG the browser cache API blocks (promises does not resolve) sometimes?
// #BUG the performance, in our alternative to use IndexedDB can quickly degrate when DB gets to big...
// window.localStorage["livel4systemjscache"] = false
window.lively4plugincache = window.localStorage["livel4systemjscache"] == "true";
if (lively4plugincache) {
  console.log("ENABLE " + lively4plugincache)
}

window.lively4currentbootid = "" + new Date()
window.lively4bootlogData = []
window.lively4bootlog = function add(url, date=Date.now(), mode="load", time=0, parentURL) {
  lively4bootlogData.push({
    url, date, mode, time, parentURL, bootid: lively4currentbootid
  })
}
// localStorage["logLivelyBoot"] = true
if (!(localStorage["logLivelyBoot"] == "true")) {
  window.lively4bootlog = function() {
    // do nothing
  }
}

// localStorage["useTranspilationCache"]  = true
self.lively4useTranspilationCache = localStorage["useTranspilationCache"]
self.lively4transpilationCache = {
  cache: new Map()
} 

var Dexie;
self.transpilationCacheDB

var fileInfoDB


let PerformanceLogsEnabled = true
async function logTime(msg, exec) {
  var start = performance.now()
  await exec()
  if (PerformanceLogsEnabled) console.log(msg + " (" + Math.round(performance.now() - start) + "ms)")
}


async function invalidateFileCaches()  {
  Dexie = (await System.import(lively4url + "/src/external/dexie.js")).default
 await logTime("initialize fileInfoDB", async () => {
    fileInfoDB = new Dexie("fileInfoDB");
    fileInfoDB.version("1").stores({
      files: 'url, modified, version',
    }).upgrade(function () { })
  })
  
  if (self.lively4useTranspilationCache) {
    await logTime("initialize transpilation cache", async () => {
      self.lively4transpilationCacheDB = new Dexie("transpilationCache");
      self.lively4transpilationCacheDB.version("1").stores({
        transpilations: 'url, modified, version',
      }).upgrade(function () { })
    })

    
    await self.lively4transpilationCacheDB.transpilations.each(ea => {
      self.lively4transpilationCache.cache.set(ea.url, {
        input: ea.input,
        output: ea.output,
        map: ea.map && JSON.parse(ea.map),
        modified: ea.modified,
        version: ea.version
      })
    }) 
    
   
  }
  var offlineFirstCache
  var json
  var url = lively4url + "/"
  await logTime("load file list from server", async () => {
    try {
      if (!window.caches) {
        console.warn("window.caches not defined")
        return
      }
      if (self.lively && lively.fileIndexWorker) {
        lively.fileIndexWorker.postMessage({message: "updateDirectory", url})
      }
      offlineFirstCache = await caches.open("offlineFirstCache")
      self.lively4offlineFirstCache = offlineFirstCache
      json = await Promise.race([
        new Promise(r => {
          setTimeout(() => r(false), 5000) // give the server 5secs ... might be an old one or somthing, anyway keep going!
        })
        ,fetch(url, {
          method: "OPTIONS",
          headers: {
            filelist  : true
          }
        }).then(async resp => {
          if (resp.status != 200) {
            console.log("PROBLEM invalidateFileCaches SERVER RESP " + resp.status)
            return false
          } else {
            try {
              var text = await resp.text()
              return JSON.parse(text)
            } catch(e) {
              console.log("could not parse: " + text)
              return undefined
            }
          }
        })
      ])
    } catch(e) {
      console.log("PROBLEM invalidateFileCaches " + e)
      return
    }
  })

  if (!json) {
    console.log('[boot] invalidateFileCaches: could not invalidate flash... should we clean it all?')
    return
  }
  var list = json.contents
  

  var found = 0
  var ignored = 0
  var invalidated = 0
  
  var start = performance.now()
  var filelist = []
  
  
  fileInfoDB.transaction("rw", ["files"], async () => {
    await Promise.all(list.map(async ea => {
      if (!ea.name) return
      var fileURL = url + ea.name.replace(/^.\//,"")

      if (fileURL.match(/node_modules/)) {
        ignored++
        return  // ignore 4000 files we don't care
      }
      filelist.push(fileURL)

      fileInfoDB.files.put({
          url: fileURL,
          modified: ea.modified})

      var cached  = await offlineFirstCache.match(fileURL)

      if (cached) {
        found++
        // #TODO this means loading over 2000 files (or responses) from the disk... and looking at their headers, we should maybe use indexdDB for this? Merge our file index? 
        var cachedModified = cached.headers.get("modified")
        if (ea.modified > cachedModified) {
          console.log("invalidate cache " + fileURL + `${ea.modified} > ${cachedModified}`)
          offlineFirstCache.delete(fileURL) // we could start loading it again?
          invalidated++
        } else {
          // console.log("keep " + ea.modified)
        }
      }
    }))
  })
  
  await lively4fillCachedFileMap(filelist)
  console.log("[boot] invalidateFileCaches: cache invalidation for loop in " + (performance.now() - start) 
              + "ms, in cache  " + found + " files, " 
              + "ignored" + ignored +" files, deleted " + invalidated + " files")
}

async function preloadFileCaches() {
  await loadJavaScriptThroughDOM("JSZip", lively4url + "/src/external/jszip.js" )
  
  
  var start = performance.now()
  var preloadurl = lively4url + "/test.zip"
  var resp = await fetch(preloadurl)
  if (resp.status != "200") {
    console.warn("NO preload cache found in", preloadurl)
    return 
  }
  var contents = await resp.blob()

  var archive = await self.JSZip.loadAsync(contents)
  console.log("[boot] preloadFileCache fetched contents in  " + Math.round(performance.now() - start) + "ms")

  start = performance.now()
  for(var ea of Object.keys(archive.files)) {
    var file = archive.file(ea);
    if (file) {
      var modified = file.date.toISOString().replace(/T/, " ").replace(/\..*/, "")
      var url = lively4url + "/" + ea
      var cached = await self.lively4offlineFirstCache.match(url)
      if (cached && cached.headers.get("modified") == modified) {
        // do nothing
        // console.log("PRECACHE IGNORE " + ea)
      } else {
        console.log("[boot] preloadFileCaches: " + ea)
        var  mimeType = " text/plain"
        if (url.match(/\.js$/)) mimeType = "application/javascript"
        if (url.match(/\.css$/)) mimeType = "text/css"
        var content = await file.async("string")
        self.lively4offlineFirstCache.put(url, new Response(content, {
          headers: {
            "content-type": mimeType,
            modified: modified
          }
        }))
      }
      if (ea.match(/.js$/) && !ea.match(/\.transpiled\//)) {
          var transpiledPath = ".transpiled/" + ea.replace(/\//g,"_")
          var transpiledFile = archive.file(transpiledPath)
          var mapFile = archive.file(transpiledPath + ".map.json");
          
          if (transpiledFile) { 
            console.log("[boot] preloadFileCache initialize transpiled javascript: " + ea)
            try {
              var transpiledCode = await transpiledFile.async("string")
              if (mapFile) {
                var map = JSON.parse(await mapFile.async("string"))
              }
              self.lively4transpilationCache.cache.set(url, {
                  input: content, 
                  output: transpiledCode,
                  map: map,
                  modified: modified
                })
            } catch(e) {
              console.error("[boot] error in loading transpiled code: " + ea, e)
            }
          }
        }
    }
  } 
  console.log("[boot] preloadFileCache updated caches in  " + Math.round(performance.now() - start) + "ms")
//   var fileCacheURL = lively4url + "/bootfilelist.json"
//   try {
//     var filelist = await fetch(fileCacheURL).then(r => r.json())  
//   } catch(e) {
//     console.warn("could not load bootfilelist, continue anyway...")
//     return
//   }
  
//   urllist = filelist.map(ea => lively4url + "/" + ea)

//   var uncachedFiles = urllist.filter(ea => !lively4cacheFiles.get(ea))
  
//   var bootingMessageUI = document.querySelector("#lively-booting-message")
//   var count = 0
//   return Promise.all(uncachedFiles.map((ea, index) => {
//     var url = ea
//     return fetch(url).then(r => {
//       if (bootingMessageUI ) {
//         bootingMessageUI.textContent = "preload " + (count++) +"/" + uncachedFiles.length + "files" 
//       }
      
//     }) // ok, just fetch them, some will hit the cache, some will go through
//   })) 
}


window.lively4invalidateFileCaches = invalidateFileCaches


if (window.lively && window.lively4url) {
  console.log("CANCEL BOOT Lively4, because it is already loaded")
} else {
  (function() {
    
    // for finding the baseURL...
    var script = document.currentScript;
    var scriptURL = script.src;
    window.lively4url = scriptURL.replace("/src/client/boot.js","");
    
    // early feedback due to long loading time
    let livelyBooting = document.createElement('div');
    Object.assign(livelyBooting.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',

      zIndex: '10000',

      backgroundColor: 'white',
      border: 'black 1px solid',
      padding: '5px',
      boxShadow: '0px 0px 3px 0px rgba(40, 40, 40,0.66)'
    });
    livelyBooting.innerHTML = `<img alt="Lively 4" style="display:block; margin:auto;" src="${lively4url}/media/lively4_logo_smooth_100.png" />
<span style="font-size: large;font-family:arial">Booting:</span>
<div style="font-family:arial" id="lively-booting-message"></div>`;
    document.body.appendChild(livelyBooting);
    
    
    self.lively4bootGroupedMessages = []
    var lastMessage
    
    var estimatedSteps = 8
    var stepCounter = 1
    
    function groupedMessage( message) {
      var part = stepCounter++
      var numberOfSteps = estimatedSteps
      lastMessage =  {part, message, begin: performance.now()}
      
      console.group(`${part}/${numberOfSteps}: ${message}.`);

      let messageDiv = document.body.querySelector('#lively-booting-message');
      if(messageDiv) {
        messageDiv.innerHTML = `<span>${part}</span>/<span>${numberOfSteps}</span>: <span>${message}.</span>`;
      }
    }

    function groupedMessageEnd() {
      console.groupEnd();
      if (lastMessage) {
        lastMessage.end = performance.now()
        lively4bootGroupedMessages.push(lastMessage)
      }
    }

    console.group("BOOT");

    // some performance logging
    window.lively4performance = {start: performance.now()}
    try {
      Object.defineProperty(window, 'lively4stamp', {
        get: function() {
          if (!window.lively4performance) return;
          var newLast = performance.now()
          var t = (newLast - (lively4performance.last || lively4performance.start)) / 1000
          lively4performance.last = newLast
          return (t.toFixed(3) + "s ")
        }
      })
    } catch(e) {
      console.error(e)
    }

    var loadContainer = script.getAttribute("data-container"); // some simple configuration

    console.log("lively4url: " + lively4url);

   

    Promise.resolve().then(async () => {

      
      
      groupedMessage('Setup SystemJS');
      await loadJavaScriptThroughDOM("systemjs", lively4url + "/src/external/systemjs/system.src.js");
      await loadJavaScriptThroughDOM("systemjs-config", lively4url + "/src/systemjs-config.js");
      groupedMessageEnd();

      try {
        var livelyloaded = new Promise(async livelyloadedResolve => {
          groupedMessage('Invalidate Caches (in boot.js)')
            await invalidateFileCaches()
          groupedMessageEnd();

          groupedMessage('Preload Files');
          await preloadFileCaches()
          // we could wait, or not... if we load transpiled things... waiting is better
          groupedMessageEnd();

          
          groupedMessage('Initialize SystemJS');
            await System.import(lively4url + "/src/client/preload.js");
          groupedMessageEnd();
          
          groupedMessage('Wait on service worker (in load.js)');
            await (await System.import(lively4url + "/src/client/load-swx.js")).whenLoaded; // wait on service worker
          groupedMessageEnd();

          
          groupedMessage('Load Base System (lively.js)');
            await System.import("src/client/lively.js")

            // from load.js
            // lively.components.loadUnresolved(document.body, true, "load.js", true)

            // Customize.... #TODO where should it go?
            if (!window.__karma__ && navigator.userAgent.toLowerCase().indexOf('electron/') == -1) {
              window.onbeforeunload = function() {
                return 'Do you really want to leave this page?'; // gets overriden by Chrome native
              };
              window.onunload = function() {
                lively.onUnload && lively.onUnload()
              };
            }          
          groupedMessageEnd();
          
          groupedMessage('Load Standard Library');
            await System.import("lang");
            await System.import("lang-ext");
          groupedMessageEnd();

          groupedMessage('Initialize Document (in lively.js)' );
            await lively.initializeDocument(document, window.lively4chrome, loadContainer);
          groupedMessageEnd();

          groupedMessage('Look for uninitialized instances of Web Compoments');
            await lively.components.loadUnresolved(document.body, true, "boot.js", true)
          groupedMessageEnd();


          console.log("Finally loaded!");
          if (self.lively4bootGroupedMessages) {
            var str =  self.lively4bootGroupedMessages.map(ea => {
              return ea.part + " "  + Math.round(ea.end - ea.begin) + "ms "+ ea.message
            }).join("\n")
            console.log("BOOT", str)
          }
          
          if (window.lively4bootlogData) {
            System.import("src/client/bootlog.js").then(m => {
              m.default.current().addLogs(self.lively4bootlogData)
            }).then(() => console.log("saved bootlog"))            
          }

          document.dispatchEvent(new Event("livelyloaded"));

          livelyloadedResolve(true);
        })

        await livelyloaded
      } catch(err) {
        console.error("Lively Loading failed");
        console.error(err);
        alert("load Lively4 failed:" + err);
      } finally {
        console.groupEnd(); // BOOT
        livelyBooting.remove();
      }
    });
  })();
}
