import 'lang';

import { BaseActiveExpression } from 'active-expression';

import Stack from 'src/client/reactive/utils/stack.js';
import CompositeKey from './composite-key.js';
import InjectiveMap from './injective-map.js';
import BidirectionalMultiMap from './bidirectional-multi-map.js';

import { using } from 'utils';

let expressionAnalysisMode = false;
window.__expressionAnalysisMode__ = true;

const analysisModeManager = {
  __enter__() {
    expressionAnalysisMode = true;
    window.__expressionAnalysisMode__ = expressionAnalysisMode;
  },
  __exit__() {
    expressionAnalysisMode = !!aexprStack.top();
    window.__expressionAnalysisMode__ = expressionAnalysisMode;
  }
}
class ExpressionAnalysis {
  // Do the function execution in ExpressionAnalysisMode
  static check(aexpr) {
    using([analysisModeManager], () => {
      aexprStack.withElement(aexpr, () => aexpr.getCurrentValue());
    });
  }
}

class Dependency {
  constructor(type) {
    this.type = type;
    
    this.isTracked = false;
  }
  
  updateTracking() {
    if (this.isTracked === DependenciesToAExprs.hasAExprsForDep(this)) { return; }
    if (this.isTracked) {
      this.untrack();
    } else {
      this.track();
    }
  }
  track() {
    this.isTracked = true;

    const [context, identifier] = this.getContextAndIdentifier();
    HooksToDependencies.associate(SourceCodeHook.getOrCreateFor(context, identifier), this);
  }
  untrack() {
    this.isTracked = false;

    const [context, identifier] = this.getContextAndIdentifier();
    HooksToDependencies.remove(SourceCodeHook.getOrCreateFor(context, identifier), this);
  }
  getContextAndIdentifier() {
    let compKey;
    if (this.isMemberDependency()) {
      compKey = membersToDependencies.getLeftFor(this);
    } else if (this.isGlobalDependency()) {
      compKey = membersToDependencies.getLeftFor(this);
    } else if (this.isLocalDependency()) {
      compKey = localsToDependencies.getLeftFor(this);
    } else {
      throw new Error('Dependency is neighter local, member, nor global.');
    }
    const [context, identifier] = dependencyCompositeKey.keysFor(compKey);
    return [context, identifier];
  }

  notifyAExprs() {
    const aexprs = DependenciesToAExprs.getAExprsForDep(this);
    DependencyManager.checkAndNotifyAExprs(aexprs);
  }
  
  isMemberDependency() {
    return this.type === 'member' && !this.isGlobal();
  }
  isGlobalDependency() {
    return this.type === 'member' && this.isGlobal();
  }
  isLocalDependency() {
    return this.type === 'local';
  }
  isGlobal() {
    const compKey = membersToDependencies.getLeftFor(this);
    if (!compKey) {
      return false;
    }
    const [object] = dependencyCompositeKey.keysFor(compKey);
    return object === self;
  }

  getAsDependencyDescription() {
    if (this.isMemberDependency()) {
      const compKey = membersToDependencies.getLeftFor(this);
      const [object, property] = dependencyCompositeKey.keysFor(compKey);
      return {
        object,
        property,
        value: object !== undefined ? object[property] : undefined
      };
    } else if (this.isGlobalDependency()) {
      const compKey = membersToDependencies.getLeftFor(this);
      const [object, name] = dependencyCompositeKey.keysFor(compKey);
      return {
        name,
        value: object[name]
      };
    } else if (this.isLocalDependency()) {
      const compKey = localsToDependencies.getLeftFor(this);
      const [scope, name] = dependencyCompositeKey.keysFor(compKey);
      return {
        scope,
        name,
        value: scope !== undefined ? scope[name] : undefined
      };
    } else {
      throw new Error('Dependency is neighter local, member, nor global.');
    }
  }
}

const DependenciesToAExprs = {
  _depsToAExprs: new BidirectionalMultiMap(),

  associate(dep, aexpr) {
    this._depsToAExprs.associate(dep, aexpr);
    dep.updateTracking();
  },

  disconnectAllForAExpr(aexpr) {
    const deps = this.getDepsForAExpr(aexpr);
    this._depsToAExprs.removeAllLeftFor(aexpr);
    deps.forEach(dep => dep.updateTracking());
  },

  getAExprsForDep(dep) {
    return Array.from(this._depsToAExprs.getRightsFor(dep));
  },
  getDepsForAExpr(aexpr) {
    return Array.from(this._depsToAExprs.getLeftsFor(aexpr));
  },

  hasAExprsForDep(dep) {
    return this.getAExprsForDep(dep).length >= 1;
  },
  hasDepsForAExpr(aexpr) {
    return this.getDepsForAExpr(aexpr).length >= 1;
  },
  
  /*
   * Removes all associations.
   */
  clear() {
    this._depsToAExprs.clear();
    this._depsToAExprs.getAllLeft()
      .forEach(dep => dep.updateTracking());
  }
};

const HooksToDependencies = {
  _hooksToDeps: new BidirectionalMultiMap(),
  
  associate(hook, dep) {
    this._hooksToDeps.associate(hook, dep);
  },
  remove(hook, dep) {
    this._hooksToDeps.remove(hook, dep);
  },
  
  disconnectAllForDependency(dep) {
    this._hooksToDeps.removeAllLeftFor(dep);
  },
  
  getDepsForHook(hook) {
    return Array.from(this._hooksToDeps.getRightsFor(hook));
  },
  getHooksForDep(dep) {
    return Array.from(this._hooksToDeps.getLeftsFor(dep));
  },
  
  hasDepsForHook(hook) {
    return this.getDepsForHook(hook).length >= 1;
  },
  hasHooksForDep(dep) {
    return this.getHooksForDep(dep).length >= 1;
  },
  
  /*
   * Removes all associations.
   */
  clear() {
    this._hooksToDeps.clear();
  }
};

// 1.1. (obj, prop) -> dependencyCompositeKey
// - given via dependencyCompositeKey
const dependencyCompositeKey = new CompositeKey();
// 1.2. dependencyCompositeKey 1<->1 Dependency
// - membersToDependencies, localsToDependencies
const membersToDependencies = new InjectiveMap();
const localsToDependencies = new InjectiveMap();
// 1.3. Dependency *<->* AExpr
// - DependenciesToAExprs

// 2.1. (obj, prop) -> sourceCodeHookCompositeKey
// - given via sourceCodeHookCompositeKey
const sourceCodeHookCompositeKey = new CompositeKey();
// 2.2. sourceCodeHookCompositeKey 1<->1 SourceCodeHook
// - compositeKeyToSourceCodeHook
const compositeKeyToSourceCodeHook = new InjectiveMap();
// 2.3. SourceCodeHook *<->* Dependency
// - HooksToDependencies

class Hook {
  constructor() {
    this.installed = false;
  }
}

class SourceCodeHook extends Hook {
  static getOrCreateFor(context, identifier) {
    const compKey = sourceCodeHookCompositeKey.for(context, identifier);
    return compositeKeyToSourceCodeHook.getOrCreateRightFor(compKey, key => new SourceCodeHook());
  }
  
  constructor(context, identifier) {
    super();

    this.context = context;
    this.identifier = identifier;
  }
  
  install() {}
  uninstall() {}
  
  notifyDependencies() {
    HooksToDependencies.getDepsForHook(this).forEach(dep => dep.notifyAExprs())
  }
}

class DataStructureHook extends Hook {}

const aexprStack = new Stack();

export class RewritingActiveExpression extends BaseActiveExpression {
  constructor(func, ...args) {
    super(func, ...args);
    this.meta({ strategy: 'Rewriting' });
    ExpressionAnalysis.check(this);

    if (new.target === RewritingActiveExpression) {
      this.addToRegistry();
    }
  }

  dispose() {
    super.dispose();
    DependencyManager.disconnectAllFor(this);
  }

  supportsDependencies() {
    return true;
  }

  dependencies() {
    return new DependencyAPI(this);
  }
}

class DependencyAPI {
  constructor(aexpr) {
    this._aexpr = aexpr;
  }
  
  getDependencies() {
    return DependenciesToAExprs.getDepsForAExpr(this._aexpr);
  }

  locals() {
    return this.getDependencies()
      .filter(dependency => dependency.isLocalDependency())
      .map(dependency => dependency.getAsDependencyDescription());
  }

  members() {
    return this.getDependencies()
      .filter(dependency => dependency.isMemberDependency())
      .map(dependency => dependency.getAsDependencyDescription());
  }

  globals() {
    return this.getDependencies()
      .filter(dependency => dependency.isGlobalDependency())
      .map(dependency => dependency.getAsDependencyDescription());
  }
}

export function aexpr(func, ...args) {
  return new RewritingActiveExpression(func, ...args);
}

const globalRef = typeof window !== "undefined" ? window : // browser tab
  (typeof self !== "undefined" ? self : // web worker
    global); // node.js

class DependencyManager {
  static get currentAExpr() {
    return aexprStack.top();
  }

  static disconnectAllFor(aexpr) {
    DependenciesToAExprs.disconnectAllForAExpr(aexpr);
  }

  // #TODO, #REFACTOR: extract into configurable dispatcher class
  static checkAndNotifyAExprs(aexprs) {
    aexprs.forEach(aexpr => {
      // #TODO: compute diff of Dependencies
      this.disconnectAllFor(aexpr);
      ExpressionAnalysis.check(aexpr);
    });
    aexprs.forEach(aexpr => aexpr.checkAndNotify());
  }

  /**
   * **************************************************************
   * ********************** associate *****************************
   * **************************************************************
   */
  static associateMember(obj, prop) {
    const key = dependencyCompositeKey.for(obj, prop);
    const dependency = membersToDependencies.getOrCreateRightFor(key, () => new Dependency('member'));
    DependenciesToAExprs.associate(dependency, this.currentAExpr);
  }

  static associateGlobal(globalName) {
    this.associateMember(globalRef, globalName);
  }

  static associateLocal(scope, varName) {
    const key = dependencyCompositeKey.for(scope, varName);
    const dependency = localsToDependencies.getOrCreateRightFor(key, () => new Dependency('local'));
    DependenciesToAExprs.associate(dependency, this.currentAExpr);
  }

}

class TracingHandler {

  /**
   * **************************************************************
   * ********************** update ********************************
   * **************************************************************
   */
  static memberUpdated(obj, prop) {
    SourceCodeHook.getOrCreateFor(obj, prop).notifyDependencies();
  }

  static globalUpdated(globalName) {
    SourceCodeHook.getOrCreateFor(globalRef, globalName).notifyDependencies();
  }

  static localUpdated(scope, varName) {
    SourceCodeHook.getOrCreateFor(scope, varName).notifyDependencies();
  }

}

/*
 * Disconnects all associations between active expressions and object properties
 * As a result no currently enable active expression will be notified again,
 * effectively removing them from the system.
 *
 * #TODO: Caution, this might break with some semantics, if we still have references to an aexpr!
 */
export function reset() {
  DependenciesToAExprs.clear();
  dependencyCompositeKey.clear();
  sourceCodeHookCompositeKey.clear();
}

/**
 * (C)RUD for member attributes
 */
export function traceMember(obj, prop) {
  if (expressionAnalysisMode) {
    DependencyManager.associateMember(obj, prop);
  }
}

export function getMember(obj, prop) {
  if (expressionAnalysisMode) {
    DependencyManager.associateMember(obj, prop);
  }
  const result = obj[prop];
  return result;
}

export function getAndCallMember(obj, prop, args = []) {
  if (expressionAnalysisMode) {
    DependencyManager.associateMember(obj, prop);
  }
  const result = obj[prop](...args);
  return result;
}

export function setMember(obj, prop, val) {
  const result = obj[prop] = val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberAddition(obj, prop, val) {
  const result = obj[prop] += val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberSubtraction(obj, prop, val) {
  const result = obj[prop] -= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberMultiplication(obj, prop, val) {
  const result = obj[prop] *= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberDivision(obj, prop, val) {
  const result = obj[prop] /= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberRemainder(obj, prop, val) {
  const result = obj[prop] %= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberExponentiation(obj, prop, val) {
  const result = obj[prop] **= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberLeftShift(obj, prop, val) {
  const result = obj[prop] <<= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberRightShift(obj, prop, val) {
  const result = obj[prop] >>= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberUnsignedRightShift(obj, prop, val) {
  const result = obj[prop] >>>= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberBitwiseAND(obj, prop, val) {
  const result = obj[prop] &= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberBitwiseXOR(obj, prop, val) {
  const result = obj[prop] ^= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function setMemberBitwiseOR(obj, prop, val) {
  const result = obj[prop] |= val;
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function deleteMember(obj, prop) {
  const result = delete obj[prop];
  TracingHandler.memberUpdated(obj, prop);
  return result;
}

export function getLocal(scope, varName, value) {
  if (expressionAnalysisMode) {
    scope[varName] = value;
    DependencyManager.associateLocal(scope, varName);
  }
}

export function setLocal(scope, varName, value) {
  scope[varName] = value;
  TracingHandler.localUpdated(scope, varName);
}

export function getGlobal(globalName) {
  if (expressionAnalysisMode) {
    DependencyManager.associateGlobal(globalName);
  }
}

export function setGlobal(globalName) {
  TracingHandler.globalUpdated(globalName);
}

export default aexpr;
