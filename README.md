# scratch-it
A light weight javascript library for simulating a scratch off lottery ticket.  It works on mobile and is responsive.

## Usage
A new ScratchIt instance may be instantiated with:

```javascript
ScratchIt( containerEl, overlayImgUrl, brushImgUrl, onReveal, revealPercent );
```
|Argument   |Required   |Description   |
| :------------ | :------------ | :------------ |
|containerEl   |Required   |A DOM Element that will have an HTML5 `<canvas>` element appended within. Typically this element will also contain an image or have a background image that is meant to be reavealed once the overlay has been scratched off.   |
|overlayImgUrl   |Required   |A URL to an image that will act as the overlay image. This is the image the user will interact with and scratch off.   |
|brushImgUrl   |Required   |A URL to an image that will act as a "brush". This can be used to give different textures to the edges where the user has scratched off.   |
|onReveal   |Optional   |A user defined callback function that is executed after some percentage of the overlay image has been scratched off. *Default: none.*   |
|revealPercent   |Optional   |The percentage of the overlay image that must be scratched off before the onReveal handler is called. Must be a number between 0 and 100. *Default: 50*   |

## Testing For Support
The library comes with a simple `isSupported()` method for testing whether the browser supports the browser technologies necessary to function.

```javascript
if(ScratchIt.isSupported()){
  // Library is supported
}
```

## Example Code
```html
<div id="scratch"><img src="hiddenMessage.jpg" /></div>

<script src="ScratchIt.min.js"></script>
<script>
  var containerEl = document.getElementById('scratch'),
      overlayImgUrl = 'overlay.jpg',
      brushImgUrl = 'brush.png',
      revealPercent = 50;

  function onReveal(){
    // TODO: Your code here
  }

  if(ScratchIt.isSupported()){
    ScratchIt(containerEl, overlayImgUrl, brushImgUrl, onReveal, revealPercent);
  }
</script>
```

## Demo
Visit the [Demo Page](https://porcupine021.github.io/scratch-it/demo/) to see this library in action.

## Browser Support
This library has been tested to work with:
- Chrome
- Safari
- Firefox
- Internet Explorer 9+
- Edge 16+
- Opera 51+
- Android 4.4, 6.0, 7.0, 8.0
- iOS 10+

Other browsers may be supported as well, but have not been tested. This library requires the browser to support HTML5 Canvas and RequestAnimationFrame

## Caveats
If your image assets are hosted on another domain (like a CDN), this host will need to have CORS enabled.  CORS is required so that HTML5 canvas may have permission to read the contents of an image from an outside domain.  Please note that Internet Explorer 9 does not have the ability to properly fetch images this way and will not work with images hosted on another domain.
