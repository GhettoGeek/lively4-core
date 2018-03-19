import lively from 'src/client/lively.js'
import * as nodes from 'src/client/morphic/node-helpers.js';
import * as events from 'src/client/morphic/event-helpers.js';
import {pt} from 'src/client/graphics.js'
import HaloItem from 'src/components/halo/lively-halo-item.js';
import Preferences from 'src/client/preferences.js'; 
import Snapping from "src/client/morphic/snapping.js"
import {Grid} from 'src/client/morphic/snapping.js';
import VivideView from 'src/client/vivide/components/vivide-view.js';
import svg from "src/client/svg.js"

export default class HaloVivideOutportConnectionItem extends HaloItem {

  get path() { return this.get('#path-to-target'); }
  get overlay() { return this.get('#overlay-target'); }

  setTarget(target) {
    this._target = target;
  }

  updateTarget(view) {
    this._view = view;
    if(!this._target) {
      this.classList.add('broken');
      return;
    }

    let offset = lively.getGlobalPosition(this.get('svg'));
    let startPoint = lively.getGlobalBounds(this).rightCenter().subPt(offset);
    let startOffsetPoint = startPoint.addPt(pt(20, 0));
    let targetCenterPoint = lively.getGlobalCenter(this._target).subPt(offset);

    svg.setPathVertices(this.path, [
      { c: 'M', x1: startPoint.x, y1: startPoint.y},
      { c: 'L', x1: startOffsetPoint.x, y1: startOffsetPoint.y},
      { c: 'L', x1: startOffsetPoint.x, y1: targetCenterPoint.y},
      { c: 'L', x1: targetCenterPoint.x, y1: targetCenterPoint.y},
    ]);

    lively.setGlobalPosition(this.overlay, lively.getGlobalPosition(this._target));
    lively.setExtent(this.overlay, lively.getGlobalBounds(this._target).extent());
  }
  
  onClick(evt) {
    if(this._view && this._target) {
      this._view.removeConnectionTo(this._target);
      HaloService.showHalos(window.that);
    }
  }
}
