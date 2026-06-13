# Graph UI Agent Rules

- Work only inside this graph-ui sidecar.
- Do not read `.env`, cookies, browser profiles, private CVs, or job application
  runtime secrets.
- Do not touch job application submit/upload/send flows.
- Every owner-requested feature must be added to the current project graph as a
  node and connected to the relevant implementation or agent branch.
- New feature nodes stay unread/new until the owner clicks them in the graph UI.
- Browser QA agent writes `testFlow` and `testComments` for each feature node.
- Fixer agent patches failures reported by browser QA, then the browser QA cycle
  is rerun.
