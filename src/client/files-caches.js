import Files from "./files.js"

self.lively4fetchLog = self.lively4fetchLog || []

import {uniq} from "utils"

export async function updateCachedFilesList() {
  var list = self.lively4fetchLog.filter(ea => ea.method == "GET")
              .filter(ea => ea.url.match(lively4url))
              .map(ea => ea.url.replace(lively4url + "/",""))
              ::uniq().sort()
 
  await fetch(lively4url + "/.lively4bootfilelist", {
    method: "PUT",
    body: list.join("\n")
    //JSON.stringify(list).replace(/",/g,'",\n') // just a bit pretty print
  })
  return list
}

// updateCachedFilesList()


if (!navigator.serviceWorker) {
  console.warn("[files]... could not register message handler with no-existing service worker")
} else {
  lively.removeEventListener("files", navigator.serviceWorker)
  lively.addEventListener("files", navigator.serviceWorker, "message", async (evt) => {
    try {
      if(evt.data.name == 'swx:fech:request') {
        var map = Files.cachedFileMap()
        console.log("[files] fetch request: " + evt.data.method + " "+ evt.data.url)
        self.lively4fetchLog.push({
          time: performance.now(),
          method: evt.data.method,
          url: evt.data.url
        }) 
      }

    } catch(err) {
      console.error("[files] error during swx message handling...", err)
    }
  });
}
