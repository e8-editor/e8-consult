// SPDX-License-Identifier: GPL-3.0-or-later
//
// consult's tests, with ERT: its commands read with vertico and orderless,
// preview what the selection is on, and go there, as consult.el's do.
// `make test` runs them in e8 --batch, as CI does.
//
// Copyright (C) 2026 The E8 contributors

import { ertDeftest, should, shouldEqual, shouldError } from "ert";
import { executableFind } from "subr";
import "vertico";
import "orderless";
import "consult";

e8.call("vertico-mode" as e8.DefinedCommand);
e8.setVariable("completion-styles", ["orderless", "basic"]);
// project.el keeps its list of projects in a file beside init.ts, which a
// fresh machine, such as CI's, has no directory for: keep it in a temporary one.
e8.setVariable("project-list-file", e8.expandFileName("projects", e8.makeTempFile("consult-projects", { dir: true })));

/** A fresh buffer called "notes" holding `text`, made current. */
function setup(text: string): void {
  if (e8.getBuffer("notes") !== undefined) e8.call("kill-buffer", "notes");
  e8.call("switch-to-buffer", "notes");
  e8.insert(text);
}

const stringOf = (v: e8.Value | undefined): string =>
  typeof v === "string" ? v : v !== null && typeof v === "object" && "string" in v ? String(v.string) : "";

/**
 * What vertico shows after the input: the after-strings of the minibuffer's
 * overlays that end where it does, by priority, without the zero-width
 * characters that tell equal lines apart.
 */
function after(): string {
  const minibuffer = e8.windowBuffer(e8.minibufferWindow());
  if (e8.minibufferDepth() === 0 || minibuffer === undefined) return "";
  return e8.withCurrentBuffer(minibuffer, () => {
    const end = e8.pointMax();
    return e8
      .overlaysIn(e8.pointMin(), end)
      .filter((o) => e8.overlayEnd(o) === end && e8.overlayGet(o, "after-string") !== undefined)
      .sort((a, b) => Number(e8.overlayGet(a, "priority") ?? 0) - Number(e8.overlayGet(b, "priority") ?? 0) || a - b)
      .map((o) => stringOf(e8.overlayGet(o, "after-string")))
      .join("")
      .replace(/[​‌‍⁠]/g, "");
  });
}

/** What a look, on <f9>, saw while the prompt was open. */
interface Look {
  after: string;
  input: string;
  /** The point and buffer of the window that was selected when the prompt opened. */
  windowPoint: number;
  windowBuffer: string | undefined;
}

let looks: Look[] = [];
let window = 0;
/** What <f8> waits for vertico to show. */
let waitingFor = "";

const look = e8.defineCommand({
  name: "consult-tests-look",
  doc: "Note what the prompt shows, for a test.",
  run: () => {
    looks.push({ after: after(), input: e8.minibufferContents(), windowPoint: e8.windowPoint(window), windowBuffer: e8.windowBuffer(window) });
  },
});
const wait = e8.defineCommand({
  name: "consult-tests-wait",
  doc: "Wait up to 10 seconds for an async search's output to show, for a test.",
  run: () => {
    const start = Date.now();
    while (!after().includes(waitingFor) && Date.now() - start < 10000) e8.acceptProcessOutput(undefined, 0.05);
  },
});
e8.defineKey("global-map", "<f9>", look);
e8.defineKey("global-map", "<f8>", wait);

/**
 * Runs `command` from <f5>, after `prefix` keys such as "C-u ", and types `keys` after it, all in one macro, as a
 * prompt left open in e8 --batch would read from stdin; each <f9> among the
 * keys looks at the prompt.
 */
function run(command: e8.CommandName | e8.DefinedCommand, keys: string, prefix = ""): Look[] {
  e8.defineKey("global-map", "<f5>", command);
  window = e8.selectedWindow();
  looks = [];
  e8.executeKbdMacro(`${prefix}<f5> ${keys}`);
  shouldEqual(e8.minibufferDepth(), 0, "the prompt is closed");
  return looks;
}

/** A directory of its own for a test, holding `files`, removed after `body`. */
function withFiles(files: Record<string, string>, body: (dir: string) => void): void {
  const dir = e8.fileNameAsDirectory(e8.fileTruename(e8.makeTempFile("consult-tests", { dir: true })));
  try {
    for (const [name, text] of Object.entries(files)) e8.writeRegion(text, null, dir + name, { quiet: true });
    body(dir);
  } finally {
    for (const name of Object.keys(files)) {
      const buffer = e8.bufferList().find((b) => e8.withCurrentBuffer(b, () => e8.bufferFileName()) === dir + name);
      if (buffer !== undefined) e8.call("kill-buffer", e8.bufferName(buffer) ?? "");
    }
    e8.deleteDirectory(dir, { recursive: true });
  }
}

ertDeftest("consult-line-previews-lines-and-goes-to-the-match", () => {
  setup("alpha one\n\nbeta two\ngamma three\nbeta four\n");
  e8.gotoChar(0);
  const looks = run("consult-line" as e8.DefinedCommand, "<f9> b e t a SPC f o <f9> RET");
  // The non-blank lines, numbered.
  shouldEqual(looks[0].after, " \n1 alpha one\n3 beta two\n4 gamma three\n5 beta four\n");
  shouldEqual(looks[1].after, " \n5 beta four\n");
  // The window selected when the prompt opened shows the line meanwhile.
  const line5 = "alpha one\n\nbeta two\ngamma three\n".length;
  shouldEqual(looks[1].windowPoint, line5);
  shouldEqual(e8.point(), line5);
});

ertDeftest("consult-line-quit-leaves-point-where-it-was", () => {
  setup("alpha one\nbeta two\ngamma three\n");
  e8.gotoChar(3);
  shouldError(() => run("consult-line" as e8.DefinedCommand, "g a m C-g"), { type: "quit" });
  shouldEqual(e8.minibufferDepth(), 0, "the prompt is closed");
  shouldEqual(e8.point(), 3);
  shouldEqual(e8.bufferName(), "notes");
});

ertDeftest("consult-buffer-narrows-previews-and-switches", () => {
  setup("");
  e8.getBufferCreate("apples");
  e8.getBufferCreate("bananas");
  e8.setVariable("recentf-mode", true);
  e8.setVariable("recentf-list", ["/tmp/e8-consult-recent.txt"]);
  const looks = run("consult-buffer" as e8.DefinedCommand, "<f9> b SPC <f9> b a n <f9> RET");
  const shown = looks[0].after;
  should(shown.includes("Buffer") && shown.includes("apples") && shown.includes("bananas"), shown);
  should(shown.includes("File") && shown.includes("/tmp/e8-consult-recent.txt"), shown);
  // b SPC narrows to buffers, and leaves the input empty.
  should(!looks[1].after.includes("e8-consult-recent"), looks[1].after);
  shouldEqual(looks[1].input, "");
  // The selected window shows the buffer the selection is on.
  shouldEqual(looks[2].windowBuffer, "bananas");
  shouldEqual(e8.bufferName(), "bananas");
});

ertDeftest("consult-ripgrep-searches-as-you-type", () => {
  if (executableFind("rg") === undefined) {
    e8.message("No rg: skipped");
    return;
  }
  withFiles({ "a.txt": "nothing here\nhello world\n", "b.txt": "say hello\n" }, (dir) => {
    setup("");
    e8.makeLocalVariable("default-directory");
    e8.setVariable("default-directory", dir);
    waitingFor = "hello world";
    const looks = run("consult-ripgrep" as e8.DefinedCommand, "h e l l o <f8> <f9> # w o r <f9> RET");
    const shown = looks[0].after;
    should(shown.includes("a.txt") && shown.includes("2:hello world") && shown.includes("b.txt"), shown);
    // #hello#wor filters the matches.
    should(!looks[1].after.includes("say hello"), looks[1].after);
    shouldEqual(e8.bufferName(), "a.txt");
    shouldEqual(e8.lineOf(e8.point()), 1);
  });
});

ertDeftest("consult-goto-line-goes-to-the-line", () => {
  setup("one\ntwo\nthree\nfour\n");
  run("consult-goto-line" as e8.DefinedCommand, "3 RET");
  shouldEqual(e8.point(), "one\ntwo\n".length);
});

ertDeftest("consult-yank-pop-yanks-the-kill-chosen", () => {
  setup("");
  e8.killNew("first kill");
  e8.killNew("second kill");
  const looks = run("consult-yank-pop" as e8.DefinedCommand, "<f9> f i r RET");
  shouldEqual(looks[0].after, " \nsecond kill\nfirst kill\n");
  shouldEqual(e8.bufferText(), "first kill");
});

ertDeftest("consult-outline-goes-to-a-heading-and-digits-narrow-by-level", () => {
  setup("* One\ntext\n** Two\n* Three\n");
  e8.call("org-mode");
  const looks = run("consult-outline" as e8.DefinedCommand, "<f9> 1 SPC <f9> T h r RET");
  shouldEqual(looks[0].after, " \n1 * One\n3 ** Two\n4 * Three\n");
  shouldEqual(looks[1].after, " \n1 * One\n4 * Three\n");
  shouldEqual(e8.point(), "* One\ntext\n** Two\n".length);
});

ertDeftest("consult-flymake-lists-the-diagnostics-and-goes-to-one", () => {
  setup("let a = 1;\nlet b = 2;\nlet c = 3;\n");
  e8.makeOverlay(15, 16, { face: "flymake-error", "flymake-diagnostic": "unused b" });
  e8.makeOverlay(26, 27, { face: "flymake-warning", "flymake-diagnostic": "odd c" });
  const looks = run("consult-flymake" as e8.DefinedCommand, "<f9> w SPC <f9> RET");
  shouldEqual(looks[0].after, " \n   2:4   error   unused b\n   3:4   warning odd c\n");
  shouldEqual(looks[1].after, " \n   3:4   warning odd c\n");
  shouldEqual(e8.point(), 26);
});

ertDeftest("consult-xref-reads-a-place-for-xref", () => {
  withFiles({ "x.rs": "fn a() {}\nfn b() { a(); }\nfn c() { a(); }\n" }, (dir) => {
    setup("");
    const file = dir + "x.rs";
    const xref = e8.defineCommand({
      name: "consult-tests-xref",
      doc: "Choose between two references with consult-xref, for a test.",
      run: () =>
        e8.funcall("consult-xref", [
          { file, line: 2, col: 9, summary: "fn b() { a(); }", group: "x.rs" },
          { file, line: 3, col: 9, summary: "fn c() { a(); }", group: "x.rs" },
        ]),
    });
    const looks = run(xref, "<f9> c RET");
    const shown = looks[0].after;
    should(shown.includes("x.rs") && shown.includes("2: fn b() { a(); }") && shown.includes("3: fn c() { a(); }"), shown);
    shouldEqual(e8.bufferName(), "x.rs");
    shouldEqual(e8.point(), "fn a() {}\nfn b() { a(); }\n".length + 9);
  });
});

// Before the next test, which stores register x.
ertDeftest("consult-register-lists-registers-and-loads-one", () => {
  setup("first line\nsecond line\n");
  e8.gotoChar(13);
  e8.executeKbdMacro("C-x r SPC a");
  e8.setMark(0);
  e8.gotoChar(5);
  e8.activateMark();
  e8.executeKbdMacro("C-x r s b");
  e8.gotoChar(0);
  const looks = run("consult-register" as e8.DefinedCommand, "<f9> t SPC <f9> DEL C-p RET");
  shouldEqual(looks[0].after, " \na notes: second line\nb first\n");
  // t SPC narrows to text.
  shouldEqual(looks[1].after, " \nb first\n");
  shouldEqual(e8.point(), 13);
});

ertDeftest("consult-register-store-and-load-take-a-key", () => {
  setup("hello there\n");
  e8.gotoChar(6);
  run("consult-register-store" as e8.DefinedCommand, "x");
  e8.gotoChar(0);
  run("consult-register-load" as e8.DefinedCommand, "x");
  shouldEqual(e8.point(), 6);
});

ertDeftest("consult-line-multi-searches-every-buffer", () => {
  setup("apple in notes\n");
  if (e8.getBuffer("other") !== undefined) e8.call("kill-buffer", "other");
  e8.withCurrentBuffer(e8.getBufferCreate("other"), () => e8.insert("apple elsewhere\npear\n"));
  // C-u: every buffer, not only the project's.
  const looks = run("consult-line-multi" as e8.DefinedCommand, "a p p <f9> SPC e l s RET", "C-u ");
  const shown = looks[0].after;
  should(shown.includes("notes") && shown.includes("apple in notes") && shown.includes("other") && shown.includes("apple elsewhere") && !shown.includes("pear"), shown);
  shouldEqual(e8.bufferName(), "other");
});
