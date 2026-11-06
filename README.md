# e8-consult

Commands for [E8](https://github.com/e8-editor/e8) that pick something with completion and show you where it leads while you choose: the window follows the selection, so moving through the candidates previews each line, buffer, match or heading, and keys narrow the list to one kind of candidate. A port of [consult](https://github.com/minad/consult) 2.8.

## Installing

In `~/.config/e8/init.ts`:

```ts
e8.usePackage("e8-editor/e8-consult");
```

E8 installs it at its newest version tag into `repos/` beside `init.ts`, records the commit in `e8-lock.json`, and requires it. `M-x package-vc-upgrade` brings it up to date. Pin a version with `{ rev: "v0.1.0" }`. It needs E8 0.3.1 or newer.

Consult binds no keys of its own. It is at its best with a vertical completion list, [e8-vertico](https://github.com/e8-editor/e8-vertico), and a matching style such as [e8-orderless](https://github.com/e8-editor/e8-orderless). A setup to start from:

```ts
e8.usePackage("e8-editor/e8-vertico");
e8.usePackage("e8-editor/e8-orderless");
e8.usePackage("e8-editor/e8-consult");
e8.call("vertico-mode");
e8.setVariable("completion-styles", ["orderless", "basic"]);

e8.defineKey("global-map", "C-x b", "consult-buffer");
e8.defineKey("global-map", "M-y", "consult-yank-pop");
e8.defineKey("global-map", "M-g g", "consult-goto-line");
e8.defineKey("global-map", "M-g o", "consult-outline");
e8.defineKey("global-map", "M-g i", "consult-imenu");
e8.defineKey("global-map", "M-g f", "consult-flymake");
e8.defineKey("global-map", "M-g e", "consult-compile-error");
e8.defineKey("global-map", "M-s l", "consult-line");
e8.defineKey("global-map", "M-s r", "consult-ripgrep");
e8.defineKey("isearch-mode-map", "M-e", "consult-isearch-history");
// Choose among several xrefs with preview, rather than in *xref*.
e8.setVariable("xref-show-xrefs-function", "consult-xref");
e8.setVariable("xref-show-definitions-function", "consult-xref");
```

## Using it

Going somewhere in the buffer:

- `consult-line`: a line that matches; `consult-line-multi` searches the project's buffers, or every buffer with `C-u`.
- `consult-goto-line`: a line by number, shown as you type it.
- `consult-outline`: a heading; a digit and `SPC` narrows to headings at that level or above.
- `consult-imenu`, `consult-imenu-multi`: a place in the imenu index, of this buffer or the project's.
- `consult-mark`, `consult-global-mark`: a place in the mark ring.
- `consult-flymake`: a diagnostic; `e`, `w` or `n` and `SPC` narrow to errors, warnings or notes.
- `consult-compile-error`: an error in the compilation buffers.

Switching and visiting:

- `consult-buffer`: a buffer, a recent file or a bookmark, grouped by kind; `b`, `f`, `m` or `p` and `SPC` narrow to buffers, files, bookmarks or the project's buffers and files, `*` and `SPC` to modified buffers, and `SPC SPC` to hidden ones. `consult-buffer-other-window`, `-other-frame` and `consult-project-buffer` are its kin; `consult-buffer-sources` says which sources it draws on.
- `consult-recent-file`, `consult-bookmark`.

Searching files as you type, from the project's root, or a directory you are asked for with `C-u`:

- `consult-ripgrep` (needs `rg`), `consult-grep`, and `consult-find` for file names. Input such as `#hello#wor` searches for `hello` and then filters the matches by `wor`; `consult-async-min-input` says how many characters start a search.

Text and history:

- `consult-yank-pop`, `consult-yank-from-kill-ring`: a kill to yank.
- `consult-history`, `consult-isearch-history`, `consult-complex-command`, `consult-mode-command`.
- `consult-register`, `consult-register-load`, `consult-register-store`: registers, listed with what they hold.
- `consult-theme`: a theme, tried on as you move.

While a consult prompt is open, typing a narrowing key and `SPC` on empty input narrows, and `DEL` on empty input widens again. Set `consult-narrow-key` (such as `"<"`) to narrow with that key and the narrowing key anywhere in the input.

Variables: `consult-preview-key` (`"any"`, a list of keys, or nil for no preview, with `":debounce"` to wait), `consult-narrow-key`, `consult-widen-key`, `consult-line-start-from-top`, `consult-point-placement`, `consult-buffer-filter`, `consult-ripgrep-args`, `consult-grep-args`, `consult-find-args`, `consult-async-min-input`, `consult-async-split-style`. From code, `consultCustomize(["consult-line"], { prompt: "Search: " })` changes a command's options, and `consultRead`, `consultMulti` and `consultSources` (exported by the module `consult`) let another package read with preview and narrowing, as `e8-consult-org-roam` does.

## Differences from consult.el

- Not every command is there: `consult-kmacro` (E8 keeps one keyboard macro rather than a ring), `consult-org-heading`, `consult-org-agenda`, `consult-info`, `consult-man`, `consult-locate`, `consult-fd`, `consult-git-grep`, `consult-focus-lines`, `consult-keep-lines`, `consult-minor-mode-menu`, `consult-buffer-other-tab` and `consult-completion-in-region` are not ported yet.
- `consult-line-multi` lists every line of the buffers and matches them with the completion styles, where consult.el searches them as you type.
- Lines with the same text are told apart with zero-width characters after them, rather than consult.el's private-use characters.
- Previewing `consult-yank-pop` does not show the kill in place in the buffer.
- Async searches start as soon as the input changes, without waiting out `consult-async-input-debounce`.
- `consult-xref` takes E8's xrefs, each a file, line, column, summary and group.
- `consult-flymake` reads the diagnostics from the overlays that mark them (as eglot puts them) rather than from Flymake's backends.

## Credit

This is a port to E8 of [consult](https://github.com/minad/consult) 2.8, with its `consult-imenu.el`, `consult-compile.el`, `consult-xref.el`, `consult-register.el` and `consult-flymake.el`, by Daniel Mendler and the Consult contributors, copyright the Free Software Foundation, and distributed in GNU ELPA, under the GNU General Public License version 3 or later. It is not the upstream authors' work as published, and they do not endorse it: report problems with the port here, not upstream.

## Developing

With an E8 on your PATH (a [release](https://github.com/e8-editor/e8/releases), or built from source) and TypeScript 5.8 or newer:

```bash
make test
make types
```

The tests load [e8-vertico](https://github.com/e8-editor/e8-vertico) and [e8-orderless](https://github.com/e8-editor/e8-orderless), which `make` clones into `.e8/deps`. The tests in `test/consult-tests.ts` type keys at consult's commands and check the candidates vertico lists, what the window previews meanwhile, narrowing, and where each command leaves point: consult-line, consult-buffer, consult-ripgrep as you type (skipped without `rg`), consult-goto-line, consult-yank-pop, consult-outline, consult-flymake, consult-xref, the register commands and consult-line-multi.

## Licence

GPL-3.0-or-later: see `LICENSE`.
