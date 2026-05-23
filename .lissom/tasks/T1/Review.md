# Review - T1 Implementation

## Round 1 Issues (all resolved)

### 1. Denial message format mismatch (readonly) - FIXED
**File:** `src/gates/readonly-gate.ts`  
Added `Readonly rule: ` prefix to match plan format.

### 2. Denial message format mismatch (exports bullet) - FIXED
**File:** `src/gates/export-gate.ts`  
Changed `-` to `\u2022` (bullet) to match plan format.

### 3. `validateVisibleEntries` was a no-op stub - FIXED
**File:** `src/index.ts`  
Replaced stub with real implementation that reads module files, extracts exports using the checker registry, and warns on dangling entries.

### 4. Unused `stat` import - FIXED
**File:** `src/graph/module-index-builder.ts`  
Removed unused import.

### 5. Unused type import `ToolCallEvent` - FIXED
**File:** `src/index.ts`  
Removed unused import.

### 6. Unused `cwd` parameter - FIXED
**File:** `src/graph/module-index-builder.ts`  
Removed unused `cwd` parameter from `buildContracts` and `buildFileToModuleMap`.

## Round 2 Review

All issues resolved. Type check passes, 49/49 tests pass.

## Deferred

- E2E tests (`test/e2e` using `pi -p`) — deferred per plan scope.
