export const defaultLanguage = "uk";

export function normalizeLanguage(value) {
  const clean = String(value || "").toLowerCase();
  return clean.startsWith("en") ? "en" : "uk";
}

const graphLabels = {
  uk: {
    "job-apply-full": "Повний TZ граф JobApply",
    "job-apply-product": "Продуктовий TZ граф JobApply",
    "server-telemetry": "TZ граф серверної телеметрії",
    "current-project-learning": "Навчальний граф поточного проекту",
  },
  en: {
    "job-apply-full": "JobApply full TZ graph",
    "job-apply-product": "JobApply product TZ graph",
    "server-telemetry": "Server telemetry hub TZ graph",
    "current-project-learning": "Current project learning graph",
  },
};

const groupLabels = {
  uk: {
    product: "Продукт / TZ",
    project: "Проект",
    learn: "Як користуватись",
    discovery: "Пошук",
    platform: "Платформи",
    data: "Дані",
    safety: "Безпека",
    operations: "Операції",
    ui: "Інтерфейси",
    interface: "Інтерфейси",
    visual: "Візуальні ключі",
    observability: "Спостереження",
    quality: "Якість",
    agent_branch: "Гілка агента",
    subagent_task: "Задачі субагентів",
    next: "Далі",
  },
  en: {
    product: "Product / TZ",
    project: "Project",
    learn: "How to use",
    discovery: "Discovery",
    platform: "Platforms",
    data: "Data",
    safety: "Safety gates",
    operations: "Operations",
    ui: "Interfaces",
    interface: "Interfaces",
    visual: "Visual keys",
    observability: "Observability",
    quality: "Quality",
    agent_branch: "Agent branch",
    subagent_task: "Sub-agent tasks",
    next: "Next",
  },
};

const workflowLabels = {
  uk: {
    not_done: "1. Не зроблено",
    approved: "2. Заапрувлено у роботу",
    in_progress: "3. У роботі",
    ready_for_test: "4. Для тестування",
    testing_agent: "5. Тестує агент",
    tested_agent: "6. Перевірено агентом",
    tested_human: "7. Перевірено людиною",
  },
  en: {
    not_done: "1. Not done",
    approved: "2. Approved for work",
    in_progress: "3. In progress",
    ready_for_test: "4. Ready for testing",
    testing_agent: "5. Agent testing",
    tested_agent: "6. Agent verified",
    tested_human: "7. Human verified",
  },
};

const nodeUk = {
  "main:goal": ["MVP copilот для job application", "Одна локальна система, яка знаходить релевантні вакансії, готує адаптовані повідомлення, просить власника про апрув і надсилає тільки через явно дозволені gated flows."],
  "main:graph_tz": ["Граф як TZ", "Перетворювати цю мапу функцій на головне джерело правди для вимог, рішень власника, блокерів і призначень агентів."],
  "main:source_scan": ["Сканування всіх сайтів", "Оновлює всі налаштовані джерела: Djinni inbox/відповіді рекрутерів, публічні вакансії DOU, Work.ua і Robota.ua, після чого перебудовує CSV кандидатів."],
  "main:djinni": ["Djinni", "Читає дозволені публічні рядки вакансій, сканує видимий власнику inbox, знаходить блокери профілю і підтримує gated final application submit."],
  "main:workua": ["Work.ua", "Знаходить публічні вакансії, готує рядки для рев'ю, підтримує оновлення резюме/профілю і gated browser submit automation для точних затверджених URL."],
  "main:dou": ["DOU", "Перетворює listings у точні URL вакансій, готує outreach і передає точно затверджені рядки через DOU CSV adapter."],
  "main:robotaua": ["Robota.ua", "Знаходить публічні вакансії і працює з live apply form тільки через явні gates для upload резюме і cover letter."],
  "main:resume_index": ["Індекс резюме", "Підтримує локальні metadata і теги резюме для matching. Приватний контент не читається і не upload-иться без bounded task та approval."],
  "main:shared_db": ["Спільна база вакансій", "SQLite джерело вакансій, outreach drafts, status events, blockers і progress graph rows, спільне для web і Telegram."],
  "main:message_qa": ["QA gate повідомлень", "Блокує низькоякісні cover letters: чужі імена, витік назв файлів, agentic phrases, дубльовані привітання, забруднені titles або відсутній точний approval."],
  "main:approval": ["Approval gates", "Кожне live send потребує точний URL, точне повідомлення, salary/profile/resume policy, row approval і final-submit permission."],
  "main:blockers": ["Цикл блокерів", "Класифікує блокери, пише unresolved blocker artifacts, пропонує ручні й автоматичні шляхи вирішення та показує їх у progress і Telegram."],
  "main:web": ["Web інтерфейс", "Локальний UI для сканування, рев'ю, approval, prepare/send, перегляду sent applications, blockers, progress і цього function graph."],
  "main:telegram": ["Telegram bot", "Паралельний інтерфейс власника для щоденних 10:00 scans, status, approvals, blocker notices, auto-reply notices і all-site approved sends."],
  "main:progress": ["Граф прогресу", "LangGraph-style progress view зі stages, jobs, outreach drafts, blockers, edges і recent events."],
  "main:sent": ["Надіслані заявки", "Агрегує успішні або post-submit-inferred application events з усіх platform logs."],
  "main:testing": ["Крос-тестування", "Змінений функціонал тестується на всіх зачеплених flows перед commit: unit tests, compile checks, browser UI smoke і live-safe dry/prepare paths."],
  "server:sth-goal": ["Хаб серверної телеметрії", "VPS-hosted observability, coordination і decision hub для job_apply_automation. Локальні машини зберігають logged-in browser sessions і live job-site interaction."],
  "server:sth-repo-layout": ["Ізольований server subpackage", "Тримати MVP у цьому repo в server/telemetry_hub/{api,dashboard,graph,telegram,storage,deploy}; не змішувати server handlers із src/job_apply_web.py."],
  "server:sth-api-events": ["POST /api/v1/events", "Приймає append-only telemetry envelopes з auth, idempotency key, body digest replay protection, safe payload validation і без secret/private text fields."],
  "server:sth-api-runs": ["Runs and blockers API", "Реалізує POST /api/v1/job-runs, POST /api/v1/blockers, GET /api/v1/runs і GET /api/v1/blockers для безпечних status summaries."],
  "server:sth-api-health": ["GET /api/v1/health", "Показує status, version, DB connectivity і migration version без витоку config values."],
  "server:sth-local-client": ["Локальний telemetry client", "Додає local append-only retry queue і safe telemetry sender. Local workflows fail open, якщо server telemetry недоступна."],
  "server:sth-storage-migrations": ["SQLite migrations", "Створює migration system для telemetry_events, job_runs, blockers, graph_nodes, graph_edges, graph_comments, graph_events, api_clients і schema_migrations."],
  "server:sth-auth": ["Machine API auth", "Використовує per-machine bearer tokens, згенеровані поза git; зберігає тільки token hashes; підтримує scopes telemetry:write, graph:read, graph:write, dashboard:read, telegram:command."],
  "server:sth-privacy-validator": ["Privacy validator", "Відхиляє або редагує заборонені telemetry fields: secrets, cookies, browser state, resume text, raw private messages, local private paths і oversized payloads."],
  "server:sth-deploy-gate": ["Явний deploy gate", "Не підключатись до VPS, не просити credentials, не push/deploy, доки parent явно не відкриє deploy gate."],
  "server:sth-graph-model": ["Редагована модель графа", "Зберігає nodes, edges, comments і graph events. Nodes підтримують id/type/title/status/owner/priority/parent_id/timestamps."],
  "server:sth-graph-api": ["Graph API", "Реалізує GET /api/v1/graph і POST /api/v1/graph/updates для node edits, status changes, assignment, subtasks, edges і comments."],
  "server:sth-dashboard": ["Server dashboard", "Server web page подібна до local UI: runs, blockers, graph, task comments, task status/owner edits і subtasks. Без local browser apply actions."],
  "server:sth-telegram": ["Server Telegram coordination bot", "Реалізує /status, /tasks, /blockers, /task <id>, /comment <id> <text>, /approve <id>, /assign <id> <agent>, /done <id>. Не виконує browser/apply workflows."],
  "server:sth-deploy-layout": ["VPS deploy layout", "Ціль: /var/www/vps2.happyuser.info/job_apply_automation/{app,releases,current,data,config,run,backups}; config поза git; bind локально або Unix socket behind nginx/TLS."],
  "server:sth-tests": ["Server tests", "Покриває auth rejection, event validation, idempotency replay, graph edits/comments/subtasks, Telegram command parsing і migrations from empty DB."],
};

const nodeEn = {
  "learn:goal": ["Learn to manage TZ through a graph", "A separate learning graph for the current graph-ui project: focus branches, inspect details gradually, add nodes, edges, visual keys, and agent-branch subtrees."],
  "learn:focus_first": ["1. Focus first", "Do not read the whole TZ. Open the graph, filter by group or status, pick one node, and inspect only nearby links."],
  "learn:inspect_node": ["2. Inspect a node", "Clicking a node shows label, group, status, owner, detail, agent branch, and visual key. This replaces long document reading."],
  "learn:add_node": ["3. Add a node", "A new node should have id, label, group, status, owner, detail, and color. It should represent one action, decision, artifact, or question."],
  "learn:add_edge": ["4. Add a thread edge", "An edge explains how data, decisions, or artifacts move between nodes. Edge labels should be short: feeds, verifies, updates, blocks, explains."],
  "ui:babylon": ["Variant A: Babylon 3D", "3D force graph for feeling the TZ web: spring attraction, repulsion, hover/click details, pause/reset/search/group controls."],
  "ui:cytoscape": ["Variant 2D: Cytoscape", "Main learning mode: filters, layouts, node focus, linked neighborhood, group/status/search. Best start for improving the graph."],
  "ui:flow_b": ["Variant B: Flow cards", "ReactFlow-style cards without dependency: lanes, handles, SVG edges, minimap, visual preview slots for dense readable work."],
};

const phraseUk = [
  [/^Task:\s*/g, "Задача: "],
  [/^Variant A:\s*/g, "Варіант A: "],
  [/^Variant B:\s*/g, "Варіант B: "],
  [/^Variant 2D:\s*/g, "Варіант 2D: "],
  [/Current project/g, "Поточний проект"],
  [/right-click context menu/gi, "контекстне меню правого кліку"],
  [/context menu/gi, "контекстне меню"],
  [/browser QA agent/gi, "browser QA агент"],
  [/visual keys?/gi, "візуальні ключі"],
  [/development flow/gi, "флоу розробки"],
  [/node labels?/gi, "лейбли вузлів"],
  [/graph model/gi, "модель графа"],
  [/source of truth/gi, "джерело правди"],
  [/smoke test/gi, "smoke-тест"],
  [/layout/gi, "розкладка"],
  [/focus/gi, "фокус"],
  [/testing/gi, "тестування"],
  [/agent/gi, "агент"],
];

const phraseEn = [
  [/Навчитись/g, "Learn"],
  [/Поточний проект/g, "Current project"],
  [/Задача:\s*/g, "Task: "],
  [/Варіант/g, "Variant"],
  [/вузол/g, "node"],
  [/вузли/g, "nodes"],
  [/ребро/g, "edge"],
  [/граф/g, "graph"],
  [/візуальні ключі/g, "visual keys"],
  [/джерело правди/g, "source of truth"],
];

export function localizeGraphRegistry(entries, lang) {
  const language = normalizeLanguage(lang);
  return Object.fromEntries(
    Object.entries(entries).map(([id, graph]) => [
      id,
      { ...graph, label: graphLabels[language][id] || graph.label },
    ]),
  );
}

export function localizeGraphModel(model, lang) {
  const language = normalizeLanguage(lang);
  const copy = structuredClone(model);
  copy.language = language;
  for (const state of copy.workflowStates || []) {
    state.label = workflowLabels[language][state.id] || state.label;
  }
  for (const [id, group] of Object.entries(copy.groups || {})) {
    group.label = groupLabels[language][id] || group.label;
  }
  for (const node of copy.nodes || []) {
    localizeNode(node, language);
  }
  return copy;
}

function localizeNode(node, language) {
  const exact = language === "uk" ? nodeUk[node.id] : nodeEn[node.id];
  if (exact) {
    node.label = exact[0];
    node.detail = exact[1];
  } else {
    node.label = applyPhraseDictionary(node.label, language);
    node.detail = applyPhraseDictionary(node.detail, language);
  }
  node.groupLabel = groupLabels[language][node.group] || applyPhraseDictionary(node.groupLabel, language);
  if (node.visualKey?.label) node.visualKey.label = applyPhraseDictionary(node.visualKey.label, language);
  if (Array.isArray(node.keywords)) {
    for (const keyword of node.keywords) keyword.term = applyPhraseDictionary(keyword.term, language);
  }
}

function applyPhraseDictionary(value, language) {
  let result = String(value || "");
  const rules = language === "uk" ? phraseUk : phraseEn;
  for (const [pattern, replacement] of rules) result = result.replace(pattern, replacement);
  return result;
}
