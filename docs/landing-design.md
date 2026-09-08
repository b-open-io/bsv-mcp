# Landing page design

The page uses native text and shadcn controls, not a screenshot of the approved design.

- Shared brand tokens and Geist Pixel Line: `styles/brand.css`.
- Landing layout: `app/landing.css` and `app/page.tsx`.
- Wallet completion: `src/views/components/WalletReady.tsx` and `AvailableTools.tsx`.
- Exact client UI primitives: `components/brainless/`, from the MIT-licensed Brainless registry, https://brainless.swerdlow.dev/. The carousel is illustrative; it does not execute wallet requests.
- Font: Geist 1.7.2, `GeistPixel-Line.woff2`, with its license in `public/fonts/`.
- Claude and OpenAI marks: Simple Icons, with its license in `public/brands/`. Grok's dot-matrix mark comes from Brainless. The Bitcoin SV mark uses the original paths and colors from the user-supplied https://logotyp.us/file/bitcoin-sv.svg; its viewBox trims the surrounding whitespace.

## Artwork

The built-in image generator produced two isolated assets from the approved concept. The web page serves WebP encodings. The original PNGs remain in the generation archive.

`public/artwork/concentric-eclipse.webp`

Prompt: Create an isolated production artwork asset based ONLY on the upper-right concentric celestial eclipse in this approved website design. NOT another webpage mockup. Square high-resolution astronomical art, no text, no UI, no logo, no buttons. Exactly concentric geometry: central textured spherical golden planet, dark annular space, brilliant warm white/gold inner corona and delicate outer circular rainbow/glory. All rings share exactly the same center. Keep circles fully inside image with generous nearly black margins. Natural atmospheric scattering, finely detailed realistic solar plasma and light, warm amber dust and very restrained violet haze. Resembles the white outer ring, black gap and gold center of 1Sat Ordinals through physical light, not a flat vector symbol. Background #080909 nearly black, corners and outer edges fade cleanly to solid near-black so it composites seamlessly into a dark website hero. No off-center foreground planet or offset circles. The circular phenomenon occupies about 70% of image width centered. Beautiful cinematic believable detail; matching reference's eclipse. Deliver only this isolated square background artwork.

`public/artwork/planet-sunrise.webp`

Prompt: Generate ONLY an isolated production background artwork asset from the BOTTOM planetary eclipse in the reference. No webpage, no text, no logo, no UI. Wide landscape 2:1 aspect ratio. Huge realistically textured dark gold-brown planet rises from the lower-left corner; the sphere's center lies below and left of frame so only its curved upper-right rim and terrain dominate the lower-left half. Epic brilliant warm golden yellow sunlight crests the planet rim roughly one-third from left and halfway down. Natural fine atmospheric halo, sunlight rays and subtle star dust. Planet left, clean near-black negative space across right 55% for future text overlay (do not add any text). Top and right edges blend perfectly to solid #080909 near-black. Cinematic photographic astronomy, elaborate realistic rocky surface and atmospheric light, subdued stars. Match reference's final CTA eclipse gold backlighting. Do not include upper hero concentric eclipse. Deliver only this standalone wide background asset.

## Motion

A deterministic CSS starfield spans the whole page, with staggered twinkles and occasional cross-shaped gold sparkles. Mobile shows fewer stars, and reduced motion leaves them static. The hero retains the original artwork without distortion. Reduced motion disables decorative star loops. The carousel advances only by user input, with side previews, arrows, client buttons, and swipe support.

The completion collage measures the loaded font before placement. Rotated bounds reserve only each phrase's actual dimensions. Replacements search free space; surviving entries keep their coordinates. Resizing the viewport repacks the composition. Pointer and keyboard interaction pause rotation.

## Hero loop and social preview

The homepage uses `public/artwork/grok-eclipse-loop.webm` with an MP4 fallback and the original WebP beneath it. xAI `grok-imagine-video-1.5` generated the 10-second source using identical first/last frame inputs and a cyclic-motion prompt. A brief end-to-start dissolve produces a 9-second loop. No geometric effects or reverse playback are applied. Generation metadata and the exact prompt are in `docs/hero-video-generation.json`. Playback pauses offscreen and in hidden tabs; reduced motion shows the original image. The earlier approved non-looping candidate remains in `public/artwork/grok-eclipse.mp4`.


`public/social-card.png` is the 1200×630 Open Graph and Twitter large-image card. The HTML source is `scripts/social-card.html`; serve its `/fonts/` and `/artwork/` paths from `public/`, await `document.fonts.ready`, and capture at 1200×630 to regenerate. It reuses the approved art, exact supplied logo, and Geist Pixel Line font.
