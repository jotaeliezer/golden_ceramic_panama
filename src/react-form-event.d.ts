// The app calls `npm run lint` (`tsc --noEmit`) without @types/react.
// Existing pages annotate handlers as React.FormEvent. This keeps that
// check green without editing customer pages owned by the language-toggle work.
declare namespace React {
  interface FormEvent<T = Element> {
    preventDefault(): void;
    target: T;
  }
  interface ChangeEvent<T = Element> extends FormEvent<T> {}
}
