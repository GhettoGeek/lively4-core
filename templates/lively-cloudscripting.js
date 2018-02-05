import Morph from 'src/components/widgets/lively-morph.js';
import {pt} from 'src/client/graphics.js';

const endpoint = 'https://lively4-services.herokuapp.com/';
var name;
var filename; 
var type;
var loggingId;
var currentlyShownConfig=null;

export default class LivelyCloudscripting extends Morph {
  async initialize() {
    this.windowTitle = "Cloudscripting";
    this.addButton = this.getSubmorph('#addTriggerButton');
    this.addButton.addEventListener('click', this.addButtonClick.bind(this));
    this.login = this.getSubmorph('#login');
    this.login.addEventListener('click', this.loginClick.bind(this));
    this.credentials = this.getSubmorph('#credentials');
    this.credentials.addEventListener('click', this.credentialsClick.bind(this));
    this.codeEditor = this.getSubmorph('#code').editor;
    this.codeEditor.doSave=function(){}
    var that = this
    this.getSubmorph("#createWatcher").addEventListener('click',function(){
      
      var newFilename=prompt("Enter the name of the new watcher","");
      if(newFilename){
        $.ajax({
          url: endpoint+"createTrigger",
          type: 'POST',
          data:JSON.stringify({
            name:newFilename
          }),
          success: function(res){
            lively.notify("Successfully created new watcher.",undefined, undefined, undefined, "green")
          },   
          done: function(res){lively.notify("done")},
          error: function(res){lively.notify(res,"red")}
        });
      }
    })
    this.getSubmorph("#createAction").addEventListener('click',function(){
      
      var newFilename=prompt("Enter the name of the new action","");
      if(newFilename){
        $.ajax({
          url: endpoint+"createAction",
          type: 'POST',
          data:JSON.stringify({
            name:newFilename
          }),
          success: function(res){
           lively.notify("Successfully created new action.", undefined, undefined, undefined, "green")
          },   
          done: function(res){lively.notify("done")},
          error: function(res){lively.notify(res,"red")}
        });
      }
    })
    this.codeEditor.doSave = function() {lively.warn("Don't evaluate code...")};
    this.codeEditor.commands.addCommand({
      name: "save",
      bindKey: {win: "Ctrl-S", mac: "Command-S"},
      exec: (editor) => {
        this.saveCode()
      }
    });
    this.logsEditor = this.getSubmorph('#logs').editor;
    if (this.logsEditor) { // editor is not initialized during testing
      this.logsEditor.setReadOnly(true);
    }
    this.startButton = this.getSubmorph('#startButton');
    this.startButton.addEventListener('click', this.startButtonClick.bind(this));
    this.stopButton = this.getSubmorph('#stopButton');
    this.stopButton.addEventListener('click', this.stopButtonClick.bind(this));
    this.config=null;
  }
  
  /*
   * Event handlers
   */
  
  addButtonClick(evt) {
    lively.openComponentInWindow('lively-cloudscripting-file-browser').then(browser => {
      browser.path = endpoint + 'mount/watcher';
      browser.urlExtension="getWatcherDescription"
      lively.setGlobalPosition(browser.parentElement, lively.getGlobalPosition(this.parentElement).addPt(pt(30,30)))
      browser.setMainAction((url) => {
        this.addTrigger(url);
        browser.parentElement.onCloseButtonClicked();
      });
    });
  }
  
  loginClick(evt) {
    name = this.getSubmorph('#name').value;
    this.getTriggers();
  }
  
  credentialsClick(evt) {
    var that = this;
    lively.openComponentInWindow('lively-cloudscripting-credentials').then(credentialsWindow => {
      credentialsWindow.setName(name);
      credentialsWindow.getCredentials(name);
    });
  }
  
  startButtonClick(entryPoint) {
    var that = this;
    clearInterval(loggingId);
    loggingId = setInterval(function() {
      that.getTriggerLogs(that.filename);  
    },2000)
    $.ajax({
      url: endpoint + 'runTrigger',
      type: 'POST',
      data: JSON.stringify({
        user: name,
        triggerId: that.filename
      }),
      success: () => {lively.notify("start script")},
      error: function(res){console.log(res)}
    })
    
  }

  stopButtonClick(entryPoint) {
    var that=this
    clearInterval(loggingId); 
    $.ajax({
      url: endpoint + 'stopTrigger',
      type: 'POST',
      data: JSON.stringify({
        user: name,
        triggerId: that.filename
      }),
      success: () => {lively.notify("stop")},
      error: this.handleAjaxError.bind(this)
    })
  }
  
  // functions
  addTrigger(triggerName) {
    triggerName = triggerName.toString();
    triggerName = triggerName.substring(triggerName.lastIndexOf('/') + 1);
    lively.warn("assignTrigger at " + endpoint + "assignTrigger" + "for user" + name + "and trigger " + triggerName )
    $.ajax({
      url: endpoint + 'assignTrigger',
      type: 'POST',
      data: JSON.stringify({
        user: name,
        triggerId: triggerName
      }),
      success: this.getTriggers.bind(this),
      error: this.handleAjaxError.bind(this)
    })
  }
  
  getTriggers() {
    $.ajax({
      url: endpoint + 'getUserTriggers',
      type: 'POST',
      data: JSON.stringify({
        user: name
      }),
      success: this.reRender.bind(this),
      error: function(res){lively.notify(JSON.stringify(res)); lively.notify("user doesn't exist? "); }
    })
  }
  
  getTriggerLogs(triggerName) {
    var that = this;
    console.log("triggerName "+triggerName)
    console.log("name "+name)
    $.ajax({
      url: endpoint + 'getTriggerLogs',
      type: 'POST',
      data: JSON.stringify({
        triggerId: triggerName,
        user: name
      }),
      success: function(res) {console.log(res);that.logsEditor.setValue(res), that.logsEditor.gotoPageDown()},
      error: this.handleAjaxError.bind(this)
    })
  }
  
  reRender(triggers) {
    if( typeof triggers === 'string') {
      lively.notify("New user created", undefined, undefined, undefined, "green");
      return;
    }
    lively.notify("Successfully logged in", undefined, undefined, undefined, "green");
    var triggerWrapper = this.getSubmorph('#trigger-wrapper');
    while(triggerWrapper.firstChild) {
      triggerWrapper.removeChild(triggerWrapper.firstChild)
    }
    
    for(var prop in triggers) {
      var that = this;
      if(!triggers.hasOwnProperty(prop)) continue;
      
      var item = this.createItem(prop);
      var actionList = item.getSubmorph('.action-list');
      this.addActionsToItem(triggers, prop, triggers[prop]['actions'] ? triggers[prop]['actions'].length : 0, that, actionList);
      
      item.getSubmorph('.add-action').addEventListener('click', function(event){
        event.stopPropagation();
        var triggerName = event.target.parentNode.parentNode.children[0].children[1].innerHTML;
        that.assignAction.bind(that);
        that.assignAction(triggerName);
      });
    
      item.getSubmorph('.status').classList.add(this.getStatusForTrigger(triggers, prop)); 
      triggerWrapper.appendChild(item);
    }
  }
  
  getStatusForTrigger(triggers, prop) {
    var status = triggers[prop].running === 'true' ? 1 : 0;
    if (triggers[prop].running) {
      status = 'running';
    } else if (!triggers[prop].running) {
      status = 'not-running';
    }
  }
  
  addActionsToItem(triggers, prop, length, that, actionList) {
    for(var i=0; i<length; i++) {
        var actionName = triggers[prop]['actions'][i].name;
        var action = document.createElement('lively-cloudscripting-action-item');
        action.getSubmorph(".editTemplate").addEventListener('click',function(){
          $.ajax({
          url: endpoint+"getActionConfigTemplate",
          type: 'POST',
          data:JSON.stringify({
            actionId:actionName
          }),
          success: function(res){
           lively.notify("Successfully remove action.")
            console.log(res);
            that.showConfig(res,null,actionName);
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        }); 
        })
        action.getSubmorph(".deleteWatcher").addEventListener('click',function(){
          console.log(prop)
           $.ajax({
          url: endpoint+"removeAction",
          type: 'POST',
          data:JSON.stringify({
            user:name,
            triggerId:prop.replace(/\s/g, ""),
            actionId:actionName
          }),
          success: function(res){
           lively.notify("Successfully remove action.")
            that.reRender(that.getTriggers())
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        }); 
        })
        action.addEventListener('click', function(evt) {
          evt.stopPropagation();
          that.showCode.bind(that)
          that.showCode(evt)
        })
        action.setAttribute('data-id', actionName);
        action.setAttribute('data-type', 'actions')
        action.setAttribute('data-parent',prop);
        action.getSubmorph('.itemname').innerHTML = actionName;
        var icon = action.getSubmorph('.addAction')
        icon.addEventListener('click', function(event) {
          event.stopPropagation();
          that.unassignAction();
        })
        this.setUpConfigButton(action,"getActionConfig","updateActionConfig",prop,this,actionName)
        action.appendChild(icon);
        actionList.appendChild(action);
      }
  }
  setUpConfigButton(item,url,saveurl,triggerId,that,actionId){
    
    item.getSubmorph('#modify-configuration').addEventListener('click', function(){
      console.log(that.config)
      var table=item.getSubmorph(".config-table");
      if(currentlyShownConfig===table){
        console.log(that.config)
        that.saveConfig(saveurl,triggerId,actionId)
        currentlyShownConfig.parentElement.removeChild(currentlyShownConfig.previousElementSibling)
        currentlyShownConfig.previousElementSibling.childNodes[1].className="chevron fa fa-chevron-down"
        currentlyShownConfig.previousElementSibling.childNodes[0].textContent="Modify config"
        currentlyShownConfig.nextElementSibling.className+=" hide"
        for(var i=0;i<table.childElementCount;i++){
          table.removeChild(table.lastChild);
        }
        currentlyShownConfig=null
        
      }else{
        if(currentlyShownConfig!=null){
          currentlyShownConfig.parentElement.removeChild(currentlyShownConfig.previousElementSibling)
          currentlyShownConfig.previousElementSibling.childNodes[0].textContent="Modify config"
          currentlyShownConfig.previousElementSibling.childNodes[1].className="chevron fa fa-chevron-down"
          currentlyShownConfig.nextElementSibling.className+=" hide"
          for(var i=0;i<currentlyShownConfig.childElementCount;i++){
            currentlyShownConfig.removeChild(currentlyShownConfig.lastChild);
          }
        }
        
        // if(table.rows.length === 0) {
        //   url += "Template"
        // }
        
        $.ajax({
          url: endpoint+url,
          type: 'POST',
          data:JSON.stringify({
            user:name,
            triggerId:triggerId,
            actionId:actionId
          }),
          success: function(res){
           console.log(res)
            that.config=res;
            currentlyShownConfig=table;
            that.renderConfig(table)
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        }); 
      }
    });
  }
  
  createItem(prop) {
//     create new file
    // var newFilename=prompt("Enter the name of the new watcher","");
    //   if(newFilename){
    //     $.ajax({
    //       url: endpoint+"createTrigger",
    //       type: 'POST',
    //       data:JSON.stringify({
    //         name:newFilename
    //       }),
    //       success: function(res){
    //        lively.notify("Successfully remove action.")
    //         that.reRender(that.getTriggers())
    //       },   
    //       done: function(res){lively.notify("done")},
    //       error: function(res){console.log(res)}
    //     }); 
    var that=this
    var item = document.createElement('lively-cloudscripting-item');
    item.getSubmorph('.editTemplate').addEventListener('click',function(evt){
      lively.notify(evt.target.previousElementSibling.previousElementSibling.innerHTML)
      var triggerId=evt.target.previousElementSibling.previousElementSibling.innerHTML
      $.ajax({
          url: endpoint+"getWatcherConfigTemplate",
          type: 'POST',
          data:JSON.stringify({
            triggerId:triggerId
          }),
          success: function(res){
           lively.notify("Successfully remove action.")
            console.log(res);
            that.showConfig(res,triggerId,null);
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        }); 
    })
    item.addEventListener('click', this.showCode.bind(this))
    item.setAttribute('data-id', prop);
    item.setAttribute('data-type', 'watcher');
    if (prop == 'selected') {
      item.getSubmorph('.item').classList.add('selected');
    }
    this.setUpConfigButton(item,"getWatcherConfig","updateWatcherConfig",prop,this,null)
    var title = prop;
    item.getSubmorph('h4').innerHTML = title;
    item.getSubmorph('.deleteWatcher').addEventListener('click',function(){
      $.ajax({
          url: endpoint+"removeTrigger",
          type: 'POST',
          data:JSON.stringify({
            user:name,
            triggerId:prop.replace(/\s/g, "")
          }),
          success: function(res){
           lively.notify("Successfully remove action.")
            that.reRender(that.getTriggers())
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        }); 
    })
    return item;
  }
  
  showConfig(data,triggerId,actionId){
    lively.notify("showconfig")
    lively.openComponentInWindow('juicy-ace-editor').then(configEditor => {
      // configEditor.getSubmorph("content").innerHTML=data
      configEditor.value=data
      configEditor.unsavedChanges=function(){return false}
      configEditor.doSave=function(){
        if(triggerId){
        $.ajax({
          url: endpoint+"updateWatcherConfigTemplate",
          type: 'POST',
          data:JSON.stringify({
            triggerId:triggerId.replace(/\s/g, ""),
            data:configEditor.value
          }),
          success: function(res){
           lively.notify("Successfully update config.")
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        });
        }else{
          $.ajax({
          url: endpoint+"updateActionConfigTemplate",
          type: 'POST',
          data:JSON.stringify({
            actionId:actionId.replace(/\s/g, ""),
            data:configEditor.value
          }),
          success: function(res){
           lively.notify("Successfully update config.")
          },   
          done: function(res){lively.notify("done")},
          error: function(res){console.log(res)}
        });
        }
      }
      });
  }
  
  renderConfig(table){
    var that=this
    var cross = document.createElement("i")
    cross.className="chevron-cross fa fa-times"
    table.parentElement.insertBefore(cross, table);
    cross.addEventListener('click',function(e){
      currentlyShownConfig.parentElement.removeChild(currentlyShownConfig.previousElementSibling)
      currentlyShownConfig.previousElementSibling.childNodes[1].className="chevron fa fa-chevron-down"
      currentlyShownConfig.previousElementSibling.childNodes[0].textContent="Modify config"
      currentlyShownConfig.nextElementSibling.className+=" hide"
      for(var i=0;i<table.childElementCount;i++){
        table.removeChild(table.lastChild);
      }
      currentlyShownConfig=null
    })
    
    for(var key in that.config){
      if(key!=="description"){
        var row = table.insertRow(0)
        row.className="row"
        var cell1 = row.insertCell(0)
        cell1.className ="keyEntry"
        var cell2 = row.insertCell(1)
        cell2.className ="valueEntry"
        var input = document.createElement("INPUT");
        input.addEventListener("focusout",function(e){
          that.config[e.target.parentNode.previousElementSibling.innerHTML]=e.target.value
        })
        input.className ="valueInput"
        input.value=that.config[key]
        cell1.innerHTML= key
        cell2.appendChild(input)
      }
    }
    currentlyShownConfig.previousElementSibling.previousElementSibling.childNodes[0].textContent="Save changes"
    currentlyShownConfig.previousElementSibling.previousElementSibling.childNodes[1].className="chevron fa fa-chevron-up"
    currentlyShownConfig.nextElementSibling.className=currentlyShownConfig.nextElementSibling.className.replace("hide","")
    currentlyShownConfig.nextElementSibling.addEventListener('click',function(e){
      that.createConfigField(table)
    })
  }
  
  saveConfig(url,triggerId,actionId){
    console.log(this.config)
    var that =this
    $.ajax({
        url: endpoint+url,
        type: 'POST',
        data:JSON.stringify({
          user:name,
          triggerId:triggerId,
          config:that.config,
          actionId:actionId
        }),
        success: function(res){lively.notify("Config change successfull")},   
        done: function(res){lively.notify("done")},
        error: function(res){console.log(res)}
    }); 
  }
  
  createConfigField(table){
    var row = table.insertRow(-1)
        row.className="row"
        var cell1 = row.insertCell(0)
        cell1.className ="keyEntry"
        var cell2 = row.insertCell(1)
        cell2.className ="valueEntry"
        var inputKey = document.createElement("INPUT");
        inputKey.placeholder="New Key..."
        var inputValue = document.createElement("INPUT");
        inputValue.placeholder="New Value..."
        var that=this
        inputKey.addEventListener("focusout",function(e){
          if(inputKey.value!=""){
           that.config[inputKey.value]=inputValue.value
          }
        })
        inputValue.addEventListener("focusout",function(e){
          if(inputKey.value!=""){
           that.config[inputKey.value]=inputValue.value
          }
        })
        inputKey.className ="newConfInput"
        inputValue.className ="newConfInput"
        cell1.appendChild(inputKey)
        cell2.appendChild(inputValue)
  }
  
  handleAjaxError(jqXHR, textStatus, errorThrown) {
    lively.notify("ajax error: " + JSON.stringify(errorThrown));
  }

  showCode(evt) {
    if(evt.target.dataset.type=="actions"){
      this.filename=evt.target.dataset.parent
    }else{
      this.filename=evt.target.dataset.id
    }
    this.file2beSaved=evt.target.dataset.id
    this.type = evt.target.dataset.type;
    var that = this;
    that.getTriggerLogs(that.filename)
    // this.loggingId = setInterval(function() {
    //   that.getTriggerLogs(that.filename);  
    // },2000)
    var endpoint = 'https://lively4-services.herokuapp.com/mount/' + that.type + "/" + evt.target.dataset.id;
    $.ajax({
      url: endpoint,
      type: 'GET',
      success: function(res){that.codeEditor.setValue(res), that.codeEditor.doSave=function(){}},   
      done: function(res){that.codeEditor.setValue(res.responseText)},
      error: function(res){that.codeEditor.setValue(res.responseText)}
    }); 
  }
  
  saveCode() {
    var that = this;
    console.log(endpoint + 'mount/' + that.type + '/' + that.file2beSaved)
    $.ajax({
      url: endpoint + 'mount/' + that.type + '/' + that.file2beSaved,
      type: 'PUT',
      data: JSON.stringify({data:that.codeEditor.getValue(),user:name}),
      success: function(){lively.notify("File saved on Heroku", undefined, undefined, undefined, "green")},
      error: function(res){console.log(res)}
    }); 
  }
  
  unassignAction(triggerName, actionName) {
    lively.warn("TODO: unassign " + actionName + "for trigger" + triggerName + " and user " + name);
  }
  
  assignAction(triggerName) {
    var that = this;
    lively.openComponentInWindow('lively-cloudscripting-file-browser').then(browser => {
      browser.path = endpoint + 'mount/actions/';
      browser.urlExtension="getActionDescription"
      lively.setGlobalPosition(browser.parentElement, lively.getGlobalPosition(this.parentElement).addPt(pt(30,30)))
      browser.setMainAction((url) => {
        that.assignActionUrl(url, triggerName, that);
        browser.parentElement.onCloseButtonClicked();
      });
    });
  }
  
  assignActionUrl(url, triggerName, that) {
    url = url.toString();
    url = url.substring(url.lastIndexOf('/') + 1);
    $.ajax({
      url: endpoint + 'assignAction',
      type: 'POST',
      data: JSON.stringify({
        triggerId: triggerName,
        actionId: url,
        user: name
      }),
      success: that.getTriggers.bind(that),
      error: this.handleAjaxError.bind(this)
    })
  }
  
}