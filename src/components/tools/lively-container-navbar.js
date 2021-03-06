import Morph from 'src/components/widgets/lively-morph.js';
import ContextMenu from 'src/client/contextmenu.js';
import { applyDragCSSClass, DropElementHandler } from 'src/client/draganddrop.js';
import { fileName, copyTextToClipboard } from 'utils';
import components from 'src/client/morphic/component-loader.js';
import Preferences from 'src/client/preferences.js';
import Mimetypes from 'src/client/mimetypes.js';
import JSZip from 'src/external/jszip.js';
import moment from "src/external/moment.js"; 
import FileCache from "src/client/fileindex.js"
import Strings from "src/client/strings.js"


const FILTER_KEY_BLACKLIST = [
  'Control', 'Shift', 'Capslock', 'Alt',
  ' ', 'Enter',
  'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Tab'
];

export default class LivelyContainerNavbar extends Morph {
  async initialize() {
    lively.html.registerKeys(this);
    lively.html.registerKeys(this.get("#navbar"));
    lively.html.registerKeys(this.get("#details"));
    this.addEventListener("drop", this.onDrop);
    this.addEventListener("dragover", this.onDragOver);
    // this.addEventListener("dragenter", this.onDragEnter)
    this::applyDragCSSClass();
    this.lastSelection = [];
    this.addEventListener('contextmenu', (evt) => {
        if (!evt.shiftKey) {
          this.onContextMenu(evt, this.getRoot())
          evt.stopPropagation();
          evt.preventDefault();
          return true;
        }
    }, false);
  }
  
  clear(parentElement=this.get("#navbar")) {
    parentElement.innerHTML = ""
    this.updateFilter("")
  }
  
  async dragFilesAsZip(urls, evt) {
    // working around issue https://bugs.chromium.org/p/chromium/issues/detail?id=438479
    // to achieve https://html.spec.whatwg.org/multipage/dnd.html#dom-datatransferitemlist-add
    let url = lively.files.tempfile() + ".zip", 
    name = `${lively.files.name(urls[0])} and more.zip`,
    mimetype = "application/zip";
    evt.dataTransfer.setData("DownloadURL", `${mimetype}:${name}:${url}`);

    // and now... we download, zip, and upload the files during the user drags them... 
    // #Hack and will definitely not work well all the time!
    // #Idea, #Solution, we could make it stable if the lively4-serv will wait on the first "GET" request
    // if the upload is not finished yet, but if it knows about a new tempFile
    
    
    // Oh, my god! Now we are getting crazy!
    // first fownload the files, then zip them, then upload then again, so that they can be dropped...?
    // Yeah! :-)
    var zip = new JSZip();
    for(var ea of urls) {
      zip.file(lively.files.name(ea), await lively.files.loadFile(ea));
    }
    lively.files.saveFile(url, await zip.generateAsync({type:"blob"})) 
  }

  resetCursor() {
    this.cursorItem = null
    this.cursorDetailsItem = null
    this.navigateColumn = "files"
  }
  
  onItemDragStart(link, evt) {
    this.resetCursor()
    
    let urls = this.getSelection();
    if (urls.length > 1) {
      this.dragFilesAsZip(urls, evt)
    } else {
      let url = link.href,
        name = lively.files.name(url)
      var mimetype = Mimetypes.mimetype(lively.files.extension(name)) || "text/plain";
      evt.dataTransfer.setData("DownloadURL", `${mimetype}:${name}:${url}`);  
    }
    evt.dataTransfer.setData("text/plain", urls.join("\n"));
  }
  
  onDragOver(evt) {   
    if (evt.shiftKey) {
      evt.dataTransfer.dropEffect = "move";
      this.transferMode = "move"
    } else {
      evt.dataTransfer.dropEffect = "copy";
      this.transferMode = "copy"
    }
    evt.preventDefault()    
  }

  async onDrop(evt) {
    evt.preventDefault();
    evt.stopPropagation();
        
    const files = evt.dataTransfer.files;
    let dir = lively.files.directory(this.url);
    if(files.length > 0 &&
      await lively.confirm(`Copy ${files.length} file(s) into directory ${dir}?`)
    ) {
      Array.from(files).forEach(async (file) => {
        var newURL = dir + "/" + file.name;
        var dataURL = await lively.files.readBlobAsDataURL(file)  
        var blob = await fetch(dataURL).then(r => r.blob())
        await lively.files.saveFile(newURL, blob)
        this.show(newURL, ""); // #TODO blob -> text
      });
      return;
    }
    
    if (DropElementHandler.handle(evt, this, 
        (element, evt) => {lively.notify("handle " + element)})
    ) {
      return;
    }
       
    var data = evt.dataTransfer.getData("text");   
    var htmlData = evt.dataTransfer.getData("text/html");    
    if (data.match("^https?://") || data.match(/^data\:image\/png;/)) {
      this.copyFromURL(data);        
    } else if (htmlData) {
      data = evt.dataTransfer.getData();
      this.dropHTMLAsURL(htmlData)
    } else {
      console.log('ignore data ' + data);
    }
  }
  /* 
   *  Upload the dragged contents into a file.. and make up a name. 
   *  #Idea, instead of using a timestamp should be able to store a name in the data?
   */
  async dropHTMLAsURL(data) {
    var targetDir = lively.files.directory(this.url)
    var name = "dropped_" + moment(new Date()).format("YYMMDD_hhmmss")
    var newurl = targetDir + "/" + name + ".html"
    await fetch(newurl, {
      method: "PUT",
      body: data
    })
    this.update()
    this.updateOtherNavbars(this.getRoot(newurl))
    console.log("dropped " + newurl)
  }
  
  async copyFromURL(data) {
    var urls = data.split("\n")
    var targetDir = lively.files.directory(this.url)
    if (await lively.confirm(`${this.transferMode} ${urls.length} files to ${targetDir}?`)) {
      for(var fromurl of urls) {
        var filename = fromurl::fileName();
        var isDataURI;
        if (fromurl.match(/^data\:image\/png;/)) {
          isDataURI = true
          if (fromurl.match(/^data\:image\/png;name=/)) {
            filename = fromurl.replace(/.*?name=/,"").replace(/;.*/,"")    
          } else {
            filename = "dropped_" + Date.now() + ".png";
          }
        } else {
          isDataURI = false
        }

        var newurl = this.url.replace(/[^/]*$/, filename)
        var content = await fetch(fromurl).then(r => r.blob());
        await fetch(newurl, {
          method: "PUT",
          body: content
        })
        if (this.transferMode == "move") {
          await fetch(fromurl, {
            method: "DELETE"
          });
          // put again... to be not delete it by accident
          await fetch(newurl, {
            method: "PUT",
            body: content
          })
          this.updateOtherNavbars(this.getRoot(fromurl))
          this.updateOtherNavbars(this.getRoot(newurl))

          lively.notify(`${this.transferMode}d to ` + newurl + ": " + content.size)  
        }
        this.show(newurl, content)
      }
    }  
  }
  
  updateOtherNavbars(url) {  
    lively.queryAll(document.body, "lively-container-navbar").forEach( ea => {
      if (ea.getRoot() == url) {
        ea.update()
      }
    })
  }
  
  getRoot(url) {
    url = url || this.url;
    return url.toString().replace(/\/[^\/]+$/,"/") 
    /// return url.toString().replace(/\.l4d\/(index\.md)?$/,"").replace(/\/[^\/]+$/,"/") // .l4d directories are treated as files
  }
  
  getFilename(url) {
    url = url || this.url;
    return url.replace(/.*\//,"")
    // return url.replace(/\.l4d\/(index\.md)?$/,".l4d").replace(/.*\//,"")
  }
  
  async update() {
    
    var urls = this.targetItem ? _.uniq(lively.allParents(this.targetItem)
      .reverse()
      .map(ea => ea.url)
      .filter(ea => ea)) : []
    var url = this.url
    var content = this.sourceContent
    
    for(let ea of urls) {
      console.log("show " + ea)
      await this.show(ea, "", urls[0])  
      
      await lively.sleep(50)
    }
    // await lively.sleep(1000)

    await this.show(url, content, urls[0])  

  }
  
  getSelectedItems() {
    return this.shadowRoot.querySelectorAll(".selected")
  }
  
  getSelection() {
    return _.map(this.shadowRoot.querySelectorAll(".selected a"), ea => ea.href)
  }
  
  selectItem(item) {
    this.get("#navbar").querySelectorAll(".selected").forEach(ea => ea.classList.remove("selected"))
    item.classList.add("selected");      
  }
  
  getRootElement() {
    return this.get("#navbar")
  }
  
  findItem(url) {
    return _.find(this.getRootElement().querySelectorAll("li"), ea => {
      if (ea.textContent == "../") return false
      var link = ea.querySelector("a")
      return link && (link.href == url )
    });
  }

  async show(targetURL, sourceContent, contextURL, force=false) {
    console.log("[navbar] show " + targetURL + (sourceContent ? " source content: " + sourceContent.length : ""))
    var lastURL = this.url
    this.url = ("" + targetURL).replace(/[?#].*/,""); // strip options 
    var lastContent = this.sourceContent
    this.sourceContent = sourceContent
    
    this.contextURL = contextURL
    var lastDir = this.currentDir
    this.currentDir = this.getRoot(targetURL)

    let urlWithoutIndex = this.url.replace(/(README.md)|(index\.((html)|(md)))$/,"")
    if (this.url.match(/microsoft:\/\//)) {
      urlWithoutIndex = urlWithoutIndex.replace(/\/contents/,"")
    }
    
    this.targetItem = this.findItem(this.url) || this.findItem(urlWithoutIndex)
    var parentURL = this.url.replace(/[^/]*$/,"")   
    this.targetParentItem = this.findItem(parentURL)

    if (this.targetItem || this.targetParentItem ) {
        
      if (!this.targetItem) {
        // newfile or deleted file?
        // lively.notify("NEW ?RESET DIR")
        this.targetItem = this.targetParentItem
      }
      
      this.selectItem(this.targetItem)
      if (lastDir !== this.currentDir) {
        this.showSublist()
      } else if (lastURL !== this.url) {
        this.showSublist()
      } else if (lastContent != this.sourceContent) {
        this.showSublistContent(true)
      }        
      
      return         
    } else {
      this.resetCursor()
      // lively.notify("RESET DIR")
      await this.showDirectory(targetURL, this.get("#navbar"))
      await this.showSublist()    
      this.scrollToItem(this.targetItem)
    }  
  }
  
  
  scrollToItem(element) {
    if (element) {
      var list = this.get("#navbar")
      var relativeY = lively.getGlobalPosition(element).y - lively.getGlobalPosition(list).y
      this.get("#navbar").scrollTo(0, relativeY)
    }
  }
  
  
  async fetchStats(targetURL) {
    
    var root = this.getRoot(targetURL)
    
    try {
      var stats = await fetch(root, {
        method: "OPTIONS",
      }).then(r => r.status == 200 ? r.json() : {})
    } catch(e) {
      // no options....
    }
    
    
    if (!stats || !stats.type) {
      stats = {};// fake it
      stats.contents = [{type: "file", name: "index.html"}];
      
      var html = await fetch(root.replace(/\/?$/,"/")).then(r => r.text())
      var div = document.createElement("div");
      div.innerHTML = html;
      var i=0;
      Array.from(div.querySelectorAll("a"))
        .filter( ea => ea.getAttribute("href") && !ea.getAttribute("href").match(/^javascript:/))
        .forEach( ea => {
        stats.contents.push({
          type: 'link', 
          name: '' + ea.getAttribute("href").replace(/\/(index.html)?$/,"").replace(/.*\//,""), // ea.textContent,
          href: "" + ea.getAttribute("href") 
        });
      });
    }
    return stats
  }
  
  fileType(file) {
    // l4d bundle should sort like files
    if (file.name.match(/\.((l4d)|(md))$/)) return "file"
    return file.type
  }
  
  filesFromStats(stats) {
    var files = stats.contents
      .sort((a, b) => {        
        if (this.fileType(a) > this.fileType(b)) {
          return 1;
        }
        if (this.fileType(a) < this.fileType(b)) {
          return -1;
        }
        // #Hack, date based filenames are sorted so lastest are first
        if (a.name.match(/\d\d\d\d-\d\d-\d\d/) && b.name.match(/\d\d\d\d-\d\d-\d\d/)) {
          return (a.name >= b.name) ? -1 : 1;          
        }
        
        return ((a.title || a.name) >= (b.title || b.name)) ? 1 : -1;
      })
      .filter(ea => ! ea.name.match(/^\./));
    files.unshift({name: "..", type: "directory", url: stats.parent});
    return files
  }
  

  async showDirectory(targetURL, parentElement) {
    
    var filename = this.getFilename();
    
    var stats = await this.fetchStats(targetURL)
    this.clear(parentElement);
     
    
    var names = {};
    stats.contents.forEach(ea => names[ea.name] = ea);
    
    var files = this.filesFromStats(stats).filter(ea =>
      !(ea.name == ".." && parentElement !== this.getRootElement()))
    
    parentElement.url = targetURL
   
    this.lastTitle = ""
    files.forEach((ea) => {

      var element = this.createItem(ea)
      if (ea.name == filename) {
        this.targetItem = element;
      }
      if (this.targetItem) this.targetItem.classList.add("selected");

      
      parentElement.appendChild(element);
    });
    delete this.lastTitle
    
    // this.clearSublists()
  }
  
  createItem(ea) {
    var element = document.createElement("li");
    var link = document.createElement("a");

    var name = ea.name;
    var icon;
    if (ea.name.match(/\.md$/)) {
      icon = '<i class="fa fa-file-text-o"></i>';
      // some directories in lively are considered bundles and should behave like documents
      if (ea.type == "directory") {
        element.classList.add("directory")
      } else {
        element.classList.add("file")
      }
    } else if (ea.type == "directory") {
      name += "/";
      icon = '<i class="fa fa-folder"></i>';
      element.classList.add("directory")
    } else if (ea.type == "link") {
      icon = '<i class="fa fa-arrow-circle-o-right"></i>';
      element.classList.add("link")
    } else if (/\.html$/i.test(name)) {
      icon = '<i class="fa fa-html5"></i>'
      element.classList.add("test")
    } else if (/(\.|-)(spec|test)\.js$/i.test(name)) {
      icon = '<i class="fa fa-check-square-o"></i>'
      element.classList.add("test")
    } else if (/\.js$/i.test(name)) {
      icon = '<i class="fa fa-file-code-o"></i>';
      element.classList.add("file");
    } else if (/\.css$/i.test(name)) {
      icon = '<i class="fa fa-css3"></i>';
      element.classList.add("file");
    } else if (/\.(png|jpg)$/i.test(name)) {
      icon = '<i class="fa fa-file-image-o"></i>';
      element.classList.add("file");
    } else if (/\.(pdf)$/i.test(name)) {
      icon = '<i class="fa fa-file-pdf-o"></i>';
      element.classList.add("file");
    } else {
      icon = '<i class="fa fa-file-o"></i>';
      element.classList.add("file");
    }
    var title = ea.title || name

    // name.replace(/\.(lively)?md/,"").replace(/\.(x)?html/,"")

    var prefix = this.lastTitle ? Strings.longestCommonPrefix([title, this.lastTitle]) : ""
    prefix = prefix.replace(/-([a-zA-Z0-9])*$/,"-")
    if (prefix.length < 4) {
      prefix = ""
    }      
    link.innerHTML =  icon + title.replace(new RegExp("^" + prefix), "<span class='prefix'>" +prefix +"</span>");
    this.lastTitle = title

    var href = ea.href || ea.name;
    if (ea.type == "directory" && !href.endsWith("/")) {
      href += "/"
    }
    var otherUrl = href.match(/^[a-z]+:\/\//) ? href : this.currentDir + "" + href;
    link.href = ea.url || otherUrl;
    element.url = link.href

   
    
    if (this.lastSelection && this.lastSelection.includes(otherUrl)) {
      element.classList.add("selected")
    }

    link.onclick = (evt) => { 
      this.onItemClick(link, evt); 
      return false
    };
    link.ondblclick = (evt) => { 
      this.onItemDblClick(link, evt); 
      return false
    };

    link.addEventListener('dragstart', evt => this.onItemDragStart(link, evt))
    link.addEventListener('contextmenu', (evt) => {
        if (!evt.shiftKey) {
          this.onContextMenu(evt, otherUrl)
          evt.stopPropagation();
          evt.preventDefault();
          return true;
        }
    }, false);
    element.appendChild(link);
    return element
  }
  
  
  getLink(item) {
    return item.querySelector(":scope > a")
  }
  
  isDirectory(item) {
    if (!item) return false
    var link = this.getLink(item)
    return link && link.href.match(/\/$/) && true
  }
  
  isSelected(item)  {
    var selectedChild = item.querySelector(".selected")
    
    return item.classList.contains("selected") || selectedChild
  }
  
  async onItemClick(link, evt) {
    this.focus()
    if (evt.shiftKey && evt.code != "Enter") {
      link.parentElement.classList.toggle("selected")
      this.lastSelection = this.getSelection()     
    } else {
      this.lastSelection = []
      // collapse previousely expanded tree
      var item = link.parentElement
      if (this.isSelected(item) ) {
        this.currentDir = null
        item.classList.remove("selected")
        var sublist = item.querySelector("ul")
        if (sublist) sublist.remove()
      } else {
        if (evt.shiftKey) {
          var container = lively.query(this, "lively-container")
          if (container) await container.editFile();
        } 
        await this.followPath(link.href);
      
      }
    }
    this.updateFilter("")
    this.focusFiles()
  }
  
  async onItemDblClick(link, evt) {
    this.clear()
    await this.followPath(link.href);
    this.focusFiles()
  }
  
  async onDetailsItemClick(item, evt) {
    this.cursorDetailsItem = item
    this.navigateColumn = "details"
    var sublist = this.get("#details").querySelector("ul")
    this.selectSublistItem(item, sublist)
    await this.navigateToName(item.name);
    this.get("#details").focus()
  }

  async editWithSyvis (url) {
    const editor = await components.createComponent('syvis-editor');
    await editor.loadUrl(url);
    await components.openInWindow(editor);
  }

  onContextMenu(evt, otherUrl=this.getRoot()) {
    var isDir = otherUrl.match(/\/$/,"")
    var file = otherUrl.replace(/\/$/,"").replace(/.*\//,"");
    
    const menuElements = []
    
    var selection =  this.getSelection()
    
    if (selection.length > 0) {
      menuElements.push(...[
        ['<b>' + (selection.map(ea => ea.replace(/.*\//, "")).join(", ") + "</b>"), 
         () => {}, "", '>'],
        [`delete `, () => this.deleteFile(otherUrl, selection)],
      ])
    } else {
      menuElements.push(...[
        ['<b>' + file + "</b>", 
         () => {}, "", '>'],
      ])
    }
    if (selection.length == 1) {
      menuElements.push(...[
        [`rename`, () => this.renameFile(otherUrl)],
        [`become bundle`, () => this.convertFileToBundle(otherUrl)],
        
        ["edit ", () => lively.openBrowser(otherUrl, true)],
        ["browse", () => lively.openBrowser(otherUrl)],
        ["save as png", () => lively.html.saveAsPNG(otherUrl)],
        ["copy path to clipboard", () => copyTextToClipboard(otherUrl), "", '<i class="fa fa-clipboard" aria-hidden="true"></i>'],
        ["copy file name to clipboard", () => copyTextToClipboard(otherUrl::fileName()), "", '<i class="fa fa-clipboard" aria-hidden="true"></i>'],
      ])
    }
    if (isDir) {
      menuElements.push(...[
        [`add search root`, () => this.addSearchRoot(otherUrl)],
      ])
    }
    
    menuElements.push(...[
      ["new", [
        [`text file`, () => this.newfile(otherUrl)],
        ["drawio figure", () => this.newfile(otherUrl, "drawio")],
      ], "", ''],  
    ])
    const menu = new ContextMenu(this, menuElements)
    menu.openIn(document.body, evt, this)
  }
  
  /*
   * add url to local file index rember to search there  
   */
  addSearchRoot(url) {
    var roots = lively.preferences.get("ExtraSearchRoots")
    roots = _.uniq(roots.concat([url]))
    FileCache.current().addDirectory(url)     
    lively.preferences.set("ExtraSearchRoots", roots)
    lively.notify("Current Search Roots:", roots)
  }
  
  deleteFile(url, selectedURLs) {
    lively.notify("please implement deleteFile()")
  }

  renameFile(url) {
    lively.notify("please implement renameFile()")
  }

  newfile(path, type) {
    lively.notify("please implement newfile()")
  }
  
  navigateToName(url) {
    lively.notify(`please implement navigateToName(${url})`)
  }

  async followPath(url, lastPath) {
    var resp = await fetch(url)
    var content = ""
    var contentType = resp.headers.get("content-type")
    if (contentType.match(/text\//)) {
      content = await resp.text()
    } else {
      // lively.notify("content type not suppored: " + contentType)
    }
    this.show(new URL(url), content, this.contextURL)
  }

  async convertFileToBundle(url) {
    // var url = "https://lively-kernel.org/lively4/lively4-jens/doc/journal/2018-08-17.md"
    if (!await lively.files.isFile(url)) {
      lively.notify("Converion failed: " + url + " is no file!")
      return
    }
    var contents = await fetch(url).then(r => r.text());
    await fetch(url, {method: 'DELETE'})
    
    await fetch(url + "/", {method: 'MKCOL'});
    var newURL = url + "/" + "index.md"
    await fetch(newURL, {method: 'PUT', body: contents});
    this.followPath(newURL);
  }

  showSublistHTML(subList) {
    if (!this.sourceContent) return;
    var template =  lively.html.parseHTML(this.sourceContent).find(ea => ea.localName == "template");
      if (!template) {
        console.log("showNavbar: no template found");
        return;
      }
      // fill navbar with list of script
      Array.from(template.content.querySelectorAll("script")).forEach(ea => {
        var element = document.createElement("li");
        element.innerHTML = ea.getAttribute('data-name');
        element.classList.add("subitem");
        
        element.name = `data-name="${ea.getAttribute('data-name')}"`
        element.onclick = (evt) => {
          this.onDetailsItemClick(element, evt)
        }
        subList.appendChild(element) ;
      });
  }
  
  showSublistJS(subList) {
    if (!this.sourceContent || !this.sourceContent.split) {
      // undefined or Blob
      return;
    }
    let instMethod = "(^|\\s+)([a-zA-Z0-9$_]+)\\s*\\(\\s*[a-zA-Z0-9$_ ,=]*\\s*\\)\\s*{",
        klass = "(?:^|\\s+)class\\s+([a-zA-Z0-9$_]+)",
        func = "(?:^|\\s+)function\\s+([a-zA-Z0-9$_=]+)\\s*\\(",
        oldProtoFunc = "[a-zA-Z0-9$_]+\.prototype\.([a-zA-Z0-9$_]+)\\s*=";
    let defRegEx = new RegExp(`(?:(?:${instMethod})|(?:${klass})|(?:${func})|(?:${oldProtoFunc}))`);
    let m;
    let links = {};
    let i = 0;
    let lines = this.sourceContent.split("\n");

    lines.forEach((line) => {
      m = defRegEx.exec(line);
      if (m) {
        var theMatch = m[2] ||
                      (m[3] && "class " + m[3]) ||
                      (m[4] && "ƒ " + m[4]) ||
                       m[5];
        if(!theMatch.match(/^(if|switch|for|catch|function)$/)) {
          let name = (line.replace(/[A-Za-z].*/g,"")).replace(/\s/g, "&nbsp;") + theMatch,
              navigateToName = m[0],
              element = document.createElement("li");
          element.innerHTML = name;
          element.classList.add("link");
          element.classList.add("subitem");
          element.name = navigateToName
          element.onclick = (evt) => {
            this.onDetailsItemClick(element, evt)
          }
          subList.appendChild(element) ;
        }
      }
    });
  }
  
  selectSublistItem(element, subList) {
    for(var ea of subList.querySelectorAll(".selected")) {
      ea.classList.remove("selected")
    }
    element.classList.add("selected")
  }
  
  clearNameMD(name) {
    return name
      .replace(/<.*?>/g, "")
      .replace(/\{.*/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/[\[\]]/g, "")
      .replace(/\n/g, "")
      .replace(/([ ,])#/g, "$1")
  }
  
  showSublistMD(subList) {
    // console.log("sublist md " + this.sourceContent.length)
    if (!this.sourceContent) return;
    let defRegEx = /(?:^|\n)((#+) ?(.*))/g;
    let m;
    let links = {};
    let i=0;
    while (m = defRegEx.exec(this.sourceContent)) {
      if (i++ > 1000) throw new Error("Error while showingNavbar " + this.url);

      links[m[3]] = {name: m[0], level: m[2].length};
    }
    _.keys(links).forEach( name => {
      var item = links[name];
      var element = document.createElement("li");
      element.textContent = this.clearNameMD(name)
      element.classList.add("link");
      element.classList.add("subitem");
      element.classList.add("level" + item.level);
      element.name = this.clearNameMD(item.name)
      element.onclick = (evt) => {
          this.onDetailsItemClick(element, evt)
      }
      subList.appendChild(element);
    });
  }

  async showSublistOptions(subList, url) {
    url = url || this.url
    try {
      var options = await fetch(url, {method: "OPTIONS"})
        .then(r => r.status == 200 ? r.json() : {})
    } catch(e) {
      // no options...
      return 
    }
    if (!options.contents) return;
    for(let ea of options.contents) { // #Bug for(var ea) vs for(let)
      let element = <li 
          class="link subitem" title={ea.name}>{ea.name}</li>
      subList.appendChild(element);
      element.onclick = () => {
        this.selectSublistItem(element, subList)
        if (ea.href) {
          this.followPath(ea.href);
        } else {
          this.followPath(url + "/" + ea.name)
        }
      }
    }
  }
  
  clearSublists() {
    // console.log("clear sublists")
    var parents = this.targetItem ? lively.allParents(this.targetItem) : [];
    // remove all sublists... but my own tree
    Array.from(this.get("#navbar").querySelectorAll("ul"))
      .filter(ea => !parents.includes(ea) && !lively.allParents(ea).includes(this.targetItem))
      .forEach(ea => ea.remove())    

    Array.from(this.get("#navbar").querySelectorAll(".subitem"))
      .forEach(ea => ea.remove())    

  }
  
  async showSublist() {
    // console.log("show sublist " + this.url)
     
    if (!this.targetItem) return 
    if (this.targetItem.querySelector("ul")) return // has sublist
    
    var subList = document.createElement("ul");
    this.targetItem.appendChild(subList);
    if (this.url !== this.contextURL && this.targetItem.classList.contains("directory")) {
      var optionsWasHandles = true
      await this.showDirectory(this.url, subList)
    }
    this.showSublistContent(optionsWasHandles)
  } 
  
  
  async showSublistContent(optionsWasHandles) {
    // show console.log("show sublist content " + this.url) 
    if (!this.targetItem) return 
    
    var details = this.get("#details")
    var subList = this.targetItem.querySelector("ul")
    
    if (details) {
      details.innerHTML = ""
      subList = <ul></ul>
      details.appendChild(subList)
    }
    
    if (!subList) return // we are a sublist item?
    
    // keep expanded trees open... or not
    // this.clearSublists()
    
    if (this.url.match(/templates\/.*html$/)) {
      this.showSublistHTML(subList)
    } else if (this.url.match(/\.js$/)) {
      this.showSublistJS(subList)
    } else if (this.url.match(/\.md$/)) {
      // console.log("show sublist md" + this.url)

      this.showSublistMD(subList)
    } else {
      if (!optionsWasHandles) {
        this.showSublistOptions(subList)
      }
    }
  }


  onRightDown(evt) {
    evt.stopPropagation()
    evt.preventDefault()
    
    this.updateFilter("")
    if (!this.navigateColumn || this.navigateColumn == "files") {
      this.navigateColumn = "details"
      var details = this.get("#details")
      details.focus()
      this.setCursorItem(details.querySelector("li"))
    } else if (this.navigateColumn == "details") {
    
      var container = lively.query(this, "lively-container")
      if (container) container.focus()
    
      
    }   
  }
  
  onLeftDown(evt) {
    evt.stopPropagation()
    evt.preventDefault()
    this.updateFilter("")
    
    if (!this.navigateColumn || this.navigateColumn == "details") {
      this.navigateColumn = "files"
      this.get("#navbar").focus()    
    }    
  }

  async onUpDown(evt) {
    if (evt.altKey) {
      evt.stopPropagation()
      evt.preventDefault()
      var container = lively.query(this, "lively-container")
      if (container) {
        container.get("#container-path").focus()
      }
      return
    }
    this.navigateItem("up", evt)
  }

  onDownDown(evt) {
    this.navigateItem("down", evt)
  }
  
  
  async onEnterDown(evt) {
    evt.stopPropagation()
    evt.preventDefault()
    
    if (this.navigateColumn == "details") {
      if (this.cursorDetailsItem) {
        if (evt.shiftKey) {
          var container = lively.query(this, "lively-container")
          if (container) {
            await container.editFile()
          }
        } 
        this.onDetailsItemClick(this.cursorDetailsItem, evt)
        this.get("#details").focus()  
      }
    } else if (this.cursorItem ) {
      var nextLink = this.cursorItem.querySelector("a")
      this.onItemClick(nextLink, evt) 
    }
  }
  
  nextValidSibling(item) {
    if (!item) return;
    var element = item.nextElementSibling
    if (!element) return;
    if (!element.classList.contains("filtered-out")) {
      return element
    } else {
      return this.nextValidSibling(element)
    }
  }
  
  prevValidSibling(item) {
    
    if (!item) return;
    var element = item.previousElementSibling
    if (!element) return;
    if (!element.classList.contains("filtered-out")) {
      return element
    } else {
      return this.prevValidSibling(element)
    }
  }
  
  
  nextDownItem(item, doNotDecent) {
    var sublist = item.querySelector("ul")
    if (!doNotDecent && sublist) {
      var nextSubListItem = sublist.querySelector("li")
      if (nextSubListItem) return nextSubListItem
    } 
    
    var next = this.nextValidSibling(item)
    if (next) {
      return next
    } else if (item.parentElement && item.parentElement.parentElement &&
               item.parentElement.localName == "ul" &&
               item.parentElement.parentElement.localName == "li") {
      return this.nextDownItem(item.parentElement.parentElement, true)
    }
    
  }

  nextUpItem(item) {
    var prev = this.prevValidSibling(item)
    if (prev) {
      var sublist = prev.querySelector("ul")
      if(sublist) {
        var prevSubListItem = Array.from(sublist.querySelectorAll("li")).last
        if (prevSubListItem) return prevSubListItem 
      }
      return prev
    } else if (item.parentElement && item.parentElement.parentElement &&
        item.parentElement.localName == "ul" && 
        item.parentElement.parentElement.localName == "li") {
      
      return this.nextUpItem(item.parentElement.parentElement)
    }
  }

  navigateItem(direction, evt) {
    evt.stopPropagation()
    evt.preventDefault()    
    var startItem = this.getCursorItem()

    if (!startItem) return
    if (direction == "down") {
      var nextItem = this.nextDownItem(startItem)
    } else {
      nextItem = this.nextUpItem(startItem)
    }
    this.setCursorItem(nextItem)
  }
  
  getCursorItem() {
    if (this.cursorItem && !this.cursorItem.parentElement) {
      this.cursorItem = null
    }
    var startItem
    if (this.navigateColumn == "details") {
      startItem = this.cursorDetailsItem || this.get("#details").querySelector("li")
    } else {
      startItem = this.cursorItem || this.targetItem || this.get("#navbar").querySelector("li")
    }
    return startItem
  }
  
  setCursorItem(nextItem) {
    var startItem = this.getCursorItem()
    if (startItem) {
      startItem.classList.remove("cursor")
    }
    if (nextItem) {
        nextItem.classList.add("cursor")
        if (this.navigateColumn == "details") {
          this.cursorDetailsItem = nextItem  
        } else {
          this.cursorItem = nextItem  
        }
      }
  }
  
  focusDetails() {
    this.navigateColumn = "details"
    this.get("#details").focus()
  }

  focusFiles() {
    this.navigateColumn = "files"
    this.get("#navbar").focus()
  }
  
  /* Copied from lively-menu */
  // lazy filter property
  get filter() { return this._filter = this._filter || ''; }
  set filter(value) { return this._filter = value; }
  
  onKeyDown(evt) {
    if(FILTER_KEY_BLACKLIST.includes(evt.key)) { return; }

    // lively.notify("key: " + evt.key)
    
    if(['Backspace', 'Delete', 'Escape'].includes(evt.key)) {
      this.filter = '';
    } else {
      this.filter += evt.key;
    }
    
    this.updateFilter()
  }
  
  updateFilter(filter=this.filter) {
    this.filter = filter
    this.get('#filter-hint').innerHTML = this.filter;
    
    // lively.warn(evt.key, this.filter)
    
    this.items.forEach(item => item.classList.remove('filtered-out'));
    this.nonMatchingItems.forEach(item => item.classList.add('filtered-out'));
    
    if (this.filter.length > 0) {
      this.setCursorItem(this.matchingItems.first)
    }
  }

  get items() {
    if(this.navigateColumn == "details") {
      return Array.from(this.get("#details").querySelectorAll("li"));
    } else {
      return Array.from(this.get("#navbar").querySelectorAll("li"));
    }
    
  }
  
  matchFilter(item) {
    if (this.filter.length == 0) return true;
    if(!item ) { return false; }
    return item.textContent.toLowerCase().includes(this.filter.toLowerCase());
  }
  
  get matchingItems() {
    return this.items.filter(item => this.matchFilter(item));
  }
  
  get nonMatchingItems() {
    return this.items.filter(item => !this.matchFilter(item));
  }
  
  async livelyMigrate(other) {
    await this.show(other.url, other.sourceContentthis, other.contextURL, true)
  }

  livelyUpdate() {
    this.clear()
    this.show(this.url,this.sourceContent, this.contextURL, true)
  }
  
  hightlightElement(element) {
    var text = element.querySelector("a") || element
    text.style.color = getComputedStyle(text).color || "black"
    text.animate([
      { color: text.style.color }, 
      { color: 'green' }, 
      { color:  text.style.color }, 
    ], { 
      duration: 2000,
    });
  }
  
  getElementByURL(url) {
    return this.items.find(ea => ea.url == url && ea.textContent !== "../")
  }
  
  
  sortIntoAfter(sibling, element) {
    
    if (!sibling) return
    if (sibling.classList.contains("file") && element.textContent < sibling.textContent) {
      sibling.parentElement.insertBefore(element, sibling) 
      return true
    } else {
      if (sibling.nextElementSibling) {
        return this.sortIntoAfter(sibling.nextElementSibling, element)
      } 
    }
    
  }
  
  async onObserveURLChange(url, method) {
    try {
      if (url.startsWith(this.currentDir)) {
        var element = this.getElementByURL(url)
        if (element) {
          if (method == "PUT") {
            this.hightlightElement(element)
          } else if(method == "DELETE") {
            element.remove()
          }
        } else {
          if (method == "PUT") {
            // maybe we should create an item for the element?
            var parentURL = url.replace(/\/[^/]+$/,"/")
            console.log("parentrURL " + parentURL)
            var parentElement = this.getElementByURL(parentURL)
            if (!parentElement) parentElement = this.get("#row")
            if (parentElement) {
              var stats = await fetch(url, {method: "OPTIONS"}).then(r => r.json())
              stats.name = stats.name.replace(/.*\//,"")
              var element = this.createItem(stats)
              var parentElementList = parentElement.querySelector(":scope > ul") 

              if (parentElementList) {
                var firstSibling = parentElementList.querySelector(":scope > li")
                if (!this.sortIntoAfter(firstSibling, element)) {
                  parentElementList.appendChild(element) 
                }
                this.hightlightElement(element)            
              }
            } 
          }
        }
      }      
    } catch(e) {
      console.error(e)
    }
  }

  async livelyExample() {
    // var url = lively4url + "/README.md"
    // var url = "innerhtml://"
    var url = "https://lively-kernel.org/lively4/lively4-jens/doc/"
    var content = await fetch(url).then(r => r.text())
    await this.show(url, content)
  }
}


if (self.lively4fetchHandlers) {  
  // remove old instances of me
  self.lively4fetchHandlers = self.lively4fetchHandlers.filter(ea => !ea.isNavbarHandler);
  self.lively4fetchHandlers.unshift({
    isNavbarHandler: true,
    handle(request, options) {
      // do nothing
    },
    finsihed(request, options) {
      var url = (request.url || request).toString()
      var method = "GET"
      if (options && options.method) method = options.method;
      if (method == "PUT" || method == "DELETE") {
        try {
          for(var container of document.querySelectorAll("lively-container")) {
            var navbar = container.get("lively-container-navbar")
            if (navbar && navbar.onObserveURLChange) {

              navbar.onObserveURLChange(url, method)
            }
          }        
        } catch(e) {
          console.error(e)
        }
      }
    }
  })
  
}
