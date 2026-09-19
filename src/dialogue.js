// A dialogue owns its writer and destroys it when the dialogue closes or changes.
export class Typewriter {
  constructor(element, { text = '', interval = 32, onDone } = {}) {
    if (!element) throw new TypeError('대사를 표시할 요소가 필요합니다.');
    this.element = element;
    this.text = String(text ?? '');
    this.characters = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(this.text), part => part.segment)
      : Array.from(this.text);
    this.interval = Number.isFinite(interval) ? Math.max(8, interval) : 32;
    this.onDone = typeof onDone === 'function' ? onDone : null;
    this.index = 0;
    this.timer = null;
    this.started = false;
    this.done = false;
    this.destroyed = false;
  }

  start() {
    if (this.started || this.destroyed) return this;
    this.started = true;
    this.element.textContent = '';
    this.advanceOne();
    this.schedule();
    return this;
  }

  schedule() {
    if (this.done || this.destroyed || this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.advanceOne();
      this.schedule();
    }, this.interval);
  }

  advanceOne() {
    if (!this.started || this.done || this.destroyed) return false;
    if (this.index < this.characters.length) this.element.textContent += this.characters[this.index++];
    if (this.index === this.characters.length) this.complete();
    return true;
  }

  finish() {
    if (this.done || this.destroyed) return;
    this.started = true;
    this.index = this.characters.length;
    this.element.textContent = this.text;
    this.complete();
  }

  complete() {
    clearTimeout(this.timer);
    this.timer = null;
    this.done = true;
    const callback = this.onDone;
    this.onDone = null;
    callback?.();
  }

  destroy() {
    clearTimeout(this.timer);
    this.timer = null;
    this.onDone = null;
    this.destroyed = true;
  }
}
