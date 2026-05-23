---
visible:
  - path: Foo
    modifier: pub(super)
  - path: Bar
    modifier: pub(crate)
  - Baz
---

Modifier-lock module. `Foo` must be `pub(super)`, `Bar` must be `pub(crate)`, `Baz` has no modifier constraint.
