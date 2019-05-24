import 'lang';

import { BaseActiveExpression } from 'active-expression';


import Stack from 'src/client/reactive/utils/stack.js';
import CompositeKey from './composite-key.js';
import InjectiveMap from './injective-map.js';
import BidirectionalMultiMap from './bidirectional-multi-map.js';

import { using, isFunction } from 'utils';

let expressionAnalysisMode = false;
window.__expressionAnalysisMode__ = false;

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
  
  static recalculateDependencies(aexpr) {
    // #TODO: compute diff of Dependencies
    DependencyManager.disconnectAllFor(aexpr);
    this.check(aexpr);
  }
  
  static check(aexpr) {
    using([analysisModeManager], () => {
      // Do the function execution in ExpressionAnalysisMode
      aexprStack.withElement(aexpr, () => aexpr.getCurrentValue());
    });
  }

}

class Dependency {
  static getOrCreateFor(context, identifier, type) {
    const key = ContextAndIdentifierCompositeKey.for(context, identifier);
    return CompositeKeyToDependencies.getOrCreateRightFor(key, () => new Dependency(type));
  }
  
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
    const value = context !== undefined ? context[identifier] : undefined;

    // always employ the source code hook
    HooksToDependencies.associate(SourceCodeHook.getOrCreateFor(context, identifier), this);

    // 
    var dataStructure;
    if (this.type === 'member') {
      dataStructure = context;
    } else if(this.type === 'local') {
      dataStructure = value;
    }
    if (dataStructure instanceof Array || dataStructure instanceof Set || dataStructure instanceof Map) {
      const dataHook = DataStructureHookByDataStructure.getOrCreate(dataStructure, dataStructure => DataStructureHook.forStructure(dataStructure));
      HooksToDependencies.associate(dataHook, this);
    }
  }
  untrack() {
    this.isTracked = false;
    HooksToDependencies.disconnectAllForDependency(this);
  }
  getContextAndIdentifier() {
    const compKey = CompositeKeyToDependencies.getLeftFor(this);
    const [context, identifier] = ContextAndIdentifierCompositeKey.keysFor(compKey);
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
    const compKey = CompositeKeyToDependencies.getLeftFor(this);
    if (!compKey) {
      return false;
    }
    const [object] = ContextAndIdentifierCompositeKey.keysFor(compKey);
    return object === self;
  }

  getAsDependencyDescription() {
    const [context, identifier] = this.getContextAndIdentifier();
    
    if (this.isMemberDependency()) {
      return {
        object: context,
        property: identifier,
        value: context !== undefined ? context[identifier] : undefined
      };
    } else if (this.isGlobalDependency()) {
      return {
        name: identifier,
        value: context[identifier]
      };
    } else if (this.isLocalDependency()) {
      return {
        scope: context,
        name: identifier,
        value: context !== undefined ? context[identifier] : undefined
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

// 1. (obj, prop) or (scope, name) -> ContextAndIdentifierCompositeKey
// - given via ContextAndIdentifierCompositeKey
const ContextAndIdentifierCompositeKey = new CompositeKey();

// 2.1. ContextAndIdentifierCompositeKey 1<->1 Dependency
// - CompositeKeyToDependencies
const CompositeKeyToDependencies = new InjectiveMap();
// 2.2. Dependency *<->* AExpr
// - DependenciesToAExprs

/** Source Code Hooks */
// 3.1. ContextAndIdentifierCompositeKey 1<->1 SourceCodeHook
// - CompositeKeyToSourceCodeHook
const CompositeKeyToSourceCodeHook = new InjectiveMap();
// 3.2. SourceCodeHook *<->* Dependency
// - HooksToDependencies

/** Data Structure Hooks */
// 4.1 DataStructureHookByDataStructure
const DataStructureHookByDataStructure = new WeakMap(); // WeakMap<(Set/Array/Map), DataStructureHook>

class Hook {
  constructor() {
    this.installed = false;
  }
  
  notifyDependencies() {
    HooksToDependencies.getDepsForHook(this).forEach(dep => dep.notifyAExprs())
  }
}

class SourceCodeHook extends Hook {
  static getOrCreateFor(context, identifier) {
    const compKey = ContextAndIdentifierCompositeKey.for(context, identifier);
    return CompositeKeyToSourceCodeHook.getOrCreateRightFor(compKey, key => new SourceCodeHook());
  }
  
  constructor(context, identifier) {
    super();

    this.context = context;
    this.identifier = identifier;
  }
  
  install() {}
  uninstall() {}
}

class DataStructureHook extends Hook {
  static forStructure(dataStructure) {
    const hook = new DataStructureHook();
    
    function getPrototypeDescriptors(obj) {
      const proto = obj.constructor.prototype;

      const descriptors = Object.getOwnPropertyDescriptors(proto);
      return Object.entries(descriptors).map(([key, desc]) => (desc.key = key, desc))
    }

    function wrapProperty(obj, descriptor, after) {
      Object.defineProperty(obj, descriptor.key, Object.assign({}, descriptor, {
        value(...args) {
          try {
            return descriptor.value.apply(this, args);
          } finally {
            after.call(this, ...args)
          }
        }
      }));
    }

    function monitorProperties(obj) {
      const prototypeDescriptors = getPrototypeDescriptors(obj);
      Object.entries(Object.getOwnPropertyDescriptors(obj)); // unused -> need for array

      prototypeDescriptors
        .filter(descriptor => descriptor.key !== 'constructor') // the property constructor needs to be a constructor if called (as in cloneDeep in lodash); We leave it out explicitly as the constructor does not change any state #TODO
        .forEach(addDescriptor => {
          // var addDescriptor = prototypeDescriptors.find(d => d.key === 'add')
          if (addDescriptor.value) {
            if (isFunction(addDescriptor.value)) {
              wrapProperty(obj, addDescriptor, function() {
                // #HACK #TODO we need an `withoutLayer` equivalent here
                if (window.__compareAExprResults__) { return; }

                this; // references the modified container
                hook.notifyDependencies();
              });
            } else {
              console.warn(`Property ${addDescriptor.key} has a value that is not a function, but ${addDescriptor.value}.`)
            }
          } else {
            console.warn(`Property ${addDescriptor.key} has no value.`)
          }
        });
    }

    monitorProperties(dataStructure);
    
    // set.add = function add(...args) {
    //   const result = Set.prototype.add.call(this, ...args);
    //   hook.notifyDependencies();
    //   return result;
    // }
    return hook;
  }
}

const aexprStack = new Stack();

export class RewritingActiveExpression extends BaseActiveExpression {
  constructor(func, ...args) {
    super(func, ...args);
    this.meta({ strategy: 'Rewriting' });
    ExpressionAnalysis.recalculateDependencies(this);

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
  
  sharedDependenciesWith(otherAExpr) {
    const ownDependencies = this.dependencies().all();
    const otherDependencies = otherAExpr.dependencies().all();
    const [own, shared, other] = ownDependencies.computeDiff(otherDependencies);
    return shared;
  }
}

class DependencyAPI {
  constructor(aexpr) {
    this._aexpr = aexpr;
  }
  
  getDependencies() {
    return DependenciesToAExprs.getDepsForAExpr(this._aexpr);
  }

  all() {
    return Array.from(this.getDependencies())
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
      ExpressionAnalysis.recalculateDependencies(aexpr);
    });
    aexprs.forEach(aexpr => aexpr.checkAndNotify());
  }

  /**
   * **************************************************************
   * ********************** associate *****************************
   * **************************************************************
   */
  static associateMember(obj, prop) {
    const dependency = Dependency.getOrCreateFor(obj, prop, 'member');
    DependenciesToAExprs.associate(dependency, this.currentAExpr);
  }

  static associateGlobal(globalName) {
    const dependency = Dependency.getOrCreateFor(globalRef, globalName, 'member');
    DependenciesToAExprs.associate(dependency, this.currentAExpr);
  }

  static associateLocal(scope, varName) {
    const dependency = Dependency.getOrCreateFor(scope, varName, 'local');
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
  ContextAndIdentifierCompositeKey.clear();

  CompositeKeyToDependencies.clear();
  DependenciesToAExprs.clear();

  CompositeKeyToSourceCodeHook.clear();
  HooksToDependencies.clear();
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
