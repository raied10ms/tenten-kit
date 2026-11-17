<!-- SUMMARY
File: apps/tenten-kit/README.md
Topic: TenTen floating-character kit for videos, slides and web pages
Status: v1.0 (2026-11-17)
Owner: Raied
Covers: how to drop TenTen into a page/slide/video, API, assets, clips, how to rebuild
-->
# TenTen Kit

TenTen as a floating, animated character you can put on **any web page, HTML slide deck, or video**, with sounds, SVGs, PNGs and transparent video clips included.

It's the same character and rules as ReelMath (`apps/reelmath/engine/brand.js`):
- gradient blob, white eyes with the bar, blink, squish, **no mouth, ever**
- it **never vanishes in place**: it only leaves by flying off-screen, sideways
- it flies in low, short arcs and bobs when idle; its eyes glow while it "talks"
- `?` = thinking, `!` = wow, squint + blush = happy

Open `index.html` for the playground: every action is a button, and the full API is on the page.

## 1. Web page / HTML slides (30 seconds)

```html
<script src="tenten.bundle.js"></script>   <!-- one file: code + all sounds inlined -->
<script>
  const tt = TenTen.create({ size: 140 });
  tt.enter();
  tt.say('হাই! আমি টেনটেন');
  tt.point('#question', { say: 'এই প্রশ্নটা খেয়াল করো' });
  tt.celebrate();
  tt.exit();
</script>
```

Actions queue in order, and each returns a Promise (`await tt.say(...)`). Browsers play sound only after the viewer's first click or keypress.

| Example | What it shows |
|---|---|
| `examples/minimal.html` | the smallest possible embed |
| `examples/slides.html` | add `data-tenten="enter; say:…; point:#id|text; celebrate"` to a slide and TenTen acts on that slide; `interrupt()` on slide change; there's a Reveal.js one-liner in the comments |
| `examples/video-overlay.html` | TenTen over a `<video>`: `tt.sync(video, [{ t: 2, do: ['say','…'] }])` follows `currentTime`, so pausing and seeking work |

## 2. Video editors, PowerPoint, Keynote, Google Slides, Canva

Transparent clips are in `clips/`, in three formats each:
- **`.mov`**: ProRes 4444 with alpha. Use it in Premiere, Final Cut, DaVinci, CapCut desktop, Keynote and PowerPoint (Mac). Includes the sounds.
- **`.webm`**: VP9 with alpha, for the web. Includes the sounds.
- **`.gif`**: transparent, for Google Slides and Canva. No sound.

Clips: idle, talk, think, wow, happy, sleepy, celebrate, nod, shake, look-around, enter-left, enter-right, exit-left, exit-right.

Stills: `assets/png/tenten-<mood>.png` (512 px, transparent) and `assets/svg/tenten-<mood>.svg`, for idle, happy, think, wow, sleepy, talk, look-left and look-right.

Sounds: `assets/sfx/*.mp3` (web) and `assets/sfx-wav/*.wav` (editors): pop, whoosh, swoosh, blink, peek, chime, ding, success, tick, sting. They're synthesised in-house (ReelMath `make-sfx.mjs`), so they're free to use anywhere.

## 3. API

| Call | Does |
|---|---|
| `TenTen.create(opts)` | `size` 140 · `parent` (body, or an element/selector: e.g. a video wrapper) · `sound` · `volume` · `draggable` · `onClick` · `start` ('offscreen' or {x,y}) · `side` · `clock` ('auto' or 'manual' + `advance(dt)`) |
| `enter({from,to})` / `exit({to})` | flies in from the side / flies off-screen sideways |
| `flyTo(target)` | the target can be an element, a selector, `{x,y}` px, or `{x:'80%', y:'70%'}` |
| `point(target, {say})` | flies beside the element, looks at it and rings it |
| `say(text, {dur, mood})` | speech bubble + glowing eyes |
| `think` · `wow` · `happy` · `sleepy` · `setMood(name, dur)` | moods |
| `hop` · `nod` · `shake` · `spin` · `blink` · `celebrate` | gestures |
| `look(dir)` · `lookAt(target)` | moves the gaze only |
| `followTarget('mouse' or el)` · `unfollow()` | follow mode |
| `play([['enter'], ['say','হাই'], …])` | runs a scripted sequence |
| `sync(video, cues)` | drives TenTen from a video's clock |
| `interrupt()` · `mute()` · `destroy()` | control |

## 4. Rebuild

```
npm i                              # playwright (only for the tools)
node tools/build.mjs               # tenten.js + assets/sfx → tenten.bundle.js
node tools/render-clips.mjs        # every clip + still (or: node tools/render-clips.mjs happy stills)
```
Add a new clip by adding one line to `CLIPS` in `tools/render-clips.mjs`. The clip is just a few TenTen API calls, rendered frame by frame.

## Rules for the team

- **No mouth, ever.** Don't edit the face.
- Don't make it disappear in place: use `exit()`.
- Keep it next to the content, never on top of the content you are teaching (`point()` picks a free side automatically).
