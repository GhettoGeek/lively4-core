
var path = self.location.pathname.split("/")
// any idea of how to get rid of the last three elements?
path.pop() // livelyworker.js
path.pop() // /worker/
path.pop() //  src
self.lively4url = self.location.origin + path.join("/");

importScripts("./livelyworker.js")

onmessage = function(evt) {
  if (evt.data.message == "load")  {
    console.log("meta worker load "  + evt.data.url)
    System.import(evt.data.url).then((m) => {
      postMessage({message: "loaded"})
      self.onmessage = m.onmessage
    }).catch((err) => {
      console.log("meta worker error ", err)
      postMessage({message: "error", value: err})
    })
  }
}


