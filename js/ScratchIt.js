/**
 * A javascript library that simulates a scratch off lottery ticket. It's responsive and is mobile friendly.
 * 
 * @author Aaron Graham
 */
function ScratchIt(){

  var parentEl,
      overlayCanvas,
      overlayCtx,
      brushCanvas,
      brushCtx,
      overlayLoaded = false,
      brushLoaded = false,
      isPointerDown = false,
      pointerOrigin = {x: 0, y: 0},
      offsetOrigin = {x: 0, y: 0},
      scale = 1.0,
      paintQueue = [],
      lastPoint,
      rafId,
      minPointDist = 10,
      isRevealed = false,
      revealThreshold,
      revealCallback
  ;

  /**
   * Constructor
   * 
   * @constructor
   * @param {DOMElement} el The parent DOM element that the canvas will be appended to
   * @param {String} overlayUrl The URL to the image which will be displayed
   * @param {String} brushUrl The URL to the image which will act as the brush for erasing the content of the overlay image
   * @param {Function} callback (Optional) A function to be called after a certain percentage of the overlay image has been removed.
   * @param {Number} threshold (Optional) A percentage between 0 and 100. This percentage of pixels must be visible to the user before the revealCallback will be triggered.
   * @throws {Exception} On any invalid argument
   * @return {void}
   */
  var construct = function(el, overlayUrl, brushUrl){
    parentEl = el;

    var callback = arguments.length > 3 ? arguments[3] : function(){};
    var threshold = arguments.length > 4 ? arguments[4]*1 : 0;

    if(!isDomElement(parentEl)){
      throw 'ScratchIt() requires parent element to be a valid DOM Element."'
    }
    if(typeof callback !== 'function'){
      throw 'ScratchIt() requires callback to be a function';
    }
    if(threshold < 0 || threshold > 100){
      throw 'ScratchIt() requires threshold to be between 0-100';
    }

    revealCallback = callback;
    revealThreshold = threshold;

    getCanvasFromImage(overlayUrl, function(canvas){
      overlayLoaded = true;
      overlayCanvas = canvas;
      onCanvasLoaded();
    });
    getCanvasFromImage(brushUrl, function(canvas){
      brushLoaded = true;
      brushCanvas = canvas;
      onCanvasLoaded();
    });
  };

  /**
   * Tests whether something is a DOM Element
   * 
   * @private
   * @param {Object} el
   * @returns {Boolean}
   */
  var isDomElement = function(el){
    return typeof HTMLElement === 'object' ? el instanceof HTMLElement : //DOM2
      el && typeof el === 'object' && el !== null && el.nodeType === 1 && typeof el.nodeName === 'string';
  };

  /**
   * Event handler called after an image has been loaded into a canvas. Once all canvases are loaded,
   * the function initializes everything required for the scratchIt widget to work.
   * 
   * @private
   * @return {void}
   */
  var onCanvasLoaded = function(){
    var body = document.body;

    // don't do any work until both brush and overlay have been attempted to be fetched
    if(!(overlayLoaded && brushLoaded)){
      return;
    }

    // log error if either of them failed
    if(!(overlayCanvas && brushCanvas)){
      console.error('Failed to load ScratchIt image');
      return;
    }

    // Build and initialize the widget
    parentEl.appendChild(overlayCanvas);

    overlayCtx = overlayCanvas.getContext('2d');
    brushCtx = brushCanvas.getContext('2d');

    overlayCtx.globalCompositeOperation = 'destination-out';
    minPointDist = brushCanvas.width / 2;

    if(window.PointerEvent){
      overlayCanvas.addEventListener('pointerdown', onPointerDown);
      body.addEventListener('pointerup', onPointerUp);
      body.addEventListener('pointerleave', onPointerUp);
      body.addEventListener('pointermove', onPointerMove);
    }
    else{
      overlayCanvas.addEventListener('mousedown', onPointerDown);
      body.addEventListener('mouseup', onPointerUp);
      body.addEventListener('mouseleave', onPointerUp);
      body.addEventListener('mousemove', onPointerMove);

      overlayCanvas.addEventListener('touchstart', onPointerDown);
      body.addEventListener('touchend', onPointerUp);
      body.addEventListener('touchmove', onPointerMove);
    }

    window.addEventListener('resize', debounce(onResize, 200));

    onResize();

    rafId = window.requestAnimationFrame(draw);
  };

  /**
   * This function is called by RAF and is responsible for painting to the canvas
   * 
   * @private
   * @return {void}
   */
  var draw = function(){
    var point;
    while(paintQueue.length){
      point = paintQueue.shift();
      overlayCtx.drawImage(brushCanvas, point.x - brushCanvas.width / 2, point.y - brushCanvas.height/ 2);
    }

    rafId = window.requestAnimationFrame(draw);
  };

  /**
   * Returns a function, that, as long as it continues to be invoked, will not
   * be triggered. The function will be called after it stops being called for
   * N milliseconds. 
   * 
   * @private
   * @see http://davidwalsh.name/javascript-debounce-function
   * @param {Function} func The function to debounce.
   * @param {Number} wait The number of milliseconds after it stops being called.
   * @param {Bool} immediate If `immediate` is passed, trigger the function on the leading edge, instead of the trailing.
   * @returns {Function}
   */
  var debounce = function(func, wait, immediate){
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };

  /**
   * Event handler called when the browser window is resized. Keeps track of the scale of the parent element
   * so pointer events can be scaled and drawn properly regardless of the element's size.
   * 
   * @private
   * @return {void}
   */
  var onResize = function(){
    scale = 1 / (parentEl.getBoundingClientRect().width / overlayCanvas.width);
  };

  /**
   * Helper method for adding a new point to the queue of points which must be drawn to the overlay.
   * 
   * @private
   * @param {Object} point The pre-scaled x,y coordinates to draw the brush
   * @param {Bool} tween Specifies whether additional points should be drawn between the last point. (in case pointer events are widely spread apart. cursor or finger is swiping fast)
   * @return {void}
   */
  var addPoint = function(point, tween){
    var dx, dy, dist, i, numSegments;
    tween = !!tween;

    if(tween && lastPoint){

      // calc distance between current and last point added
      dx = lastPoint.x - point.x;
      dy = lastPoint.y - point.y;
      dist = Math.sqrt(dx*dx + dy*dy);

      // if distance is too large, add points in between
      if(dist > minPointDist){
        numSegments = Math.ceil(dist / minPointDist);
        dx = dx / numSegments;
        dy = dy / numSegments;

        for(i = 1; i < (numSegments); i++){
          paintQueue.push({
            x: Math.round(point.x + (i * dx)),
            y: Math.round(point.y + (i * dy))
          });
        }
      }
    }

    point = {
      x: Math.round(point.x),
      y: Math.round(point.y)
    };
    lastPoint = point;
    paintQueue.push(point);
  };

  /**
   * Utility method for canceling a browser event. Prevents default behavior and event bubbling.
   * 
   * @private
   * @param {Event} event
   * @return {void}
   */
  var cancelEvent = function(event){
    event.preventDefault();
    event.cancelBubble = true;
    event.stopPropagation();
  };

  /**
   * Event handler called when a user touches/clicks the overlay canvas. 
   * 
   * @private
   * @param {Event} event
   * @return {void}
   */
  var onPointerDown = function(event){
    cancelEvent(event);

    isPointerDown = true;

    pointerOrigin = getPointFromEvent(event);
    offsetOrigin = getOffsetPointFromEvent(event);

    //alert('scale:'+scale+' vp:'+pointerOrigin.x+','+pointerOrigin.y+' off:'+offsetOrigin.x+','+offsetOrigin.y);

    addPoint({
      x: offsetOrigin.x * scale,
      y: offsetOrigin.y * scale
    });
  };

  /**
   * Event handler called when a user has started drawing/touching the canvas.
   * 
   * @private
   * @param {Event} event
   * @return {void}
   */
  var onPointerMove = function(event){
    if(!isPointerDown){ return; }
    cancelEvent(event);

    var pointerPosition = getPointFromEvent(event);
    addPoint({
      x: (offsetOrigin.x + (pointerPosition.x - pointerOrigin.x)) * scale,
      y: (offsetOrigin.y + (pointerPosition.y - pointerOrigin.y)) * scale
    }, true);
  };

  /**
   * Event handler called when a user has released mouse click or removed finger from canvas.
   * 
   * @private
   * @param {Event} event
   * @return {void}
   */
  var onPointerUp = function(event){
    if(!isPointerDown){ return; }
    cancelEvent(event);

    isPointerDown = false;

    lastPoint = void(0);
    pointerOrigin = {x:0,y:0};
    offsetOrigin = {x:0,y:0};

    testRevealed();
  };

  /**
   * Utility method that tests the percentage of pixels of the overlay image that have been revealed. A pixel is 
   * considered revealed if it is more than 50% transparent. If a threshold is reached, the user's reveal callback
   * function is called once.
   * 
   * @private
   * @return {void}
   */
  var testRevealed = function(){
    var pixels, i,
        numVisible = 0,
        alphaThreshold = 128,
        totalPixels = overlayCanvas.width * overlayCanvas.height;

    if(isRevealed){ return; }

    pixels = overlayCtx.getImageData(0, 0, overlayCanvas.width, overlayCanvas.height);
    for(i = 0; i < pixels.data.length; i += 4){
      if(pixels.data[i+3] <= alphaThreshold){
        numVisible++;
      }
    }

    if((numVisible / totalPixels * 100) >= revealThreshold){
      revealCallback();
      isRevealed = true;
    }
  };

  /**
   * This function returns an object with X & Y values from the pointer event
   * 
   * @param {Event} event
   * @returns {Object} Contains mouse x,y coords
   */
  var getPointFromEvent = function(event){
    return {
      x: (event.targetTouches ? event.targetTouches[0].clientX : event.clientX),
      y: (event.targetTouches ? event.targetTouches[0].clientY : event.clientY)
    };
  };

  /**
   * Utility method to get mouse coordinates relative to the element that captured the event.
   * 
   * @param {Event} event The event object
   * @returns {Object} Contains mouse x,y coords
   */
  var getOffsetPointFromEvent = function(event){
    var offsetX, offsetY,
        currentElement = event.target,
        totalOffsetX = 0,
        totalOffsetY = 0;

    if(typeof event.offsetX === 'number'){
      offsetX = event.offsetX;
      offsetY = event.offsetY;
    }
    else if(event.originalEvent && typeof event.originalEvent.layerX === 'number'){
      offsetX = event.oritinalEvent.layerX;
      offsetY = event.oritinalEvent.layerY;
    }
    // safari on iOS has no easy way to get the event coordinates relative to the canvas...
    else{
      var rect = overlayCanvas.getBoundingClientRect();
      //alert(rect.top+','+rect.left+','+rect.width+','+rect.height);
      /*
      do{
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
      }
      while(currentElement = currentElement.offsetParent)

      offsetX = event.pageX - totalOffsetX;
      offsetY = event.pageY - totalOffsetY;
      */
      offsetX = event.touches[0].clientX - rect.left;
      offsetY = event.touches[0].clientY - rect.top;
    }

    return {x : offsetX, y : offsetY};
  };

  /**
   * Tests whether the current browser is Internet Explorer 9
   * 
   * @private
   * @returns {bool}
   */
  var isIE9 = function(){
    var av = navigator.appVersion;
    return (av.indexOf("MSIE") !== -1 && parseFloat(av.split("MSIE")[1]) <= 9);
  };

  /**
   * Loads an image into a canvas object
   * 
   * @private
   * @param {string} imgUrl The source image URL. Remember that domain policies apply to working with 
   *   images on canvas. The image may need to have appropriate CORS headers set or be served from the same 
   *   domain as your application.
   * @param {function} callback 
   * @return {void}
   */
  var getCanvasFromImage = function(imgUrl, callback){
    var image;

    // bailout if the user didn't supply a valid callback, image URL, the browser doesn't support 
    // canvas or we are unable to return the canvas as the requested data uri string
    if(typeof imgUrl !== 'string' || typeof callback !== 'function'){
      callback(false);
      return;
    }

    image = new Image();

    image.onload = function(){
      // IE9 needs a breather before it will reliably get the contents of the image to paint to the canvas
      if(isIE9()){
        setTimeout(function(){ callback(imageToCanvas(image)); }, 300);
      }
      else{
        callback(imageToCanvas(image));
      }
    };

    image.onerror = function(){
      callback(false);
    };

    if(!isSameOrigin(imgUrl)){
      image.crossOrigin = '';
    }

    image.src = imgUrl;
  };

  /**
   * Tests whether a supplied URL shares the same origin (protocol and domain) as the current page.
   * 
   * @private
   * @param {string} url The URL to test
   * @returns {bool}
   */
  var isSameOrigin = function(url){
    var l = window.location;
    try{
      return ((new URL(url)).origin === l.origin);
    }
    catch(ex){
      var a = document.createElement('A'),
          urlOrigin, winOrigin;

      // attach an anchor tag to the document with the URL to test. this allows us to get access to the 
      // various pieces that comprise the URL
      a.href = url;
      document.head.appendChild(a);
      a.href = a.href; // relative URL's seem to need a refresh here to properly get the URL pieces in IE

      // create normalized origins by stripping off a port number and forcing to lower case
      urlOrigin = (a.protocol+'//'+a.host).replace(/:\d+/,'').toLowerCase();
      winOrigin = (l.protocol+'//'+l.host).replace(/:\d+/,'').toLowerCase();

      // clean up the anchor tag
      document.head.removeChild(a);

      return urlOrigin === winOrigin;
    }
  };

  /**
   * Paints an image to a canvas 
   * 
   * @private
   * @param {object} img The source <img> DOM element
   * @param {function} callback Function to call after the image has been drawn to the canvas
   * @returns {void}
   */
  var imageToCanvas = function(img){
    var canvas = document.createElement('CANVAS'),
        ctx = canvas.getContext('2d'),
        w = img.naturalWidth,
        h = img.naturalHeight;

    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(img, 0, 0, w, h); 
    return canvas;
  };


  construct.apply(this, arguments);
};

/**
* Tests whether the browser has the capabilties necessary to use this library. (requires canvas and RAF support)
* 
* @public
* @static
* @return {Boolean}
*/
ScratchIt.isSupported = function(){
  var canvas = document.createElement('CANVAS');
  return !!(typeof window.requestAnimationFrame === 'function' && canvas.getContext && canvas.getContext('2d'));
};