"enable aexpr";

import Morph from 'src/components/widgets/lively-morph.js';
import d3 from 'src/external/d3.v5.js';

export default class D3Example extends Morph {  
  constructor() {
    super();
    this.initialize();
  }
  
  async initialize() {
    this.windowTitle = "D3Example";
    this._svg = d3.select(lively.query(this, "#svgContainer"));
  }
  
  get svg() {
    return this._svg;
  }
  
  async livelyExample() {
    //this.svg.exit().remove();
    /*
    this.svg.append("circle")
      .attr("cx", 100)
      .attr("cy", 100)
      .attr("r", 100)
      .attr("fill", "red");
    */
    
    const node = this.svg.selectAll(".node")
      .data([{hash: "0xffffff"}])
      .enter()
      .append("g");
    
    node.append("circle").attr("class", "node").attr("cx", "100").attr("cy", "100");
  }
}