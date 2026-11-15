# Tmux prefix with a status indicator for Herdr

Press **Ctrl+B**, release it, then press a command key. Prefix mode waits
with only a small **`[prefix]`** indicator in the bottom-right corner of the
Herdr window. The indicator stays visible during repeats and help, and disappears
when prefix mode ends. There is no automatic hint table or full-window background.
Press **Ctrl+B, then ?** to show the full help table. Press `?` again to hide
the table while keeping the indicator and prefix mode active; Escape cancels.
Clicking outside the help table also cancels prefix mode.

Based on [Herdr's tmux-prefix example](https://github.com/herdrdev/herdr-layout-examples/tree/main/tmux-prefix),
licensed under [Apache-2.0](../LICENSE). This fork changes hint visibility;
it is not an official Herdr release or a terminal multiplexer. The transparent
prefix overlay sizes itself from the current window viewport, rather than from
a fixed screen resolution.

## Install

Requires the newer **Herdr app**, its `herdr-app` CLI and herdr-core (`hc`).
The app must support frameless overlays (`frame: "none"`). This was validated
with Herdr app 0.1.16. No additional runtime dependencies are needed.

```sh
git clone https://github.com/Gwynbleid85/herdr-layout-examples.git
cd herdr-layout-examples

# Stop if this folder already exists; back it up before upgrading.
test ! -e ~/.config/herdr-app/mods/tmux-prefix && \
  mkdir -p ~/.config/herdr-app/mods && \
  cp -R tmux-prefix/mods/tmux-prefix ~/.config/herdr-app/mods/

# Back up shortcuts before editing.
cp ~/.config/herdr-app/keys.json \
  ~/.config/herdr-app/keys.json.backup-$(date +%Y%m%d-%H%M%S)
```

Merge these entries into `~/.config/herdr-app/keys.json`. **Do not replace
that file**: preserve existing sections and keys. Resolve any existing
`ctrl-b` bindings, including those in `layout:<name>` sections, first.

```json
{
  "global": { "ctrl-b": "mod.open:tmux-prefix" },
  "terminal": { "ctrl-b": "mod.open:tmux-prefix" },
  "mod:tmux-prefix": { "ctrl-b": "tmux-prefix.send-prefix" }
}
```

Validate the installed copy:

```sh
herdr-app check ~/.config/herdr-app/mods/tmux-prefix
```

No layout changes are needed. Existing shortcuts such as Cmd+D still work.
If an old prefix popup is open during an upgrade, close it with Escape
before trying the updated mod.

## Controls

All keys below follow Ctrl+B:

| Key | Action |
| --- | --- |
| `?` | Show/hide the full help table |
| `%` / `"` | Split right / down |
| `h j k l` or arrows | Focus left / down / up / right |
| `x` | Close the focused pane and end its terminal |
| `z` | Toggle pane zoom |
| `c` | New tab |
| `n` / `p` | Next / previous tab |
| `1`–`9`, `0` | Select tab 1–9, 10 |
| `J` / `K` | Next / previous space |
| `d` | Minimize the window, not tmux detach |
| Escape | Cancel |
| Ctrl+B | Send a literal Ctrl+B to the focused terminal |

The first command has no timeout. Pane focus and space navigation allow
repeats for 500ms after each action, without another prefix. `?` cancels
the repeat timeout. Help stays visible until hidden or prefix mode ends.

Ctrl+B is intercepted from terminal programs, including tmux; press it
twice to send it through. Unbound keys initially dismiss prefix mode.
During repeats, supported simple keys are forwarded to the terminal;
shifted punctuation, Unicode and modified shortcuts are not replayed.

The mod invokes Herdr's `hc` executable to forward literal keys. It makes
no network requests and reads no external files. Customize `BINDINGS` and
`REPEAT_MS` in `mods/tmux-prefix/main.js`.

## Upgrade or remove

Before upgrading, copy the installed `mods/tmux-prefix` folder to a dated
backup outside `mods/`, then replace only `main.js` and `mod.json` with the
fork's files. Keep your existing `keys.json` and validate again.

To uninstall, close prefix mode, remove its three key entries (or restore
your prior Ctrl+B bindings), and remove `mods/tmux-prefix`. Restore your
backed-up folder to return to the upstream behavior. Restore the whole
keys backup only if you have made no later shortcut edits.

## Verify

From the repository root, using Node's built-in test runner:

```sh
node --test tmux-prefix/tests/prefix.test.cjs
herdr-app check "$PWD/tmux-prefix/mods/tmux-prefix"
```

Unit tests execute the real mod with native Herdr/GPUI boundaries stubbed.
They do not replace a keyboard/rendering check in Herdr: confirm that
Ctrl+B shows `[prefix]` at bottom-right, `?` displays help, `%` splits,
Escape removes the indicator, and Ctrl+B twice forwards.

The existing `preview.png` shows **help mode**, not what appears on Ctrl+B.
