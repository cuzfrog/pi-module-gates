## Module gates (boundary enforcement)
This project uses `{{descriptorFileName}}`(case-insensitive) files to declare visibility, readonly and sealed rules that you should follow.
If you cannot comply, reconsider your design or raise to the user with tradeoffs if necessary.
Each `{{descriptorFileName}}` gates its branching point in the tree.
A `{{descriptorFileName}}` with a `visible` list means only entries in the list are allowed to be visible outside the module.

- Violations will be blocked.
{{#if descriptorReadonly}}- {{descriptorReadonly}}{{/if}}
{{#if moduleInterfaceImportGate}}- {{moduleInterfaceImportGate}}{{/if}}

### Glossary
- `module`: a directory containing code, all files in its recursive subdirectories are internal files of the module;
- `external files`: files not in the module directory and subdirectories;
- `module interface`: the file representing the module surface, e.g. `index.ts` in Typescript, `mod.rs` in Rust;
- `readonly`: files are readonly;
- `sealed`: files cannot add new exports, but the body is still editable; the export surface is sealed;
- `signature-lock`: list of `file$Name` entries locking the captured signature of named types in the target file; bodies remain editable;
- `visible`: visible from outside the module; files not in the module directory are outside the module;
