import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fieldErrorId,
  firstErrorKey,
  focusFirstFieldError,
  type FieldErrors,
} from '../src/lib/formErrors.ts';

type FakeElement = {
  tagName: string;
  attributes: Map<string, string>;
  nested: FakeElement | null;
  scrollCalls: unknown[];
  focusCalls: unknown[];
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  querySelector(): FakeElement | null;
  scrollIntoView(options?: unknown): void;
  focus(options?: unknown): void;
};

function fakeElement(tagName: string, nested: FakeElement | null = null): FakeElement {
  return {
    tagName,
    attributes: new Map(),
    nested,
    scrollCalls: [],
    focusCalls: [],
    hasAttribute(name) {
      return this.attributes.has(name);
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    querySelector() {
      return this.nested;
    },
    scrollIntoView(options) {
      this.scrollCalls.push(options);
    },
    focus(options) {
      this.focusCalls.push(options);
    },
  };
}

test('firstErrorKey follows visual field order', () => {
  const errors: FieldErrors = { email: 'Invalid email', name: 'Required' };

  assert.equal(firstErrorKey(['name', 'email'], errors), 'name');
  assert.equal(firstErrorKey(['turnstile'], errors), undefined);
  assert.equal(fieldErrorId('traveler-0'), 'traveler-0-error');
});

test('focusFirstFieldError scrolls and focuses the first nested control', () => {
  const input = fakeElement('INPUT');
  const anchor = fakeElement('DIV', input);
  const selectors: string[] = [];
  const root = {
    querySelector(selector: string) {
      selectors.push(selector);
      return anchor;
    },
  };

  focusFirstFieldError(
    ['name', 'email'],
    { email: 'Invalid email', name: 'Required' },
    root as unknown as ParentNode,
  );

  assert.deepEqual(selectors, ['[data-field-error="name"]']);
  assert.deepEqual(anchor.scrollCalls, [{ behavior: 'smooth', block: 'center' }]);
  assert.deepEqual(input.focusCalls, [{ preventScroll: true }]);
});

test('focusFirstFieldError only scrolls a non-focusable error anchor', () => {
  const anchor = fakeElement('DIV');
  const root = {
    querySelector() {
      return anchor;
    },
  };

  focusFirstFieldError(
    ['turnstile'],
    { turnstile: 'Complete the anti-spam check' },
    root as unknown as ParentNode,
  );

  assert.equal(anchor.scrollCalls.length, 1);
  assert.equal(anchor.focusCalls.length, 0);
});

test('focusFirstFieldError honors scroll-only anchors with nested buttons', () => {
  const button = fakeElement('BUTTON');
  const anchor = fakeElement('DIV', button);
  anchor.attributes.set('data-error-scroll-only', '');
  const root = {
    querySelector() {
      return anchor;
    },
  };

  focusFirstFieldError(
    ['departure'],
    { departure: 'Choose a departure' },
    root as unknown as ParentNode,
  );

  assert.equal(anchor.scrollCalls.length, 1);
  assert.equal(button.focusCalls.length, 0);
});
