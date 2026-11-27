// A fake of the Google Docs DocumentApp, as much as the printed bulletin
// uses. It records what the renderers build (tables, column widths, cell
// padding, paragraphs, each character's font, size and weight, images, rules
// and page breaks) so build.cjs can draw it. It never talks to Google.
//
// Any method or enum value it doesn't have throws, and is listed in
// `unknown`, so a renderer that starts using something new fails here
// instead of being drawn wrong.
'use strict';

const DEFAULT_STYLE = Object.freeze({ size: 11, font: 'Arial', bold: false, italic: false, underline: false });

function guard(obj, kind, unknown) {
  return new Proxy(obj, {
    get(target, prop) {
      if (prop in target || typeof prop === 'symbol') return target[prop];
      unknown.add(kind + '.' + String(prop));
      return () => {
        throw new Error(`The fake Google Docs has no ${kind}.${String(prop)}; add it to tools/printed-bulletin-preview/fake-document-app.cjs`);
      };
    },
  });
}

function guardEnum(values, kind, unknown) {
  return new Proxy(Object.freeze(values), {
    get(target, prop) {
      if (prop in target || typeof prop === 'symbol') return target[prop];
      unknown.add(kind + '.' + String(prop));
      throw new Error(`The fake Google Docs has no ${kind}.${String(prop)}; add it to tools/printed-bulletin-preview/fake-document-app.cjs`);
    },
  });
}

function createDocumentModel() {
  const unknown = new Set();
  let nextId = 1;

  function makeImage(blob, paragraph) {
    const record = { type: 'image', w: blob.w, h: blob.h };
    const api = guard({
      getWidth: () => record.w,
      getHeight: () => record.h,
      setWidth: (w) => { record.w = w; return api; },
      setHeight: (h) => { record.h = h; return api; },
      getParent: () => paragraph,
    }, 'InlineImage', unknown);
    return { record, api };
  }

  class Paragraph {
    constructor(text, parent) {
      this.kind = 'P';
      this.id = nextId++;
      this.parent = parent;
      this.base = { ...DEFAULT_STYLE };
      this.setTextRaw(String(text || ''));
      this.align = 'LEFT';
      this.lineSpacing = 1.15;
      this.spacingBefore = 0;
      this.spacingAfter = 0;
      this.inline = []; // { type: 'image' | 'pagebreak' | 'hr', ... }
      this.indentStart = 0;
      this.indentFirstLine = null;
      this.indentEnd = 0;
      return guard(this, 'Paragraph', unknown);
    }

    setTextRaw(text) {
      this.text = text;
      this.chars = Array.from({ length: text.length }, () => ({ ...this.base }));
    }

    getType() { return 'PARAGRAPH'; }
    asParagraph() { return this; }
    getParent() { return this.parent; }
    getText() { return this.text; }
    setText(text) { this.setTextRaw(String(text)); return this; }
    setAlignment(a) { this.align = a; return this; }
    setLineSpacing(v) { this.lineSpacing = v; return this; }
    setSpacingBefore(v) { this.spacingBefore = v; return this; }
    setSpacingAfter(v) { this.spacingAfter = v; return this; }
    setIndentStart(v) { this.indentStart = v; return this; }
    setIndentFirstLine(v) { this.indentFirstLine = v; return this; }
    setIndentEnd(v) { this.indentEnd = v; return this; }

    setAttributes(attrs) {
      Object.keys(attrs).forEach((key) => {
        const value = attrs[key];
        if (key === 'FONT_SIZE') {
          this.base.size = value;
          this.chars.forEach((c) => { c.size = value; });
        } else if (key === 'LINE_SPACING') this.lineSpacing = value;
        else if (key === 'SPACING_BEFORE') this.spacingBefore = value;
        else if (key === 'SPACING_AFTER') this.spacingAfter = value;
        else {
          unknown.add('Attribute.' + key);
          throw new Error(`The fake Google Docs can't set the ${key} attribute; add it to tools/printed-bulletin-preview/fake-document-app.cjs`);
        }
      });
      return this;
    }

    editAsText() { return new Text(this); }
    appendHorizontalRule() { const hr = { type: 'hr', getParent: () => this }; this.inline.push(hr); return hr; }
    appendPageBreak() { const pb = { type: 'pagebreak', getParent: () => this }; this.inline.push(pb); return pb; }
    appendInlineImage(blob) { const img = makeImage(blob, this); this.inline.push(img.record); return img.api; }
    removeFromParent() {
      const kids = this.parent.children;
      kids.splice(kids.indexOf(this), 1);
      this.parent = null;
    }
    getNumChildren() { return this.inline.length; }
  }

  class Text {
    constructor(p) { this.p = p; return guard(this, 'Text', unknown); }
    getText() { return this.p.text; }
    apply(args, key) {
      const p = this.p;
      if (args.length === 1) {
        p.base[key] = args[0];
        p.chars.forEach((c) => { c[key] = args[0]; });
        return this;
      }
      const [start, end, value] = args;
      if (!(start >= 0 && end >= start && end < p.text.length)) {
        // Docs throws on a range outside the text, so the fake does too.
        throw new Error(`Text range ${start}-${end} is outside "${p.text}" (${key})`);
      }
      for (let i = start; i <= end; i += 1) p.chars[i][key] = value;
      return this;
    }
    setFontSize(...a) { return this.apply(a, 'size'); }
    setBold(...a) { return this.apply(a, 'bold'); }
    setItalic(...a) { return this.apply(a, 'italic'); }
    setUnderline(...a) { return this.apply(a, 'underline'); }
    setFontFamily(...a) { return this.apply(a, 'font'); }
  }

  class Container {
    constructor(kind) {
      this.kind = kind;
      this.id = nextId++;
      this.children = [];
    }
    getNumChildren() { return this.children.length; }
    getChild(i) { return this.children[i]; }
    appendParagraph(text) { const p = new Paragraph(text, this); this.children.push(p); return p; }
    appendTable(rows) { const t = new Table(rows, this); this.children.push(t); return t; }
    appendHorizontalRule() {
      const p = new Paragraph('', this);
      const hr = { type: 'hr', getParent: () => p };
      p.inline.push(hr);
      this.children.push(p);
      return hr;
    }
    appendImage(blob) {
      const p = new Paragraph('', this);
      this.children.push(p);
      const img = makeImage(blob, p);
      p.inline.push(img.record);
      return img.api;
    }
    appendPageBreak() {
      const p = new Paragraph('', this);
      this.children.push(p);
      return p.appendPageBreak();
    }
  }

  class Body extends Container {
    constructor() {
      super('BODY');
      this.page = {};
      return guard(this, 'Body', unknown);
    }
    clear() { this.children = [new Paragraph('', this)]; return this; }
    setPageWidth(v) { this.page.width = v; return this; }
    setPageHeight(v) { this.page.height = v; return this; }
    setMarginTop(v) { this.page.top = v; return this; }
    setMarginBottom(v) { this.page.bottom = v; return this; }
    setMarginLeft(v) { this.page.left = v; return this; }
    setMarginRight(v) { this.page.right = v; return this; }
  }

  class Cell extends Container {
    constructor(text, row) {
      super('CELL');
      this.row = row;
      this.padding = { top: 5, bottom: 5, left: 5, right: 5 };
      this.valign = 'TOP';
      this.children = [new Paragraph(text, this)];
      return guard(this, 'TableCell', unknown);
    }
    getType() { return 'TABLE_CELL'; }
    clear() { this.children = [new Paragraph('', this)]; return this; }
    setPaddingTop(v) { this.padding.top = v; return this; }
    setPaddingBottom(v) { this.padding.bottom = v; return this; }
    setPaddingLeft(v) { this.padding.left = v; return this; }
    setPaddingRight(v) { this.padding.right = v; return this; }
    setVerticalAlignment(v) { this.valign = v; return this; }
  }

  class Table {
    constructor(rows, parent) {
      this.kind = 'TABLE';
      this.id = nextId++;
      this.parent = parent;
      this.borderWidth = 1;
      this.borderColor = '#000000';
      this.widths = {};
      this.rows = rows.map((r) => {
        const row = { cells: [] };
        row.cells = r.map((text) => new Cell(text, row));
        return row;
      });
      return guard(this, 'Table', unknown);
    }
    getType() { return 'TABLE'; }
    setBorderWidth(v) { this.borderWidth = v; return this; }
    setBorderColor(v) { this.borderColor = v; return this; }
    setColumnWidth(i, w) { this.widths[i] = w; return this; }
    getCell(r, c) { return this.rows[r].cells[c]; }
    getRow(r) {
      const row = this.rows[r];
      return guard({ getCell: (c) => row.cells[c], getNumCells: () => row.cells.length }, 'TableRow', unknown);
    }
    getNumRows() { return this.rows.length; }
  }

  const DocumentApp = guard({
    ElementType: guardEnum({ PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE', TABLE_CELL: 'TABLE_CELL' }, 'ElementType', unknown),
    HorizontalAlignment: guardEnum({ LEFT: 'LEFT', CENTER: 'CENTER', RIGHT: 'RIGHT', JUSTIFY: 'JUSTIFY' }, 'HorizontalAlignment', unknown),
    VerticalAlignment: guardEnum({ TOP: 'TOP', CENTER: 'CENTER', BOTTOM: 'BOTTOM' }, 'VerticalAlignment', unknown),
    Attribute: guardEnum({
      FONT_SIZE: 'FONT_SIZE',
      LINE_SPACING: 'LINE_SPACING',
      SPACING_BEFORE: 'SPACING_BEFORE',
      SPACING_AFTER: 'SPACING_AFTER',
    }, 'Attribute', unknown),
  }, 'DocumentApp', unknown);

  return { DocumentApp, createBody: () => new Body(), unknown };
}

module.exports = { createDocumentModel, DEFAULT_STYLE };
