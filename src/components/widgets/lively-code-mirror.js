import { promisedEvent, through, uuid as generateUUID } from 'utils';
import boundEval from 'src/client/bound-eval.js';
import Morph from "src/components/widgets/lively-morph.js"
import diff from 'src/external/diff-match-patch.js';
import SyntaxChecker from 'src/client/syntax.js';
import { debounce } from "utils";
import Preferences from 'src/client/preferences.js';
import {pt} from 'src/client/graphics.js';
import 'src/client/stablefocus.js';
import Strings from 'src/client/strings.js';
import { letsScript } from 'src/client/vivide/vivide.js';
import LivelyCodeMirrorWidgetImport from 'src/components/widgets/lively-code-mirror-widget-import.js';
import * as spellCheck from "src/external/codemirror-spellcheck.js"
import {isSet} from 'utils'
import fake from "./lively-code-mirror-fake.js"
import CodeMirror from "src/external/code-mirror/lib/codemirror.js"
self.CodeMirror = CodeMirror // for modules
let loadPromise = undefined;
import { loc, range } from 'utils';

function posEq(a, b) {return a.line == b.line && a.ch == b.ch;}

export default class LivelyCodeMirror extends HTMLElement {

  fake(...args) {
    fake(this.editor, ...args)
  }
  
  get mode() {
    return this.getAttribute('mode');
  }
  set mode(val) {
    return this.setAttribute('mode', val);
  }

  static get codeMirrorPath() {
     return  lively4url + "/src/external/code-mirror/"
  }

  static async loadModule(path, force) {
    if (!self.CodeMirror) {
      console.warn("CodeMirror is missing, could not initialize " + path )
      return 
    }
    var code = await fetch(this.codeMirrorPath + path).then(r => r.text())
    try {
      eval(code)
    } catch(e) {
      console.error("Could not load CodeMirror module " + path, e)
    }
    // return lively.loadJavaScriptThroughDOM("codemirror_"+path.replace(/[^A-Za-z]/g,""),
    //   this.codeMirrorPath + path, force)
  }

  static async loadCSS(path) {
    return lively.loadCSSThroughDOM("codemirror_" + path.replace(/[^A-Za-z]/g,""),
       this.codeMirrorPath + path)
  }

  static async loadModules(force) {
    // console.log("loadModules", loadPromise);
    if (loadPromise && !force) return loadPromise
    loadPromise = (async () => {


      await this.loadModule("addon/fold/foldcode.js")

      await this.loadModule("mode/javascript/javascript.js")
      await this.loadModule("mode/xml/xml.js")
      await this.loadModule("mode/css/css.js")
      await this.loadModule("mode/diff/diff.js")

      await this.loadModule("mode/markdown/markdown.js")
      await this.loadModule("mode/htmlmixed/htmlmixed.js")
      await this.loadModule("addon/mode/overlay.js")
      await this.loadModule("mode/gfm/gfm.js")
      await this.loadModule("mode/stex/stex.js")
      await this.loadModule("mode/jsx/jsx.js")
      await this.loadModule("mode/python/python.js")
      await this.loadModule("mode/clike/clike.js")
      await this.loadModule("mode/shell/shell.js")
      
      await this.loadModule("addon/edit/matchbrackets.js")
      await this.loadModule("addon/edit/closetag.js")
      await this.loadModule("addon/edit/closebrackets.js")
      await this.loadModule("addon/edit/continuelist.js")
      await this.loadModule("addon/edit/matchtags.js")
      await this.loadModule("addon/edit/trailingspace.js")
      await this.loadModule("addon/hint/show-hint.js")
      await this.loadModule("addon/hint/javascript-hint.js")
      await this.loadModule("addon/search/searchcursor.js")
      await this.loadModule("addon/search/search.js")
      await this.loadModule("addon/search/jump-to-line.js")
      await this.loadModule("addon/search/matchesonscrollbar.js")
      await this.loadModule("addon/search/match-highlighter.js")
      await this.loadModule("addon/scroll/annotatescrollbar.js")
      await this.loadModule("addon/comment/comment.js")
      await this.loadModule("addon/dialog/dialog.js")
      await this.loadModule("addon/scroll/simplescrollbars.js")

      //await System.import("https://raw.githubusercontent.com/jshint/jshint/master/dist/jshint.js");
      //await lively.loadJavaScriptThroughDOM("jshintAjax", "https://ajax.aspnetcdn.com/ajax/jshint/r07/jshint.js");
      //await lively.loadJavaScriptThroughDOM("eslint", "http://eslint.org/js/app/eslint.js");
      await this.loadModule("addon/lint/lint.js");
      await this.loadModule("addon/lint/javascript-lint.js");
      await this.loadModule("../eslint.js");
      await this.loadModule("../eslint-lint.js", force);

      await this.loadModule("addon/merge/merge.js")
      await this.loadModule("addon/selection/mark-selection.js")
      await this.loadModule("keymap/sublime.js")
      await System.import(lively4url + '/src/components/widgets/lively-code-mirror-hint.js')

      this.loadCSS("addon/hint/show-hint.css")
      this.loadCSS("addon/lint/lint.css")
      lively.loadCSSThroughDOM("CodeMirrorCSS", lively4url + "/src/components/widgets/lively-code-mirror.css")
    })()
    return loadPromise
  }

  // #TODO #Refactor not needed anymore
  static async loadTernModules() {
    if (this.ternIsLoaded) return;

    await this.loadModule("addon/tern/tern.js")

    var terndir = lively4url + '/src/external/tern/'
    await lively.loadJavaScriptThroughDOM("tern_acorn", terndir + 'acorn.js')
    await lively.loadJavaScriptThroughDOM("tern_acorn_loose", terndir + 'acorn_loose.js')
    await lively.loadJavaScriptThroughDOM("tern_walk", terndir + 'walk.js')
    await lively.loadJavaScriptThroughDOM("tern_polyfill", terndir + 'polyfill.js')
    await lively.loadJavaScriptThroughDOM("tern_signal", terndir + 'signal.js')
    await lively.loadJavaScriptThroughDOM("tern_tern", terndir + 'tern.js')
    await lively.loadJavaScriptThroughDOM("tern_def", terndir + 'def.js')
    await lively.loadJavaScriptThroughDOM("tern_comment", terndir + 'comment.js')
    await lively.loadJavaScriptThroughDOM("tern_infer", terndir + 'infer.js')
    await lively.loadJavaScriptThroughDOM("tern_plugin_modules", terndir + 'modules.js')
    await lively.loadJavaScriptThroughDOM("tern_plugin_esmodules", terndir + 'es_modules.js')
    this.ternIsLoaded = true;
  }
  
  get ternWrapper() {
    return System.import('src/components/widgets/tern-wrapper.js')
      .then(m => {
        this.ternLoaded = true
        return m.TernCodeMirrorWrapper
      });
  }

  initialize() {
    this._attrObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if(mutation.type == "attributes") {
          // console.log("observation", mutation.attributeName,mutation.target.getAttribute(mutation.attributeName));
          this.attributeChangedCallback(
            mutation.attributeName,
            mutation.oldValue,
            mutation.target.getAttribute(mutation.attributeName)
          )
        }
      });
    });
    this._attrObserver.observe(this, { attributes: true });
  }

  applyAttribute(attr) {
    var value = this.getAttribute(attr)
    if (value !== undefined) {
      this.setAttribute(attr, value)
    }
  }

  async attachedCallback() {
    if (this.isLoading || this.editor ) return;
    this.isLoading = true
    this.root = this.shadowRoot // used in code mirror to find current element
    await LivelyCodeMirror.loadModules(); // lazy load modules...
    
    if (this.textContent) {
      var value = this.decodeHTML(this.textContent);
    } else {
      value = this.value || "";
    }
    this.editView(value)
    this.isLoading = false
    // console.log("[editor] #dispatch editor-loaded")
    var event = new CustomEvent("editor-loaded")
    // event.stopPropagation();
    this.dispatchEvent(event)
    this["editor-loaded"] = true // event can sometimes already be fired
  }

  async editorLoaded() {
    if(!this["editor-loaded"]) {
      return promisedEvent(this, "editor-loaded");
    }
  }

  editView(value) {
    if (!value) value = this.value || "";
    var container = this.shadowRoot.querySelector("#code-mirror-container")
    container.innerHTML = ""
    this.setEditor(CodeMirror(container, {
      value: value,
      lineNumbers: true,
      gutters: ["leftgutter", "CodeMirror-linenumbers", "rightgutter", "CodeMirror-lint-markers"],
      lint: true
    }));
  }

  setEditor(editor) {
    this.editor = editor
		this.setupEditor()
  }

  setupEditor() {
    var editor = this.editor;
    if (this.mode) {
      editor.setOption("mode", this.mode);
    }
    this.setupEditorOptions(editor)
    // edit addons
    // editor.setOption("showTrailingSpace", true)
    // editor.setOption("matchTags", true)

    editor.on("change", evt => this.dispatchEvent(new CustomEvent("change", {detail: evt})))
    editor.on("change", (() => this.checkSyntax()).debounce(500))

		// apply attributes
    _.map(this.attributes, ea => ea.name).forEach(ea => this.applyAttribute(ea));

    // if(Preferences.get('UseTernInCodeMirror')) {
    //   this.enableTern();
    // }
  }
  
  addKeys(keymap) {
    var keys = this.ensureExtraKeys()
    this.extraKeys = Object.assign(keys, keymap)
  }
  
  
  ensureExtraKeys() {
    if (!this.extraKeys) {
      var editor = this.editor
      this.extraKeys = {
        // #KeyboardShortcut Ctrl-H search and replace
        "Insert": (cm) => {
          // do nothing... ther INSERT mode is so often actived by accident 
        },
        "Ctrl-Insert": (cm) => {
          // do nothing... ther INSERT mode is so often actived by accident 
          cm.toggleOverwrite()
        },
        "Ctrl-H": (cm) => {
          setTimeout(() => {
              editor.execCommand("replace");
              this.shadowRoot.querySelector(".CodeMirror-search-field").focus();
          }, 10)
        },
        // #KeyboardShortcut Ctrl-Space auto complete
        "Ctrl-Space": cm => {
          this.fixHintsPosition()
          cm.execCommand("autocomplete")
        },
        // #KeyboardShortcut Ctrl-Alt-Space auto complete
        "Ctrl-Alt-Space": cm => {
          this.fixHintsPosition()
          cm.execCommand("autocomplete")
        },
        // #KeyboardShortcut Ctrl-P eval and print selelection or line
        "Ctrl-P": (cm) => {
            let text = this.getSelectionOrLine()
            this.tryBoundEval(text, true);
        },
        // #KeyboardShortcut Ctrl-I eval and inspect selection or line
        "Ctrl-I": (cm) => {
          let text = this.getSelectionOrLine()
          this.inspectIt(text)
        },
        // #KeyboardShortcut Ctrl-I eval selection or line (do it)
        "Ctrl-D": (cm, b, c) => {
            let text = this.getSelectionOrLine();
            this.tryBoundEval(text, false);
            return true
        },
        // #KeyboardShortcut Ctrl-F search
        "Ctrl-F": (cm) => {
          // something immediately grabs the "focus" and we close the search dialog..
          // #Hack...
          setTimeout(() => {
                editor.execCommand("findPersistent");
                this.shadowRoot.querySelector(".CodeMirror-search-field").focus();
          }, 10)
          // editor.execCommand("find")
        },
        
        // #KeyboardShortcut Ctrl-Alt-Right multiselect next
        "Ctrl-Alt-Right": "selectNextOccurrence",
        // #KeyboardShortcut Ctrl-Alt-Right undo multiselect
        "Ctrl-Alt-Left": "undoSelection",

        // #KeyboardShortcut Ctrl-/ indent slelection
        "Ctrl-/": "toggleCommentIndented",
        // #KeyboardShortcut Ctrl-# indent slelection
        "Ctrl-#": "toggleCommentIndented",
        // #KeyboardShortcut Tab insert tab or soft indent
        'Tab': (cm) => {
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
          } else {
            cm.execCommand('insertSoftTab')
          }
        },
        // #KeyboardShortcut Ctrl-S save content
        "Ctrl-S": (cm) => {
          this.doSave(cm.getValue());
        },
        // #KeyboardShortcut Ctrl-Alt-V eval and open in vivide
        "Ctrl-Alt-V": async cm => {
          let text = this.getSelectionOrLine();
          let result = await this.tryBoundEval(text, false);
          letsScript(result);
        },
        // #KeyboardShortcut Ctrl-Alt-C show type using tern
        "Ctrl-Alt-I": cm => {
          this.ternWrapper.then(tw => tw.showType(cm, this));
        },
        // #KeyboardShortcut Alt-. jump to definition using tern
        "Alt-.": cm => {
          lively.notify("try to JUMP TO DEFINITION")
          this.ternWrapper.then(tw => tw.jumpToDefinition(cm, this));
        },
        // #KeyboardShortcut Alt-, jump back from definition using tern
        "Alt-,": cm => {
          this.ternWrapper.then(tw => tw.jumpBack(cm, this));
        },
        // #KeyboardShortcut Shift-Alt-. show references using tern
        "Shift-Alt-.": cm => {
          this.ternWrapper.then(tw => tw.showReferences(cm, this));
        },
        
        // #KeyboardShortcut Alt-Up expand selection in ast-aware manner
        "Alt-Up": cm => {
          this.expandSelection(cm)
        },
        // #KeyboardShortcut Alt-Down 
        "Alt-Down": cm => {
        },
        // #KeyboardShortcut Alt-Right 
        "Alt-Right": cm => {
        },
        // #KeyboardShortcut Alt-Left Leave Editor and got to Navigation
        "Alt-Left": cm => {
          this.singalEditorbackNavigation()
        },
        "shift-Alt-Left": cm => {
          this.singalEditorbackNavigation(true)
        },
        // #KeyboardShortcut Alt-F fold (inverse code folding)
        "Alt-F": cm => {
          this.fold(cm);
        },
        // #KeyboardShortcut Shift-Alt-F unfold (inverse code folding)
        "Shift-Alt-F": cm => {
          this.unfold(cm);
        },
        
        // #KeyboardShortcut Shift-Alt-F unfold (inverse code folding)
        "Ctrl-Shift-Alt-F": cm => {
          this.autoFoldMax()
        },
        
        // #KeyboardShortcut Alt-Backspace Leave Editor and got to Navigation
        "alt-Backspace": async cm => {
          this.singalEditorbackNavigation()
        },
        // #KeyboardShortcut Alt-Backspace Leave and Close Editor and got to Navigation
        "shift-alt-Backspace": async cm => {
          this.singalEditorbackNavigation(true)
        },
        
      }
    }
    return this.extraKeys
  }
  
  async singalEditorbackNavigation(closeEditor) {
    var container = lively.query(this, "lively-container")
    if (container) {
      if (closeEditor) await container.onCancel()
      await lively.sleep(10)
      // it seems not to bubble acros shadow root boundaries #Bug ?
      // so we do it manually, but keep it an event
      container.dispatchEvent(new CustomEvent("editorbacknavigation", {
        bubbles: true,
        cancelable: true,
      }))

    }
  }
  
  /*MD ### AST-aware Navigation MD*/
  get selectionRanges() {
    return this.editor.listSelections().map(range);
  }
  get programPath() {
    let programPath;
    this.value.traverseAsAST({
      Program(path) {
        programPath = path;
      }
    });
    return programPath;
  }
  getPathForRoute(route) {
    let path = this.programPath;
    if(!path) {
      lively.warn('No programPath found');
    }
    
    route.forEach(routePoint => {
      path = path.get(routePoint.inList ? routePoint.listKey + '.' + routePoint.key : routePoint.key);
    });
    
    return path;
  }
  nextPath(startingPath, isValid) {
    let pathToShow;

    startingPath.traverse({
      enter(path) {
        if(!pathToShow && isValid(path)) {
          pathToShow = path;
        }
      }
    });

    return pathToShow;
  }
  getInnermostPath(startingPath, nextPathCallback) {
    let pathToShow = startingPath;
    while(true) {
      let nextPath = nextPathCallback(pathToShow);
      if(nextPath) {
        pathToShow = nextPath;
      } else {
        break;
      }
    }

    return pathToShow;
  }
  expandSelection(cm) {
    
    const maxPaths = this.editor.listSelections().map(({ anchor, head }) => {

      // go down to minimal selected node
      const nextPathContainingCursor = (startingPath, {anchor, head}) => {
        return this.nextPath(startingPath, path => {
          const location = range(path.node.loc);
          return location.contains(anchor) && location.contains(head);
        });
      }
      const pathToShow = this.getInnermostPath(this.programPath, prevPath => nextPathContainingCursor(prevPath, { anchor, head }));

      // go up again
      let selectionStart = loc(anchor);
      let selectionEnd = loc(head);
      return pathToShow.find(path => {
        const pathLocation = path.node.loc;
        const pathStart = loc(pathLocation.start);
        const pathEnd = loc(pathLocation.end);

        return pathStart.isStrictBefore(selectionStart) || selectionEnd.isStrictBefore(pathEnd)
      }) || pathToShow;
    });

    this.selectPaths(maxPaths);
  }
  
  selectPaths(paths) {
    const ranges = paths.map(path => {
      const [anchor, head] = range(path.node.loc).asCM();
      return { anchor, head };
    });
    this.editor.setSelections(ranges);
  }
  selectPath(path) {
    range(path.node.loc).selectInCM(this.editor);
  }
  isCursorIn(location, cursorStart) {
    return range(location).contains(this.editor.getCursor(cursorStart));
  }
  
  
  get routeToShownPath() { return this._routeToShownPath = this._routeToShownPath || []; }
  set routeToShownPath(value) { return this._routeToShownPath = value; }
  get markerWrappers() { return this._markerWrappers = this._markerWrappers || []; }
  set markerWrappers(value) { return this._markerWrappers = value; }

  unfold() {
    const prevPath = this.getPathForRoute(this.routeToShownPath)

    const pathToShow = prevPath.findParent(path => this.isValidFoldPath(path));
    
    if(pathToShow) {
      this.foldPath(pathToShow);
    } else {
      lively.warn("No previous folding level found");
    }
  }
  isValidFoldPath(path) {
    return true;
    return path.isProgram() ||
      path.isForOfStatement() ||
      path.isFunctionExpression() ||
      path.isForAwaitStatement() ||
      (path.parentPath && path.parentPath.isYieldExpression()) ||
      path.isArrowFunctionExpression();
  }
  nextFoldingPath(startingPath) {
    return this.nextPath(startingPath, path => {
      const location = path.node.loc;
      if(!this.isCursorIn(location, 'anchor')) { return false; }
      if(!this.isCursorIn(location, 'head')) { return false; }

      return this.isValidFoldPath(path);
    });
  }
  fold() {
    const prevPath = this.getPathForRoute(this.routeToShownPath)
    
    const pathToShow = this.nextFoldingPath(prevPath);
    
    if(pathToShow) {
      this.foldPath(pathToShow);
    } else {
      lively.warn("No next folding level found");
    }
  }
  autoFoldMax() {
    const pathToShow = this.getInnermostPath(this.programPath, prevPath => this.nextFoldingPath(prevPath));
    
    if(pathToShow) {
      this.foldPath(pathToShow);
    } else {
      lively.warn("No folding level for automatic fold found");
    }
  }
  getRouteForPath(path) {
    const route = [];
    
    path.find(path => {
      if(path.isProgram()) { return false; } // we expect to start at a Program node

      route.unshift({
        inList: path.inList,
        listKey: path.listKey,
        key: path.key
      });
      
      return false;
    })
    
    return route;
  }
  foldPath(path) {
    this.removeFolding();

    this.routeToShownPath = this.getRouteForPath(path);

    const location = path.node.loc;

    this.createWrapper({
      line: 0, ch: 0
    }, {
      line: location.start.line - 1, ch: location.start.column
    });
    this.createWrapper({
      line: location.end.line - 1, ch: location.end.column
    }, {
      line: this.editor.lineCount(), ch: 0
    });

    requestAnimationFrame(() => {
      this.editor.refresh();
    });
  }
  createWrapper(from, to) {
    const divStyle = {
      width: "2px",
      height: "1px",
      minWidth: "2px",
      minHeight: "1px",
      borderRadius: "1px",
      backgroundColor: "green"
    };

    return this.wrapWidget('div', from, to).then(div => {
      // div.innerHTML='<i class="fa fa-plus"></i>xx'
      Object.assign(div.style, divStyle);
      this.markerWrappers.push(div);
    });
  }
  removeFolding() {
    this.markerWrappers.forEach(wrapper => wrapper.marker.clear());
    this.markerWrappers.length = 0;
  }
  
  /*MD ### /AST-aware Navigation MD*/
  
  registerExtraKeys(options) {
    if (options) this.addKeys(options)
    var keys = {}
    keys = Object.assign(keys, CodeMirror.keyMap.sublime)
    keys = Object.assign(keys, this.ensureExtraKeys())
    this.editor.setOption("extraKeys", CodeMirror.normalizeKeyMap(keys));
  }
    
  
  setupEditorOptions(editor) {
    editor.setOption("matchBrackets", true)
    editor.setOption("styleSelectedText", true)
    editor.setOption("autoCloseBrackets", true)
    editor.setOption("autoCloseTags", true)
		editor.setOption("scrollbarStyle", "simple")
		editor.setOption("scrollbarStyle", "simple")

    editor.setOption("tabSize", 2)
    editor.setOption("indentWithTabs", false)

    editor.setOption("highlightSelectionMatches", {showToken: /\w/, annotateScrollbar: true})

    // editor.setOption("keyMap",  "sublime")
		
    editor.on("cursorActivity", cm => {
      if (this.ternLoaded) {
        this.ternWrapper.then(tw => tw.updateArgHints(cm, this))
      }
    });
    
    // http://bl.ocks.org/jasongrout/5378313#fiddle.js
    editor.on("cursorActivity", cm => {
      // this.ternWrapper.then(tw => tw.updateArgHints(cm, this));
      const widgetEnter = cm.widgetEnter;
      cm.widgetEnter = undefined;
      if (widgetEnter) {
        // check to see if movement is purely navigational, or if it
        // doing something like extending selection
        var cursorHead = cm.getCursor('head');
        var cursorAnchor = cm.getCursor('anchor');
        if (posEq(cursorHead, cursorAnchor)) {
          widgetEnter();
        }
      }
    });
    editor.setOption("hintOptions", {
      container: this.shadowRoot.querySelector("#code-mirror-hints"),
      codemirror: this,
      closeCharacters: /\;/ // we want to keep the hint open when typing spaces and "{" in imports...
    });
    
    this.registerExtraKeys()
  }

  
  
  // Fires when an attribute was added, removed, or updated
  attributeChangedCallback(attr, oldVal, newVal) {
    if(!this.editor){
        return false;
    }
    switch(attr){
      // case "theme":
      //     this.editor.setTheme( newVal );
      //     break;
      case "mode":
          this.editor.setOption('mode', newVal);
          break;
      // case "fontsize":
      //     this.editor.setFontSize( newVal );
      //     break;
      // case "softtabs":
      //     this.editor.getSession().setUseSoftTabs( newVal );
      //     break;
      // case "tern":
      //   if (newVal)
      // this.enableTern()
      //   break;

      case "tabsize":
				this.setOption("tabSize", newVal)
        break;
      // case "readonly":
      //     this.editor.setReadOnly( newVal );
      //     break;
      case "wrapmode":
        this.setOption("lineWrapping", newVal)
        break;
    }
  }


  setOption(name, value) {
    if (!this.editor) return; // we loose...
    this.editor.setOption(name, value)
  }

  doSave(text) {
    this.tryBoundEval(text) // just a default implementation...
  }

  getSelectionOrLine() {
    var text = this.editor.getSelection()
    if (text.length > 0)
      return text
    else
      return this.editor.getLine(this.editor.getCursor("end").line)
  }

  getDoitContext() {
    return this.doitContext
  }

  setDoitContext(context) {
    return this.doitContext = context;
  }

  getTargetModule() {
    // lazily initialize a target module name as fallback
    return this.targetModule || (this.targetModule = lively4url +'/unnamed_module_' + generateUUID().replace(/-/g, '_')); // make it relative to a real path so that relative modules work
  }

  setTargetModule(module) {
    return this.targetModule = module;
  }

  async boundEval(str) {
    // console.log("bound eval " + str)
    var targetModule = this.getTargetModule()
    
    if(targetModule.match(/.py$/)) {
      return this.boundEvalPython(str)
    }
    // Ensure target module loaded (for .js files only)
    if(targetModule.match(/.js$/)) {
      await System.import(targetModule)
    }
    console.log("EVAL (CM)", targetModule);
    // src, topLevelVariables, thisReference, <- finalStatement
    return boundEval(str, this.getDoitContext(), targetModule);
  }
  
  async boundEvalPython(str) {
    var result = ""
    var xterm = document.querySelector("lively-xterm.python")
    if (xterm) {
      var term = xterm.term
      term.__socket.addEventListener('message', function (event) {
        result += event.data;
      });
      // how long do we want to wait?

      term.__sendData(str + "\n")

      while(!result.match(">>>")) {
        // busy wait for the prompt
        await lively.sleep(50) 
      }
      // strip input and prompt.... oh what a hack
      return {value: result.replace(str,"").replace(/^[\r\n]+/,"").replace(/>>> $/,"")}     
    } else {
      lively.notify("no open python terminal session found")
    }
    return {value: ""}
  }

  printWidget(name) {
    return this.wrapWidget(name, this.editor.getCursor(true), this.editor.getCursor(false))
  }

  wrapWidget(name, from, to, options) {
    var widget = document.createElement("span");
    widget.classList.add("lively-widget")
    widget.style.whiteSpace = "normal";
    var promise = lively.create(name, widget);
    promise.then(comp => {
      Object.assign(comp.style, {
        display: "inline",
        // backgroundColor: "rgb(250,250,250)",
        display: "inline-block",
        minWidth: "20px",
        minHeight: "20px"
      });
    });
    // #TODO, we assume that it will keep the first widget, and further replacements do not work.... and get therefore thrown away
    var marker = this.editor.doc.markText(from, to, Object.assign({
      replacedWith: widget
    }, options));
    promise.then(comp => comp.marker = marker);

    return promise;
  }


  async printResult(result, obj, isPromise) {
    var editor = this.editor;
    var text = result
    var isAsync = false
    this.editor.setCursor(this.editor.getCursor("end"))
    // don't replace existing selection
    this.editor.replaceSelection(result, "around")
    if (obj && obj.__asyncresult__) {
      obj = obj.__asyncresult__; // should be handled in bound-eval.js #TODO
      isAsync = true
    }
    var promisedWidget
    var objClass = (obj && obj.constructor && obj.constructor.name) || (typeof obj)
    if (isSet.call(obj)) {
      obj = Array.from(obj)
    }

    if (_.isMap(obj)) {
      var mapObj = {}
      Array.from(obj.keys()).sort().forEach(key => mapObj[key] = obj.get(key))
      obj = mapObj
    }
    if (Array.isArray(obj) && !obj.every(ea => ea instanceof Node)) {
      if (obj.every(ea => (typeof ea == 'object') && !(ea instanceof String))) {
        promisedWidget = this.printWidget("lively-table").then( table => {
          table.setFromJSO(obj)
          table.style.maxHeight = "300px"
          table.style.overflow = "auto"
          return table
        })
      } else {
        promisedWidget = this.printWidget("lively-table").then( table => {
          table.setFromJSO(obj.map((ea,index) => {
            return {
              index: index,
              value: this.ensuredPrintString(ea)
            }
          }));
          table.style.maxHeight = "300px";
          table.style.overflow = "auto";
          return table;
        })
      }
    } else if(objClass ==  "Matrix") {
      // obj = obj.toString()
      debugger
    } else if ((typeof obj == 'object') && (obj !== null)) {
      promisedWidget = this.printWidget("lively-inspector").then( inspector => {
        inspector.inspect(obj)
        inspector.hideWorkspace()
        return inspector
      })
    }
    if (promisedWidget) {
        var widget = await promisedWidget;
        var span = <span style="border-top:2px solid darkgray;color:darkblue">
          {isPromise ? "PROMISED" : ""} <u>:{objClass}</u> </span>
        widget.parentElement.insertBefore(span, widget)
        span.appendChild(widget)
        if (isAsync && promisedWidget) {
          if (widget) widget.style.border = "2px dashed blue"
        }

    }
  }

  ensuredPrintString(obj) {
    var s = "";
    try {
      s += obj // #HACK some objects cannot be printed any more
    } catch(e) {
      s += `UnprintableObject[Error: ${e}]`; // so we print something else
    }
    return s
  }

  async tryBoundEval(str, printResult) {
    var resp = await this.boundEval(str);
    if (resp.isError) {
      var e = resp.value;
      console.error(e);
      if (printResult) {
        window.LastError = e;
        this.printResult("" + e);
      } else {
        lively.handleError(e);
      }
      return e;
    }
    var result = resp.value

    if (printResult) {
      // alaways wait on promises.. when interactively working...
      if (result && result.then) { //  && result instanceof Promise
        // we will definitly return a promise on which we can wait here
        result
          .then( result => {
            this.printResult("RESOLVED: " + this.ensuredPrintString(result), result, true)
          })
          .catch( error => {
            console.error(error);
            // window.LastError = error;
            this.printResult("Error in Promise: \n" +error)
          })
      } else {
        this.printResult(" " + this.ensuredPrintString(result), result)
        if (result instanceof HTMLElement ) {
          try {
            lively.showElement(result)
          } catch(e) {
            // silent fail... not everything can be shown...
          }
        }
      }
    }
    return result
  }

  async inspectIt(str) {
    var result =  await this.boundEval(str);
    if (!result.isError) {
      result = result.value
    }
    if (result.then) {
      result = await result; // wait on any promise
    }
    lively.openInspector(result, undefined, str)
  }


  doSave(text) {
    this.tryBoundEval(text) // just a default implementation...
  }


  detachedCallback() {
    this._attached = false;
  };

  get value() {
    if (this.editor) {
      return this.editor.getValue()
    } else {
      return this._value
    }
  }

  set value(text) {
    if (this.editor) {
      this.editor.setValue(text)
    } else {
      this._value = text
    }
  }

  setCustomStyle(source) {
    this.shadowRoot.querySelector("#customStyle").textContent = source
  }

  getCustomStyle(source) {
    return this.shadowRoot.querySelector("#customStyle").textContent
  }

  encodeHTML(s) {
    return s.replace("&", "&amp;").replace("<", "&lt;")
  }

  decodeHTML(s) {
    return s.replace("&lt;", "<").replace("&amp;", "&")
  }

  resize() {
    // #ACE Component compatiblity
  }

  enableAutocompletion() {
    // #ACE Component compatiblity
  }

  get isJavaScript() {
    if (!this.editor) return false;
    let mode = this.editor.getOption("mode");
    return mode === "javascript" || mode === 'text/jsx';
  }

  get isMarkdown() {
    if (!this.editor) return false;
    return this.editor.getOption("mode") == "gfm";
  }

  get isHTML() {
    if (!this.editor) return false;
    return this.editor.getOption("mode") == "text/html";
  }


  async changeModeForFile(filename) {
    if (!this.editor) return;

    var mode = "text"
    // #TODO there must be some kind of automatching?
    if (filename.match(/\.html$/)) {
      mode = "text/html"
    } else if (filename.match(/\.md$/)) {
      mode = "gfm"
    } else if (filename.match(/\.tex$/)) {
      mode = "text/x-stex"
    } else if (filename.match(/\.css$/)) {
      mode = "css"
    } else if (filename.match(/\.xml$/)) {
      mode = "xml"
    } else if (filename.match(/\.json$/)) {
      mode = "javascript"
    } else if (filename.match(/\.js$/)) {
      mode = "text/jsx"
    } else if (filename.match(/\.py$/)) {
      mode = "text/x-python"
    } else if (filename.match(/\.c$/)) {
      mode = "text/x-csrc"
    } else if (filename.match(/\.cpp$/)) {
      mode = "text/x-c++src"
    } else if (filename.match(/\.h$/)) {
      mode = "text/x-c++src"
    } else if (filename.match(/\.sh$/)) {
      mode = "text/x-sh"
    }
    
    
    this.mode = mode
    this.editor.setOption("mode", mode)
    if (mode == "gfm" || mode == "text/x-stex") {
      // #TODO make language customizable
      var m = this.value.match(/^.*lang\:(.._..)/)
      if (m) {
        var lang = m[1]
        var dict = await spellCheck.loadDictLang(lang)
        if (dict) {
          lively.notify("start spell checking lang: " + lang)
          spellCheck.startSpellCheck(this.editor, dict)
        } else {
          console.log("spellchecking language not found: " + lang)
        }
      } else {
        spellCheck.startSpellCheck(this.editor, await spellCheck.current())
      }
    }

  }

  livelyPrepareSave() {
    if(!this.editor) { return; }
    this.textContent = this.encodeHTML(this.editor.getValue())
  }

  livelyPreMigrate() {
    if (this.editor) {
      this.lastScrollInfo = this.editor.getScrollInfo(); // #Example #PreserveContext
    }
  }

  focus() {
    if(this.editor) this.editor.focus()
  }

  isFocused(doc) {
    doc = doc || document
    if (doc.activeElement === this) return true
    // search recursively in shadowDoms
    if (doc.activeElement && doc.activeElement.shadowRoot) {
			return this.isFocused(doc.activeElement.shadowRoot)
    }
    return false
  }

  async livelyMigrate(other) {
    lively.addEventListener("Migrate", this, "editor-loaded", evt => {
      if (evt.composedPath()[0] !== this) return; // bubbled from another place... that is not me!
      lively.removeEventListener("Migrate", this, "editor-loaded") // make sure we migrate only once
      this.value = other.value;
      if (other.lastScrollInfo) {
        this.editor.scrollTo(other.lastScrollInfo.left, other.lastScrollInfo.top)
      }
    })
  }

  fixHintsPosition() {
    lively.setPosition(this.shadowRoot.querySelector("#code-mirror-hints"),
  pt(-document.scrollingElement.scrollLeft,-document.scrollingElement.scrollTop).subPt(lively.getGlobalPosition(this)))
  }


//   async enableTern() {
//     await LivelyCodeMirror.loadTernModules()

//     var ecmascriptdefs = await fetch(lively4url + "/src/external/tern/ecmascript.json").then(r => r.json())
//     var browserdefs = await fetch(lively4url + "/src/external/tern/browser.json").then(r => r.json())
//     // var chaidefs = await fetch(lively4url + "/src/external/tern/chai.json").then(r => r.json())

//     // Options supported (all optional):
//     // * defs: An array of JSON definition data structures.
//     // * plugins: An object mapping plugin names to configuration
//     //   options.
//     // * getFile: A function(name, c) that can be used to access files in
//     //   the project that haven't been loaded yet. Simply do c(null) to
//     //   indicate that a file is not available.
//     // * fileFilter: A function(value, docName, doc) that will be applied
//     //   to documents before passing them on to Tern.
//     // * switchToDoc: A function(name, doc) that should, when providing a
//     //   multi-file view, switch the view or focus to the named file.
//     // * showError: A function(editor, message) that can be used to
//     //   override the way errors are displayed.
//     // * completionTip: Customize the content in tooltips for completions.
//     //   Is passed a single argument the completion's data as returned by
//     //   Tern and may return a string, DOM node, or null to indicate that
//     //   no tip should be shown. By default the docstring is shown.
//     // * typeTip: Like completionTip, but for the tooltips shown for type
//     //   queries.
//     // * responseFilter: A function(doc, query, request, error, data) that
//     //   will be applied to the Tern responses before treating them

//     // It is possible to run the Tern server in a web worker by specifying
//     // these additional options:
//     // * useWorker: Set to true to enable web worker mode. You'll probably
//     //   want to feature detect the actual value you use here, for example
//     //   !!window.Worker.
//     // * workerScript: The main script of the worker. Point this to
//     //   wherever you are hosting worker.js from this directory.
//     // * workerDeps: An array of paths pointing (relative to workerScript)
//     //   to the Acorn and Tern libraries and any Tern plugins you want to
//     //   load. Or, if you minified those into a single script and included
//     //   them in the workerScript, simply leave this undefined.

//     this.ternServer = new CodeMirror.TernServer({
//       defs: [ecmascriptdefs, browserdefs], // chaidefs
//       plugins: {
//         es_modules: {}
//       },
//       getFile: (name, c) => {
//         lively.notify("get file " + name)
//         c(null)
//       },
//       // responseFilter: (doc, query, request, error, data) => {
//       //  return data
//       // }

//     });

//     this.editor.setOption("extraKeys", Object.assign({},
//       this.editor.getOption("extraKeys"),
//       {
//         "Ctrl-Space": (cm) => {
//           this.fixHintsPosition();
//           this.ternServer.complete(cm);
//         },
//         "Ctrl-Alt-I": (cm) => { this.ternServer.showType(cm); },
//         "Ctrl-O": (cm) => { this.ternServer.showDocs(cm); },
//         "Alt-.": (cm) => { this.ternServer.jumpToDef(cm); },
//         "Alt-,": (cm) => { this.ternServer.jumpBack(cm); },
//         "Ctrl-Q": (cm) => { this.ternServer.rename(cm); },
//         "Ctrl-.": (cm) => { this.ternServer.selectName(cm); }
//       }))

//     this.editor.on("cursorActivity", (cm) => { this.ternServer.updateArgHints(cm); });
//   }


  async addTernFile(name, url, text) {
    if (!this.ternServer) return
    url = url || name;
    text = text || await fetch(url).then(r => r.text())
    this.ternServer.server.addFile(name, text)
  }

  mergeView(originalText, originalLeftText) {
    debugger
    var target = this.shadowRoot.querySelector("#code-mirror-container")
    target.innerHTML = "";
    this._mergeView =  CodeMirror.MergeView(target, {
      value: this.value,
      origLeft: originalLeftText,
      orig: originalText,
      lineNumbers: true,
      mode: this.editor.getOption('mode'),
      scrollbarStyle: this.editor.getOption('scrollbarStyle'),
      highlightDifferences: true,
      connect: "align",
      lineWrapping: true,
      collapseIdentical: false
    });
    // if (this._mergeView.right) {
    // this.setEditor(this._mergeView.right.edit)
    // }
    this.setEditor(this._mergeView.editor())
    // this.resizeMergeView(this._mergeView)
  }

  resizeMergeView(mergeView) {
    function editorHeight(editor) {
      if (!editor) return 0;
      return editor.getScrollInfo().height;
    }

    function mergeViewHeight(mergeView) {
      return Math.max(editorHeight(mergeView.leftOriginal()),
                      editorHeight(mergeView.editor()),
                      editorHeight(mergeView.rightOriginal()));
    }
    var height = mergeViewHeight(mergeView);
    for(;;) {
      if (mergeView.leftOriginal())
        mergeView.leftOriginal().setSize(null, height);
      mergeView.editor().setSize(null, height);
      if (mergeView.rightOriginal())
        mergeView.rightOriginal().setSize(null, height);

      var newHeight = mergeViewHeight(mergeView);
      if (newHeight >= height) break;
      else height = newHeight;
    }
    mergeView.wrap.style.height = height + "px";
  }

  async hideDataURLs() {
    var regEx = new RegExp("[\"\'](data:[^\"\']*)[\"\']", "g");
    do {
      var m = regEx.exec(this.value);
      if (m) {
        var from = m.index
        var to = m.index + m[0].length
        await this.wrapWidget("span", this.editor.posFromIndex(from),
                              this.editor.posFromIndex(to)).then( div => {
          div.style.backgroundColor = "rgb(240,240,240)"

          if (m[1].match(/^data:image/)) {
            var img = document.createElement("img")
            img.src = m[1]
            img.title = m[1].slice(0,50) + "..."
            img.style.maxHeight = "100px"

            div.appendChild(document.createTextNode("\""))
            div.appendChild(img)
            div.appendChild(document.createTextNode("\""))
          } else {
            div.innerHTML = "\""+ m[1].slice(0,50) + "..." + "\""
          }
        })

      }
    } while (m);
  }

//    async wrapImageLinks() {
//     var regEx = new RegExp("\!\[\]\(([A-Za-z0-9_ .]\.((jpg)|(png)))$\)", "g");
//     do {
//       var m = regEx.exec(this.value);
//       if (m) {
//         var from = m.index
//         var to = m.index + m[0].length
//         var url = m[1]
//         await this.wrapWidget("span", this.editor.posFromIndex(from),
//                               this.editor.posFromIndex(to)).then( div => {
//           div.style.backgroundColor = "rgb(240,240,240)"

//           if (m[1].match(/^data:image/)) {
//             var img = document.createElement("img")
//             img.src = m[1]
//             img.title = m[1].slice(0,50) + "..."
//             img.style.maxHeight = "100px"

//             div.appendChild(document.createTextNode("\""))
//             div.appendChild(img)
//             div.appendChild(document.createTextNode("\""))
//           } else {
//             div.innerHTML = "\""+ m[1].slice(0,50) + "..." + "\""
//           }
//         })

//       }
//     } while (m);
//   }


  async wrapImports() {
    // dev mode alternative to #DevLayers, a #S3Pattern: add code the scopes your dev example inline while developing
    if(this.id !== 'spike') {
      // lively.warn('skip because id is not spike')
      return;
    }
    // lively.success('wrap imports in spike')

    const getImportDeclarationRegex = () => {
      const LiteralString = `(["][^"\\n\\r]*["]|['][^'\\n\\r]*['])`;
      const JavaScriptIdentifier = '([a-zA-Z$_][a-zA-Z0-9$_]*)'

      const ImportSpecifierPartSimple = `(${JavaScriptIdentifier})`;
      const ImportSpecifierPartRename = `(${JavaScriptIdentifier}\\s+as\\s+${JavaScriptIdentifier})`;
      const ImportSpecifierPart = `(${ImportSpecifierPartSimple}|${ImportSpecifierPartRename})`;
      // ImportSpecifier: {foo} or {foo as bar}
      const ImportSpecifier = `({\\s*((${ImportSpecifierPart}\\s*\\,\\s*)*${ImportSpecifierPart}\\,?)?\\s*})`;
      // ImportDefaultSpecifier: foo
      const ImportDefaultSpecifier = `(${JavaScriptIdentifier})`;
      // ImportNamespaceSpecifier: * as foo
      const ImportNamespaceSpecifier = `(\\*\\s*as\\s+${JavaScriptIdentifier})`;
      const anySpecifier = `(${ImportSpecifier}|${ImportDefaultSpecifier}|${ImportNamespaceSpecifier})`;
      // ImportDeclaration: import [any] from Literal
      const ImportDeclaration = `import\\s*(${anySpecifier}\\s*\\,\\s*)*${anySpecifier}\\s*from\\s*${LiteralString}(\\s*\\;)?`;

      return ImportDeclaration;
    };

    var regEx = new RegExp(getImportDeclarationRegex(), 'g');

    do {
      var m = regEx.exec(this.value);
      if (m) {
        await LivelyCodeMirrorWidgetImport.importWidgetForRange(this, m);
      }
    } while (m);
  }

   async wrapLinks() {
    // dev mode
    if(this !== window.that) {
      return;
    }
    var regEx = new RegExp("\<([a-zA-Z0-9]+\:\/\/[^ ]+)\>", "g");
    do {
      var m = regEx.exec(this.value);
      if (m) {
        lively.warn("wrap link: " + m[0])
        var from = m.index
        var to = m.index + m[0].length
        var link = m[1]
        // #TODO check for an existing widget and reuse / update it...
        await this.wrapWidget("span", this.editor.posFromIndex(from),
                              this.editor.posFromIndex(to)).then(widget => {
          window.lastWidget = widget

          widget.style.backgroundColor = "rgb(120,120, 240)"
          var input = <input></input>
          input.value = m[0]

          lively.warn("new input " + input)


          input.addEventListener("keydown", evt => {
            var range = widget.marker.find()
            if (evt.keyCode == 13) { // ENTER
              // #TODO how to replace // update text without replacing widgets
              this.editor.replaceRange(input.value, range.from, range.to) // @Stefan, your welcome! ;-)
              this.wrapLinks() // don't wait and do what you can now
            }
            if (evt.keyCode == 37) { // Left
              if (input.selectionStart == 0) {
                this.editor.setSelection(range.from, range.from)
                this.focus()
              }
            }

            if (evt.keyCode == 39) { // Right
              if (input.selectionStart == input.value.length) {
                this.editor.setSelection(range.to, range.to)
                this.focus()
              }
            }
          })

          widget.appendChild(input)
          // widget.appendChild(<button click={e => {
          //   lively.openBrowser(link)  // #TODO fix browse and open browser...
          // }}>browse</button>)
        })

      }
    } while (m);
  }

  checkSyntax() {
    if (this.isJavaScript) {
      SyntaxChecker.checkForSyntaxErrors(this.editor);
      this.wrapImports();
      this.wrapLinks();
    }
    if (this.isMarkdown || this.isHTML) {
      this.hideDataURLs()
    }
  }


  find(str) {
    // #TODO this is horrible... Why is there not a standard method for this?
	if (!this.editor) return;
    var found = false;
    this.value.split("\n").forEach((ea, index) => {
      var startPos = ea.indexOf(str)
      if (!found && (startPos != -1)) {
	    this.editor.setCursor(index + 20, 10000);// line end ;-)
        this.editor.focus()
        this.editor.setSelection({line: index, ch: startPos }, {line: index, ch: startPos + str.length})
        found = ea;
      }
    })
  }

  unsavedChanges() {
    if (this.editor.getValue() === "") return false
    return  true // workspaces should be treated carefully
   }


}

// LivelyCodeMirror.loadModules()

