---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-03T19:28:19.549Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 08 | todo | apps/mobile/components/home/TrendChart.tsx |  | matchFont for JetBrainsMono_500Medium axis labels likely never resolves on-device (same root cause as ShareCardCanvas fix in 08-04) -- verify axis date labels actually render, switch to useFont if not | open |  | 2026-08-03T19:28:19.549Z |  |

````json
[
  {
    "id": 1,
    "kind": "todo",
    "phase": "08",
    "file": "apps/mobile/components/home/TrendChart.tsx",
    "line": null,
    "description": "matchFont for JetBrainsMono_500Medium axis labels likely never resolves on-device (same root cause as ShareCardCanvas fix in 08-04) -- verify axis date labels actually render, switch to useFont if not",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-03T19:28:19.549Z",
    "resolved_at": null
  }
]
````
