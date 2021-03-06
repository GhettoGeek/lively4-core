import { uuid } from 'utils';
import * as workspaces from './workspaces.js';
import Preferences from "./preferences.js";

function rewriteSourceWithAsyncAwaitSupport(source) {
  return `(async secretAsyncLabel => {
  return { __asyncresult__: do {${source}}}
})()`;
}

export default async function boundEval(source, thisReference, targetModule) {
  try {
    if (!targetModule) targetModule = lively4url + "/"
    
    let codeId = uuid() + "/" ; // that way we can have a shared context for relative urls
    
    var targetPath = targetModule.replace(/https:\/\//,"")
    var path = 'workspace:' + encodeURI(codeId  + targetPath)  // "... and the resolve relative path morks

    
    // 'this' reference
    if (!self.__pluginDoitThisRefs__) {
      self.__pluginDoitThisRefs__ = {};
    } 
    self.__pluginDoitThisRefs__[codeId] = thisReference;
    
    
    if (!self.__topLevelVarRecorder_ModuleNames__) {
      self.__topLevelVarRecorder_ModuleNames__ = {};
    } 
    // console.log("boundEval register " + codeId + " -> " +targetModule)
    self.__topLevelVarRecorder_ModuleNames__[codeId] = targetModule;
    
    
    if (Preferences.get('UseAsyncWorkspace') && source.match(/await /) && !source.match(/import /)) {
      source = rewriteSourceWithAsyncAwaitSupport(source);
    }  
    if (Preferences.get('UseAsyncWorkspace')) {
      path = path.replace(/^workspace/, "workspaceasyncjs") /// does not work yet #TODO 
    } else if (Preferences.get('DisableAExpWorkspace')) {
      path = path.replace(/^workspace/, "workspacejs")
    }

    // source
    // TODO: we currently use a newly generated UUID on each evaluation to trick SystemJS into actually loading it (therefore, we use codeId):
    
    // console.log("setURL " + codeId + " -> " + targetModule)
    
    workspaces.setCode(path, source);
    
    
    return await System.import(path)
      .then(m => {
        lively.unloadModule(path)
        return ({value: m.__result__ })});
  } catch(err) {
    return Promise.resolve({ value: err, isError: true });
  } finally {
    // console.log("BOUND EVAL UNLOAD " + path)
    lively.unloadModule(path)
  }
}
