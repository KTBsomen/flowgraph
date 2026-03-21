/* CanvasManager — infinite pan/zoom canvas with touch support */
export class CanvasManager {
  constructor(container, opts={}) {
    this.container=container;
    this.options={minZoom:0.18,maxZoom:3,gridSize:20,showGrid:true,snapToGrid:true,...opts};
    this.transform={x:0,y:0,scale:1}; this._isPanning=false; this._panStart={x:0,y:0}; this._listeners={};
    this._build(); this._bindEvents();
  }
  _build() {
    Object.assign(this.container.style,{position:'relative',overflow:'hidden',userSelect:'none',touchAction:'none'});
    this.gridCanvas=document.createElement('canvas');
    Object.assign(this.gridCanvas.style,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:'0'});
    this.container.appendChild(this.gridCanvas);
    this.viewport=document.createElement('div');
    Object.assign(this.viewport.style,{position:'absolute',inset:'0',transformOrigin:'0 0'});
    this.container.appendChild(this.viewport);
    this.svgLayer=document.createElementNS('http://www.w3.org/2000/svg','svg');
    Object.assign(this.svgLayer.style,{position:'absolute',inset:'0',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none',zIndex:'1'});
    this.svgLayer.innerHTML=`<defs>
      <marker id="wf-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#6366f1" opacity="0.9"/></marker>
      <marker id="wf-arrow-p" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#a78bfa" opacity="0.9"/></marker>
      <filter id="wf-glow"><feGaussianBlur stdDeviation="3" result="cb"/><feMerge><feMergeNode in="cb"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>`;
    this.viewport.appendChild(this.svgLayer);
    this.nodeLayer=document.createElement('div');
    Object.assign(this.nodeLayer.style,{position:'absolute',inset:'0',zIndex:'2'});
    this.viewport.appendChild(this.nodeLayer);
    this._drawGrid(); this._applyTransform();
  }
  _drawGrid() {
    if(!this.options.showGrid)return;
    const cvs=this.gridCanvas,{clientWidth:w,clientHeight:h}=this.container;
    cvs.width=w;cvs.height=h; const ctx=cvs.getContext('2d');
    const s=this.options.gridSize*this.transform.scale;
    const ox=((this.transform.x%s)+s)%s,oy=((this.transform.y%s)+s)%s;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='rgba(99,110,135,0.12)';ctx.lineWidth=1;
    for(let x=ox-s;x<w+s;x+=s){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=oy-s;y<h+s;y+=s){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    const big=s*5,bx=((this.transform.x%big)+big)%big,by=((this.transform.y%big)+big)%big;
    ctx.fillStyle='rgba(99,110,135,0.3)';
    for(let x=bx-big;x<w+big;x+=big)for(let y=by-big;y<h+big;y+=big){ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();}
  }
  _applyTransform() {
    const{x,y,scale}=this.transform;
    this.viewport.style.zoom=scale;
    this.viewport.style.transform=`translate(${x/scale}px,${y/scale}px)`;
    this._drawGrid(); this._emit('transformChange',{...this.transform});
  }
  _bindEvents() {
    const el=this.container;
    // Mouse pan
    el.addEventListener('mousedown',e=>{
      if(e.button===1||(e.button===0&&(e.target===el||e.target===this.gridCanvas||e.target===this.nodeLayer))){
        this._isPanning=true;this._panStart={x:e.clientX-this.transform.x,y:e.clientY-this.transform.y};
        this.container.style.cursor='grabbing';e.preventDefault();
      }
    });
    window.addEventListener('mousemove',e=>{
      if(!this._isPanning)return;
      this.transform.x=e.clientX-this._panStart.x;this.transform.y=e.clientY-this._panStart.y;
      this._applyTransform();
    });
    window.addEventListener('mouseup',()=>{if(this._isPanning){this._isPanning=false;this.container.style.cursor='';}});
    // Wheel zoom
    el.addEventListener('wheel',e=>{
      e.preventDefault();
      const rect=el.getBoundingClientRect(),mx=e.clientX-rect.left,my=e.clientY-rect.top;
      const delta=e.deltaY<0?1.1:0.9;
      const ns=Math.min(this.options.maxZoom,Math.max(this.options.minZoom,this.transform.scale*delta));
      const r=ns/this.transform.scale;
      this.transform.x=mx-(mx-this.transform.x)*r;this.transform.y=my-(my-this.transform.y)*r;this.transform.scale=ns;
      this._applyTransform();
    },{passive:false});
    // Touch: pan + pinch-zoom
    this._touches={};this._lastPinchDist=null;
    el.addEventListener('touchstart',e=>{
      e.preventDefault();
      for(const t of e.changedTouches)this._touches[t.identifier]={x:t.clientX,y:t.clientY};
      const ids=Object.keys(this._touches);
      if(ids.length===1){
        const t=e.changedTouches[0];
        this._isPanning=true;this._panStart={x:t.clientX-this.transform.x,y:t.clientY-this.transform.y};
      } else if(ids.length===2){
        this._isPanning=false;
        const [a,b]=[this._touches[ids[0]],this._touches[ids[1]]];
        this._lastPinchDist=Math.hypot(b.x-a.x,b.y-a.y);
      }
    },{passive:false});
    el.addEventListener('touchmove',e=>{
      e.preventDefault();
      for(const t of e.changedTouches)if(this._touches[t.identifier])this._touches[t.identifier]={x:t.clientX,y:t.clientY};
      const ids=Object.keys(this._touches);
      if(ids.length===1&&this._isPanning){
        const t=e.changedTouches[0];
        this.transform.x=t.clientX-this._panStart.x;this.transform.y=t.clientY-this._panStart.y;
        this._applyTransform();
      } else if(ids.length>=2){
        const [a,b]=[this._touches[ids[0]],this._touches[ids[1]]];
        const dist=Math.hypot(b.x-a.x,b.y-a.y);
        if(this._lastPinchDist){
          const factor=dist/this._lastPinchDist;
          const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
          const rect=el.getBoundingClientRect(),mx=mid.x-rect.left,my=mid.y-rect.top;
          const ns=Math.min(this.options.maxZoom,Math.max(this.options.minZoom,this.transform.scale*factor));
          const r=ns/this.transform.scale;
          this.transform.x=mx-(mx-this.transform.x)*r;this.transform.y=my-(my-this.transform.y)*r;this.transform.scale=ns;
          this._applyTransform();
        }
        this._lastPinchDist=dist;
      }
    },{passive:false});
    el.addEventListener('touchend',e=>{
      for(const t of e.changedTouches)delete this._touches[t.identifier];
      if(Object.keys(this._touches).length===0){this._isPanning=false;this._lastPinchDist=null;}
      else if(Object.keys(this._touches).length===1){
        const remaining=Object.values(this._touches)[0];
        this._isPanning=true;this._panStart={x:remaining.x-this.transform.x,y:remaining.y-this.transform.y};
        this._lastPinchDist=null;
      }
    },{passive:false});
    const ro=new ResizeObserver(()=>this._drawGrid());ro.observe(this.container);
  }
  screenToCanvas(sx,sy){const r=this.container.getBoundingClientRect();return{x:(sx-r.left-this.transform.x)/this.transform.scale,y:(sy-r.top-this.transform.y)/this.transform.scale};}
  snapPoint(x,y){if(!this.options.snapToGrid)return{x,y};const g=this.options.gridSize;return{x:Math.round(x/g)*g,y:Math.round(y/g)*g};}
  centerOn(wx,wy){const{clientWidth:w,clientHeight:h}=this.container;this.transform.x=w/2-wx*this.transform.scale;this.transform.y=h/2-wy*this.transform.scale;this._applyTransform();}
  on(ev,fn){if(!this._listeners[ev])this._listeners[ev]=[];this._listeners[ev].push(fn);}
  _emit(ev,d){(this._listeners[ev]||[]).forEach(fn=>fn(d));}
}
