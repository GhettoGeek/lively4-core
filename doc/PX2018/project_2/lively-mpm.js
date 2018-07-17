"enable aexpr";

import Morph from'src/components/widgets/lively-morph.js';
import VibratingPoint from 'doc/PX2018/project_2/vibratingpoint.js';
import ElasticBodies from 'doc/PX2018/project_2/elasticbodies.js';
import Matrix from 'doc/PX2018/project_2/matrix.js';

export default class LivelyMpm extends Morph {
  async initialize() {
    this.algorithms = { "Elastic Bodies": ElasticBodies };
    this.windowTitle = "Lively Material Point Method Demo";
    this.registerButtons();
    this.time = 1;

    lively.html.registerKeys(this); // automatically installs handler for some methods
    
    lively.addEventListener("template", this, "dblclick", 
      evt => this.onDblClick(evt));
    
    this.variables = {};
    this.particleSize = 4;
    
    this.canvas = this.get("#mpm");
    
    this.context = this.canvas.getContext("2d");
    this.context.fillStyle = "rgba(" + 255 + "," + 0 + "," + 0 + "," + 1 + ")";
    
    this.opacityInput = this.get("#opacity");
    this.speedInput = this.get("#speed");
    let opacityUpdate = function() {      
      let numbers = this.get("#numbers");
      numbers.style.opacity = this.opacityInput.value;
    }
    let speedUpdate = function() {
      this.speed = this.speedInput.value;
    }
    $(this.opacityInput).on("input change", opacityUpdate.bind(this));
    $(this.speedInput).on("input change", speedUpdate.bind(this));
    
    this.animation = new ElasticBodies();
    
    if (this.animation.showElements) {
      let numbers = this.get("#numbers");
      for (let i = 0; i < this.animation.numElements; ++i) {
        let number = <div class="number"><span>{i}</span></div>;
        number.style.width = this.animation.elementSize[0] + "px";
        number.style.height = this.animation.elementSize[1] + "px";
        numbers.appendChild(number);
      }
      
      let canvasRect = this.canvas.getBoundingClientRect();
      numbers.style.top = (this.canvas.offsetTop + 1) + "px";
      numbers.style.left = (this.canvas.offsetLeft + 1) + "px";
    }
    
    await this.animation.init();
    this.draw(this.animation.particles);
  }
  
  draw(particles) {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let log = this.get("#log");
    let table = null;
    if (!log.classList.contains('hidden')) {
      log.innerHTML = '';
      table = <table><tr><th>x</th><th>y</th></tr></table>;
    }
    for (let i = 0; i < particles.length; ++i) {
      let posX = particles[i].get(0);
      let posY = particles[i].get(1);
      this.context.fillRect(posX, posY, this.particleSize, this.particleSize);
      
      if (!table) continue;
     
      let row = <tr></tr>
      row.appendChild(<td width="100">{Math.round(particles[i].get(0) * 100) / 100}</td>);
      row.appendChild(<td width="100">{Math.round(particles[i].get(1) * 100) / 100}</td>);
      table.appendChild(row);
      log.appendChild(table);
    }
  }
  
  set explanation(value) {
    if (!Array.isArray(value)) {
      console.log('Given object is not of type Array');
      return;
    }
    
    let explanation = this.get('#explanation');
    for (let item of value) {
      let element = <li></li>;
      element.innerHTML = item;
      explanation.appendChild(element);
    }
  }
  
  // this method is autmatically registered through the ``registerKeys`` method
  onKeyDown(evt) {
    
  }
  
  onToggleAnimation() {
    if (!this.animation) return;
    
    if (this.animation.running) {
      this.animation.stopAnimating();
      this.get("#toggleAnimation").innerHTML = "Start Animation";
    } else {
      // Start animating
      this.animation.startAnimating(this);
      this.get("#toggleAnimation").innerHTML = "Stop Animation";
    }
  }
  
  onStep() {
    if (!this.animation) return;
    this.animation.step(this);
  }
  
  onToggleGrid() {
    if (!this.animation.showElements) return;
    
    let numbers = this.get("#numbers");
    numbers.classList.toggle("hidden");
  }
  
  onReset(oneDisk = false) {
    if (this.animation.running) return;
    
    this.animation = new ElasticBodies(oneDisk);
    
    if (this.speed != undefined) {
      this.animation.speed = this.speed;
    }
    
    this.animation.init().then(() => this.draw(this.animation.particles));
  }
  
  onToggleLog() {
    let log = this.get("#log");
    log.classList.toggle("hidden");
  }

  /* Lively-specific API */

  livelyPreMigrate() {
    
  }
  
  livelyMigrate(other) {
    
  }
  
  livelyInspect(contentNode, inspector) {
    
  }
  
  livelyPrepareSave() {
    
  }
  
  
  async livelyExample() {
    // Add mpm data here later
  }
}

lively.components.addTemplatePath(lively4url + "/doc/PX2018/project_2/")
lively.components.resetTemplatePathCache()