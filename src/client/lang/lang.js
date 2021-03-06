import { extend } from './utils.js';
import * as _ from 'src/external/lodash/lodash.js';

// ensure global variable 'that'
self.that = self.that;

function extendFromLodash(obj, propNames) {
  function genFunc(name) {
    const args = _[name].toString().split(/\r?\n/)[0].replace(/.*\((.*)\).*/,"$1").split(/, /)
    args.shift();
    const argsString = args.join(', ');
    
    return new Function('_', `return {
  ${name}(${argsString}) {
    return _.${name}(this, ${argsString});
  }
};`)(_);
  }

  const definitionParts = propNames.map(propName => genFunc(propName));
  const definition = Object.assign({}, ...definitionParts);

  return extend(obj, definition);
}


function pairComparator(pair1, pair2) {
  return pair1.first === pair2.first && pair1.second === pair2.second;
}

/**
 * utility function used to compute turn Objects and
 */
function pairsDiff(obj1, obj2) {
  const pairs1 = obj1.toPairs();
  const pairs2 = obj2.toPairs();

  const onlyLeft = _.differenceWith(pairs1, pairs2, pairComparator);
  const both = _.intersectionWith(pairs1, pairs2, pairComparator);
  const onlyRight = _.differenceWith(pairs2, pairs1, pairComparator);

  return [onlyLeft, both, onlyRight];
}

/*MD
## OBJECT
MD*/
extendFromLodash(Object.prototype, [
  'clone',
  'cloneDeep',
  'omit',
  'pick',
  'toPairs'
]);

extend(Object.prototype, {
  deepProperty(paths) {
    if (Array.isArray(paths)) {
      return _.at(this, paths);
    } else {
      return _.get(this, paths);
    }
  },
  
  /**
   * Computes a more fine-grained difference with a second Object (@link(other)).
   * @param other (Object/Map) the Object to be compared to.
   * @returns {Array} [onlyLeft, both, onlyRight] the three Objects corresponding to the respective side of comparison.
   */
  computeDiff(other) {
    return pairsDiff(this, other).map(arr => _.fromPairs(arr));
  }

});

/*MD
## FUNCTION
MD*/
extendFromLodash(Function.prototype, [
  'debounce',
  'defer',
  /**
   * @example <caption>Simple Memoization.</caption>
   * // only consider second argument as key for memoization
   * var sum = ((x, y) => x + y).memoize((x, y) => y);
   * sum(1, 2);
   * // => 3
   * sum(2, 2);
   * // => 3, same second argument
   * sum(1, 3);
   * // => 4, different second argument
   */
  'memoize',
  'once',
  'throttle'
]);

extend(Function.prototype, {

  delay(wait, ...args) {
    return _.delay(this, wait, args);
  }

});

extend(Function, {

  noop() { return void 0; },
  identity(value) { return value; }

});


/*MD
## GENERATOR
MD*/

const generatorPrototype = (function*() {}).prototype.constructor;

extend(generatorPrototype, {

  toArray(...args) {
    const result = [];

    for (let item of this(...args)) {
      result.push(item)
    }

    return result;
  }

});


// #TODO: only written in this weird manner due to tooling not supporting async generators (parse error) #Tooling #Tools
const asyncGeneratorPrototype = (new Function(`return async function*() {};`))().prototype.constructor;

extend(asyncGeneratorPrototype, new Function(`return {

  async toArray(...args) {
    const result = [];

    for await (let item of this(...args)) {
      result.push(item)
    }

    return result;
  }

};`)());


/*MD
## DATE
MD*/
extend(Date.prototype, {
  
  dayInWeek(offset) {
    let day = this.getDay()
    if (day === 0) { day = 7; } // sunday is the end of the week
    
    const d = this.getDate();

    const resultDay = new Date(this);
    resultDay.setDate(d-day + offset);

    return resultDay;
  },

  mondayInWeek(){ return this.dayInWeek(1); },
  tuesdayInWeek(){ return this.dayInWeek(2); },
  wednesdayInWeek(){ return this.dayInWeek(3); },
  thursdayInWeek(){ return this.dayInWeek(4); },
  fridayInWeek(){ return this.dayInWeek(5); },
  saturdayInWeek(){ return this.dayInWeek(6); },
  sundayInWeek(){ return this.dayInWeek(7); },

  toFormattedString(format){
    function toStringWithTrailingZero(number) {
      return (number < 10 ? "0" : "") + number;
    }

    const yyyy = this.getFullYear();
    const yy = yyyy.toString().substr(-2);
    const MM = toStringWithTrailingZero(this.getMonth() + 1);
    const dd = toStringWithTrailingZero(this.getDate());
    const hh = toStringWithTrailingZero(this.getHours());
    const mm = toStringWithTrailingZero(this.getMinutes());
    const ss = toStringWithTrailingZero(this.getSeconds());
    
    return format
      .replace(/yyyy/g, yyyy)
      .replace(/yy/g, yy)
      .replace(/MM/g, MM)
      .replace(/dd/g, dd)
      .replace(/hh/g, hh)
      .replace(/mm/g, mm)
      .replace(/ss/g, ss);
  }
  
});


/*MD
## SET
MD*/
extend(Set.prototype, {

  /**
   * Computes a more fine-grained difference with a second Set (@link(other)).
   * @param other (Set) the Set to be compared to.
   * @returns {Array} [onlyLeft, both, onlyRight] the three Sets corresponding to the respective side of comparison.
   */
  computeDiff(other) {
    const arrs = Array.from(this).computeDiff(other);
    return arrs.map(arr => new Set(arr));
  },

});


/*MD
## MAP/WEAKMAP
MD*/
const mapExtensions = {
  
  /**
   * Tries to get the value stored for the @link(key).
   * If this fails, generate a new value using the povided callback.
   *
   * @public
   * @param key (*) the key to get the value
   * @param createCallback (Function) if no value for @link(key) is available, gets the @link(key) to create a value
   * @returns {*} the value stored for the key
   */
  getOrCreate(key, createCallback) {
    if (!this.has(key)) {
      this.set(key, createCallback(key));
    }

    return this.get(key);
  }
  
};

extend(Map.prototype, mapExtensions);
extend(WeakMap.prototype, mapExtensions);

extend(Map.prototype, {

  /**
   * Computes a more fine-grained difference with a second Map (@link(other)).
   * @param other (Object/Map) the Set to be compared to.
   * @returns {Array} [onlyLeft, both, onlyRight] the three Maps corresponding to the respective side of comparison.
   */
  computeDiff(other) {
    return pairsDiff(this, other).map(arr => new Map(arr));
  },

});


/*MD
## ARRAY
MD*/
extendFromLodash(Array.prototype, [
  'sortBy',
  'difference',
  'groupBy',
  'max',
  'min',
  'sample',
  'sampleSize',
  'shuffle',
  'sum'
]);

extend(Array.prototype, {

  average() {
    if (this.length === 0) {
      return NaN;
    } else {
      return this.sum() / this.length;
    }
  },

  get first() { return this[0]; },
  set first(value) { return this[0] = value; },

  get second() { return this[1]; },
  set second(value) { return this[1] = value; },

  get last() { return this[this.length - 1]; },
  set last(value) { return this[this.length - 1] = value; },

  intersect(...arrays) {
    return _.intersection(this, ...arrays);
  },

  /**
   * Computes a more fine-grained difference with a second Array.
   * @param other (Array/Set) the Array to be compared to.
   * @returns {Array} [onlyLeft, both, onlyRight].
   */
  computeDiff(other) {
    const otherArray = Array.from(other);
    
    const onlyLeft = _.difference(this, otherArray);
    const both = _.intersection(this, otherArray);
    const onlyRight = _.difference(otherArray, this);

    return [onlyLeft, both, onlyRight];
  },

  /**
   * Removes all elements from array (mutates!) that predicate returns truthy for and returns an array of the removed elements.
   * @param predicate (Function<value, index, array -> Boolean>) return true to remove given element.
   * @returns {Array} The removed elements.
   */
  removeAll(predicate) {
    return _.remove(this, predicate);
  },

  zip(...arrays) {
    return _.zip(this, ...arrays);
  },
  
  /**
   * A generator yielding all items in this array. For propagating.
   * @example <caption>Propagating yield* statements to items.</caption>
   * function* example(arr) {
   *   yield* arr.yieldAll();
   * }
   *
   * for (let item of example([1,2,3])) {
   *   lively.notify(item);
   * }
   */
  *yieldAll() {
    for (let item of this) {
      yield item;
    }
  },

  /**
   *
   */
  joinElements(builder) {
    const result = [];
    let lastItem;
    for (let item of this) {
      // not the first item
      if (result.length > 0) {
        result.push(builder(lastItem, item));
      }
      result.push(item);
      lastItem = item;
    }
    return result;
  }

});


/*MD # Array-like MD*/
extendFromLodash(NodeList.prototype, [
  'map',
  'filter',
  'reduce',
  'find'
]);

/*MD
## NUMBER
MD*/
extendFromLodash(Number.prototype, [
  'ceil',
  'clamp',
  'floor',
  'inRange',
  'round',
  'times'
]);

extend(Number.prototype, {
  
  to(end, step) {
    return _.range(this, end, step);
  }

});


/*MD
## STRING
MD*/
extendFromLodash(String.prototype, [
  'camelCase',
  'capitalize',
  'kebabCase',
  'lowerCase',
  'lowerFirst',
  'snakeCase',
  'startCase',
  'toLower',
  'toUpper',
  'trim',
  'trimEnd',
  'trimStart',
  'upperCase',
  'upperFirst',
  'words',
]);

extend(String.prototype, {

  /**
   * 
   * @public
   * @param options (*) the optional options object containing any custom settings that you want to apply to the request
   * @returns {Promise<String>} the remote resource as String
   * 
   * @example <caption>Get lively start.html.</caption>
   * (lively4url + "/start.html").fetchText();
   */
  fetchText(options) {
    return fetch(this, options).then(r => r.text());
  },

  /**
   * 
   * @public
   * @param options (*) the optional options object containing any custom settings that you want to apply to the request
   * @returns {Promise<JSON>} the remote resource as JSON
   * 
   * @example <caption>Get d3 flare.json.</caption>
   * (lively4url + "/src/components/demo/flare.json").fetchJSON();
   */
  fetchJSON(options) {
    return fetch(this, options).then(r => r.json());
  },
  
  /**
   * Get file info for a remote file or directory.
   * @example <caption>Get file info of start.html.</caption>
   * const startHTML = lively4url + '/start.html';
   * startHTML.fetchStats();
   */
  fetchStats(options) {
    return this.fetchJSON(Object.assign({ method: 'OPTIONS' }, options));
  }

});


/*MD
## PROMISE
MD*/
extend(Promise.prototype, {

  /**
   * Awaits the promise, and return a promise after calling func.
   * @example <caption>Example usage on Promises.</caption>
   * fetch("https://lively-kernel.org/lively4/lively4-core/start.html")
   *   .through(lively.notify) // prints the response object
   *   .then(t=>t.text())
   *   .through(lively.notify); // prints the content
   */
  through(func, ...args) {
    return this.then(val => (func(val, ...args), val));
  }

});


/*MD
## URL
MD*/
extend(URL.prototype, {

  // hook for rendering the internals of an object in the inspector
  livelyInspect(contentNode, inspector) {
    contentNode.innerHTML = ""
    var entries = lively.allKeys(this);
    for(let key of entries) {
      const node = inspector.display(this[key], true, key)
      if (node) contentNode.appendChild(node);   
    }
  }

});
