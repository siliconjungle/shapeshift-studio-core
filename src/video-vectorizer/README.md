# Video to SVG

The default Node converter reuses the existing Little Gods image converter:
stacked VTracer splines, its median filter, and its solid-colour SVG output.
The video layer supplies a shared clip palette, dense optical flow, motion-aligned
temporal median, anchored colour labels, persistent shape identities, exact holds for source-quiet shapes, frame-specific
paint order, optional silhouette ink, and optional trailing-hold trimming.

```js
import {convertVideoFile} from '@shapeshift-labs/studio-core/video-vectorizer/node';
import {svgFrame,animatedSVG} from '@shapeshift-labs/studio-core/video-vectorizer';

const clip = await convertVideoFile('performance.mp4', {
  colors: 16,
  maxDimension: 1024, // do not upscale; retain source detail up to this limit
  frameRate: 24,
  trimTrailingHold: {keepSeconds: .35},
  outline: {width: 4.4, displayWidth: 640, background: '#fcf7ee'},
  onProgress: console.log,
  signal: abortController.signal,
});
const firstFrame = svgFrame(clip, {frame: 0});
const animation = animatedSVG(clip); // true SVG paths, never embedded bitmaps
```

Node decoding requires `ffmpeg` and `ffprobe` on PATH. Optional Node dependencies
`sharp` and `@neplex/vectorizer` supply the same image fitter used by Little Gods.
`@techstark/opencv-js` supplies local Farneback optical flow; no Python service is needed.
They are not imported by the browser-safe entry point. Conversion is local and
does not call a generation API. Audio is not included.

## Temporal processing

The default Node settings are `flowBackend: 'opencv'`, `trackMotion: true`,
`trackPalette: true`, and `trackCurves: false`. The current fidelity profile uses `traceScale: 2`,
`tracePreset: 'fidelity'`, `sourceColorBudget: 8`, and one clustered palette.
Independent whole-shape holds are disabled in this source-checked mode. Motion is measured across nearby
frames. Source-still regions retain their palette labels before tracing, while
coherent movement, new appearance, and alpha changes allow updates. Colour
decisions compare against anchored source pixels so gradual changes accumulate
instead of being mistaken for permanent stillness.

The original stacked spline fitter then traces this stabilized input. It retains
overlapping underpaint and paint order, avoiding cracks between independently
fitted regions. Curve advection is experimental and off by default: a small
boundary displacement can expose underpaint even if whole-image error is low.
`trackCurves: true` enables it with a source-fidelity guard, but is not recommended
for stacked illustrated artwork. For controlled comparisons, disable both
`trackMotion` and `trackPalette`, or select `flowBackend: 'block-matching'`.

## Browser-safe integration

`trackTracedVideo(svgStrings, rgbaFrames, options)` consumes the M/C/Z spline
subset emitted by the shared converter. SVG and source-frame dimensions must
match. It preserves the fitted curves and original paint order.

`vectorizeVideo(frames, {traceFrame, ...options})` accepts an iterable or async
iterable of RGBA frames and a supplied tracer callback. The callback receives
`(frame, {index, frames, signal})`; this lets a backend prepare a clip-wide palette.
The default Studio page uses the Node backend through its loopback-only server.

`validateVectorVideo`, `sampleVectorVideo`, `svgFrame`, and `animatedSVG` handle
the JSON model. Poses retain their Bezier control points. Geometry only
interpolates within compatible epochs; genuine changes remain discrete.
Frame paint order is retained. Animated SVG uses ordered `<use>` slots referring
to persistent animated paths, rather than groups containing whole frame copies.

`vectorizeRegionsExperimental` retains the earlier region-fitter experiment for
comparison. It is **not** the quality backend: its separately fitted adjoining
regions can introduce seams and rougher boundaries.

## Outline and timing

The outer ink band uses the same Perfect Freehand geometry and width convention
as the map experiment. It outlines the exterior silhouette, not internal painted
lines. Opaque input requires a background colour; transparent input uses alpha.
Exported frame SVGs bake ink into filled polygons for the existing renderer.

Trailing-hold detection compares source images to one fixed final image, so
slow accumulated movement is not classified solely by adjacent-frame differences.
Only the trailing hold is shortened. `clip.timing` records the retained frame
range and removed time; original source files are never changed. This is a
threshold-based editing suggestion and can be disabled.

## Current limits

This remains an experimental video converter. Source appearance is the reference;
stability scores alone are not an acceptance test. Small regions and occlusion
changes can still produce new paths. Conservative holds do not eliminate all
flicker in moving outlines. The converter does not infer a puppet rig, invent
hidden artwork, or turn source shading into a fixed material model.

Input is buffered under explicit frame/pixel limits for clip-wide analysis.
Cancellation is checked between decode/trace stages; an in-flight native image
trace finishes before its result is discarded. The preview reuses the existing
Little Gods triangulator, paint-order material, MSAA/FXAA and grading pass.
## Source styling and diagnostics

`grading` accepts resolved values from the existing colour-grading contract.
It is applied to decoded sRGB frames before the shared cel palette is selected.
The CPU implementation follows the existing gradeSRGB shader, including ink
protection, exposure, split tones and alpha preservation. Studio resolves its
existing Little Gods presets and leaves the output shader neutral, avoiding a
double grade. Changing the source grade requires conversion again.

`onPreparedFrame(frame, index)` receives the exact colour-reduced, temporally
prepared raster passed to the tracer. Studio shows these frames in the left pane;
the Compare menu also exposes the original video. Prepared PNGs are local review
assets and are never embedded in exported SVGs. Server-generated preview links
last for the current local server session; they are not portable clip assets.

`audit: true` records per-frame pixel and temporal error against the graded source.
The Node entry also exports `auditVectorVideo` and `pixelErrors`. A temporal
residual compares output changes with source changes, so freezing real motion
is penalized. Outline styling changes pixels intentionally; audit reports whether
it was included. Inspect localized edge errors as well as whole-image averages.

Video decoding preserves declared colour matrices; untagged videos use Rec.709
with bilinear chroma reconstruction, matching the tested browser decoder.
Fidelity tracing can produce large clips and many small paths. Residual edge
flicker remains; passing tests or reducing average error is not visual approval.

`sourceBackground` enables a separate exterior covering layer fitted from the
source-connected background. It preserves enclosed light details and all
interior paint, and is skipped for transparent artwork. It does not add or
thicken internal lines. Use it for opaque characters on a known flat
background; leave it unset for scenes without a separable background.
