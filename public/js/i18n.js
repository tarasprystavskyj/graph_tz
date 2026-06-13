(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const stored = localStorage.getItem("graphUiLanguage");
  const current = normalize(params.get("lang") || stored || "uk");
  localStorage.setItem("graphUiLanguage", current);

  const messages = {
    uk: {
      appTitle3d: "JobApply TZ граф 3D",
      appTitle2d: "JobApply TZ граф 2D",
      appTitleFlow: "JobApply TZ флоу-картки",
      settings: "Налаштування",
      toggleMenu: "Згорнути або розгорнути меню",
      language: "Мова",
      graphProjectMenu: "Меню графів і проектів",
      rearrangeLayout: "Перекомпонувати граф",
      contextMenuStyle: "Стиль контекстного меню",
      radialCytoscape: "Радіальне меню (Cytoscape)",
      radialHtml: "Радіальне меню (HTML кнопки)",
      switch2d: "2D",
      switch3d: "3D",
      developmentFlow: "Флоу розробки",
      cola: "Cola (inf)",
      cose: "Cose",
      breadthfirst: "Breadthfirst",
      concentric: "Concentric",
      circle: "Circle",
      grid: "Grid",
      reset: "Скинути",
      resetLayout: "Скинути розкладку",
      physics: "Фізика",
      physicsTitle: "Пауза або запуск force-фізики",
      labels: "Лейбли",
      labelsTitle: "Показати всі лейбли",
      time: "Час",
      timeTitle: "Показати панель часу/статусу",
      map: "Мапа",
      mapTitle: "Показати мапу графа",
      allGroups: "Всі групи",
      allWorkflowStates: "Всі стани workflow",
      allStatuses: "Всі статуси",
      groupFilter: "Фільтр груп",
      workflowStatusFilter: "Фільтр workflow-статусу",
      statusFilter: "Фільтр статусу",
      degreeFilter: "Мінімальний degree-фільтр",
      degreeFilterTitle: "Фільтр пошуку: degree",
      searchNodes: "Пошук вузлів",
      contextSearch: "Контекстний пошук",
      contextSearchQuestion: "Питання для контекстного пошуку",
      highlightRelatedNodes: "Підсвітити пов'язані вузли",
      find: "Знайти",
      loadingGraph: "Завантаження графа...",
      startingScene: "Запуск 3D сцени.",
      info: "Інфо",
      viewportInformationDensity: "Інформаційна щільність у вюпорті",
      cognitiveLoadLevel: "Рівень когнітивного навантаження",
      focus: "Фокус",
      focusLinkedBranch: "Фокус на пов'язаній гілці",
      edit: "Редагувати",
      editTitleDetailFiles: "Редагувати назву, деталі й файли",
      showHideLabelLayer: "Показати або сховати шар лейблів",
      copy: "Копія",
      copyNodeId: "Скопіювати id вузла",
      testing: "Тест",
      testingTitle: "Жовтий: зараз тестується",
      needed: "Треба",
      neededTitle: "Червоний: треба реалізувати або оновити",
      done: "Готово",
      doneTitle: "Зелений: реалізовано і злито",
      trash: "Кошик",
      trashEmpty: "Кошик порожній",
      trashTitle: "Кошик",
      trashNoDeleted: "Видалених вузлів ще немає.",
      moveNodeToTrash: "Перемістити вузол у кошик",
      moveNodeToTrashQuestion: "Перемістити вузол у кошик?",
      confirmMoveNodeToTrash: "Підтвердити переміщення вузла у кошик",
      moveToTrash: "Перемістити в кошик",
      cancel: "Скасувати",
      setWorkflowState: "Змінити workflow-стан",
      nodeActions: "Дії\nвузла",
      dragHint: "Обертай drag, наближай wheel, наведи або клікни вузол для деталей.",
      force3d: "3D force-directed",
      cytoscapeView: "Сучасний Cytoscape.js TZ режим",
      cytoscapeHint: "Спочатку фільтруй, потім інспектуй один вузол або його сусідів.",
      focusLinked: "Фокус зв'язків",
      showAll: "Показати все",
      searchLong: "Фокус по label, detail, group, status",
      fit: "Вписати",
      searchFlow: "Пошук label, detail, branch, visual key",
      flowCards: "Варіант B: флоу-картки",
      flowSubtitle: "ReactFlow-style density prototype; без runtime React залежності.",
      readableCards: "Читабельні картки гілок",
      flowDetails: "Цей варіант тестує щільні картки, handles, preview keys і branch metadata перед переходом на React Flow dependency.",
      loadingGraphShort: "Завантаження графа.",
      nodesVisible: "вузлів видно.",
      nodesArranged: "вузлів розкладено за групами. Пошук звужує дошку без читання всього TZ.",
      noDetailAttached: "Деталі не додані.",
      visualKeyPending: "візуальний ключ очікує",
      agentBranchAttachPoint: "точка прив'язки гілки агента",
    },
    en: {
      appTitle3d: "JobApply TZ graph 3D",
      appTitle2d: "JobApply TZ graph 2D",
      appTitleFlow: "JobApply TZ flow cards",
      settings: "Settings",
      toggleMenu: "Collapse or expand menu",
      language: "Language",
      graphProjectMenu: "Graph/project menu",
      rearrangeLayout: "Re-arrange layout",
      contextMenuStyle: "Context menu style",
      radialCytoscape: "Radial menu (Cytoscape)",
      radialHtml: "Radial menu (HTML buttons)",
      switch2d: "2D",
      switch3d: "3D",
      developmentFlow: "Development flow",
      cola: "Cola (inf)",
      cose: "Cose",
      breadthfirst: "Breadthfirst",
      concentric: "Concentric",
      circle: "Circle",
      grid: "Grid",
      reset: "Reset",
      resetLayout: "Reset layout",
      physics: "Physics",
      physicsTitle: "Pause or resume force physics",
      labels: "Labels",
      labelsTitle: "Show all labels",
      time: "Time",
      timeTitle: "Show time/status panel",
      map: "Map",
      mapTitle: "Show map panel",
      allGroups: "All groups",
      allWorkflowStates: "All workflow states",
      allStatuses: "All statuses",
      groupFilter: "Group filter",
      workflowStatusFilter: "Workflow status filter",
      statusFilter: "Status filter",
      degreeFilter: "Minimum degree filter",
      degreeFilterTitle: "Search Filter: degree",
      searchNodes: "Search nodes",
      contextSearch: "Ask context search",
      contextSearchQuestion: "Context search question",
      highlightRelatedNodes: "Highlight related nodes",
      find: "Find",
      loadingGraph: "Loading graph...",
      startingScene: "Starting 3D scene.",
      info: "Info",
      viewportInformationDensity: "Viewport information density",
      cognitiveLoadLevel: "Cognitive load level",
      focus: "Focus",
      focusLinkedBranch: "Focus linked branch",
      edit: "Edit",
      editTitleDetailFiles: "Edit title/detail/files",
      showHideLabelLayer: "Show or hide label layer",
      copy: "Copy",
      copyNodeId: "Copy node id",
      testing: "Testing",
      testingTitle: "Yellow: currently being tested",
      needed: "Needed",
      neededTitle: "Red: needs implementation or update",
      done: "Done",
      doneTitle: "Green: implemented and merged",
      trash: "Trash",
      trashEmpty: "Trash is empty",
      trashTitle: "Trash",
      trashNoDeleted: "No deleted nodes yet.",
      moveNodeToTrash: "Move node to trash",
      moveNodeToTrashQuestion: "Move node to trash?",
      confirmMoveNodeToTrash: "Confirm moving node to trash",
      moveToTrash: "Move to trash",
      cancel: "Cancel",
      setWorkflowState: "Set workflow state",
      nodeActions: "Node\nactions",
      dragHint: "Drag to orbit, wheel to zoom, hover or click a node for details.",
      force3d: "3D force-directed",
      cytoscapeView: "Modern Cytoscape.js TZ view",
      cytoscapeHint: "Filter first, then inspect one node or its linked neighborhood.",
      focusLinked: "Focus linked",
      showAll: "Show all",
      searchLong: "Focus by label, detail, group, status",
      fit: "Fit",
      searchFlow: "Search labels, detail, branch, visual key",
      flowCards: "Variant B: flow cards",
      flowSubtitle: "ReactFlow-style density prototype; no runtime React dependency.",
      readableCards: "Readable branch cards",
      flowDetails: "This variant tests dense cards, handles, preview keys, and branch metadata before committing to a React Flow dependency.",
      loadingGraphShort: "Loading graph.",
      nodesVisible: "nodes visible.",
      nodesArranged: "nodes arranged by group. Search narrows the board without reading the whole TZ.",
      noDetailAttached: "No detail attached.",
      visualKeyPending: "visual key pending",
      agentBranchAttachPoint: "agent branch attach point",
    },
  };

  function normalize(value) {
    return String(value || "").toLowerCase().startsWith("en") ? "en" : "uk";
  }

  function t(key) {
    return messages[current][key] || messages.en[key] || key;
  }

  function withLang(url) {
    const next = new URL(url, window.location.origin);
    next.searchParams.set("lang", current);
    return next.pathname + next.search + next.hash;
  }

  function apiUrl(path) {
    const base = window.GRAPH_UI_BASE_PATH || "";
    const next = new URL(`${base}${path}`, window.location.origin);
    next.searchParams.set("lang", current);
    return next.pathname + next.search;
  }

  function translatePage(root = document) {
    root.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
    });
    root.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.dataset.i18nTitle));
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAria));
    });
    const languageSelect = root.getElementById?.("languageSelect") || root.querySelector?.("#languageSelect");
    if (languageSelect) languageSelect.value = current;
    document.documentElement.lang = current;
  }

  function wireLanguageSelect() {
    const languageSelect = document.getElementById("languageSelect");
    if (!languageSelect) return;
    languageSelect.value = current;
    languageSelect.addEventListener("change", () => {
      const lang = normalize(languageSelect.value);
      localStorage.setItem("graphUiLanguage", lang);
      const next = new URL(window.location.href);
      next.searchParams.set("lang", lang);
      window.location.href = next.toString();
    });
  }

  window.GraphUiI18n = { lang: current, t, withLang, apiUrl, translatePage, wireLanguageSelect };
})();
