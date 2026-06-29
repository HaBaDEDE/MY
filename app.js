const pathParts = window.location.pathname.split("/").filter(Boolean);
const storageScope = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1] || document.title || "quiz";
const STORAGE_KEY = `quizSite:${storageScope}:v1`;
const SITE_CODE = getSiteCode();
const AUTO_UNLOCK_KEYS = {
  MG: "rWQNQQeK_iTw2dl3D9x712o64xIY5MnExE_8CzCinLI",
  MY: "JMQvOdBSGGbLyKF_t-FBELkPWdf9BH7l9mtGZJX7tBA",
};
let questionBank = [];

const els = {
  bankMeta: document.querySelector("#bankMeta"),
  sponsorButton: document.querySelector("#sponsorButton"),
  sponsorDialog: document.querySelector("#sponsorDialog"),
  closeSponsorButton: document.querySelector("#closeSponsorButton"),
  themeButton: document.querySelector("#themeButton"),
  typeControl: document.querySelector("#typeControl"),
  countSelect: document.querySelector("#countSelect"),
  customCount: document.querySelector("#customCount"),
  orderControl: document.querySelector("#orderControl"),
  modeControl: document.querySelector("#modeControl"),
  autoNextToggle: document.querySelector("#autoNextToggle"),
  startButton: document.querySelector("#startButton"),
  resumeSessionButton: document.querySelector("#resumeSessionButton"),
  exportStudyButton: document.querySelector("#exportStudyButton"),
  mistakePracticeButton: document.querySelector("#mistakePracticeButton"),
  favoritePracticeButton: document.querySelector("#favoritePracticeButton"),
  mistakeCount: document.querySelector("#mistakeCount"),
  favoriteCount: document.querySelector("#favoriteCount"),
  searchInput: document.querySelector("#searchInput"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  scoreText: document.querySelector("#scoreText"),
  wrongText: document.querySelector("#wrongText"),
  unansweredText: document.querySelector("#unansweredText"),
  streakText: document.querySelector("#streakText"),
  questionKicker: document.querySelector("#questionKicker"),
  questionPanel: document.querySelector("#questionPanel"),
  questionStem: document.querySelector("#questionStem"),
  questionType: document.querySelector("#questionType"),
  optionsList: document.querySelector("#optionsList"),
  feedbackBox: document.querySelector("#feedbackBox"),
  noteInput: document.querySelector("#noteInput"),
  noteStatus: document.querySelector("#noteStatus"),
  celebrationLayer: document.querySelector("#celebrationLayer"),
  favoriteButton: document.querySelector("#favoriteButton"),
  resetStorageButton: document.querySelector("#resetStorageButton"),
  prevButton: document.querySelector("#prevButton"),
  clearAnswerButton: document.querySelector("#clearAnswerButton"),
  checkButton: document.querySelector("#checkButton"),
  nextButton: document.querySelector("#nextButton"),
  finishButton: document.querySelector("#finishButton"),
  reviewWrongButton: document.querySelector("#reviewWrongButton"),
  questionNav: document.querySelector("#questionNav"),
  resultDialog: document.querySelector("#resultDialog"),
  resultCorrect: document.querySelector("#resultCorrect"),
  resultWrong: document.querySelector("#resultWrong"),
  resultRate: document.querySelector("#resultRate"),
  resultStreak: document.querySelector("#resultStreak"),
  closeResultButton: document.querySelector("#closeResultButton"),
  redoWrongButton: document.querySelector("#redoWrongButton"),
};

const settings = {
  type: "全部",
  order: "random",
  mode: "practice",
  autoNext: false,
};

let store = loadStore();
let session = null;
let touchStart = null;
let scrollSaveFrame = 0;

init();

function init() {
  applyTheme(store.theme || "light");
  settings.autoNext = Boolean(store.autoNext);
  els.autoNextToggle.checked = settings.autoNext;
  bindEvents();
  updateSavedCounts();
  loadQuestionBankAutomatically();
  window.setTimeout(openSponsorDialog, 0);
}

function bindEvents() {
  els.countSelect.addEventListener("change", () => {
    els.customCount.disabled = els.countSelect.value !== "custom";
  });

  els.orderControl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-order]");
    if (!button) return;
    settings.order = button.dataset.order;
    setActiveButton(els.orderControl, button);
  });

  els.modeControl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    if (settings.mode === button.dataset.mode) return;
    settings.mode = button.dataset.mode;
    setActiveButton(els.modeControl, button);
    if (questionBank.length) startSession();
    else render();
  });

  els.autoNextToggle.addEventListener("change", () => {
    settings.autoNext = els.autoNextToggle.checked;
    store.autoNext = settings.autoNext;
    saveStore();
  });

  els.startButton.addEventListener("click", () => startSession());
  els.resumeSessionButton.addEventListener("click", resumeSession);
  els.exportStudyButton.addEventListener("click", exportStudyPack);
  els.mistakePracticeButton.addEventListener("click", () => startFromSaved("mistakes"));
  els.favoritePracticeButton.addEventListener("click", () => startFromSaved("favorites"));
  els.favoriteButton.addEventListener("click", toggleFavorite);
  els.resetStorageButton.addEventListener("click", resetSavedData);
  els.prevButton.addEventListener("click", () => moveQuestion(-1));
  els.nextButton.addEventListener("click", () => moveQuestion(1));
  els.clearAnswerButton.addEventListener("click", clearCurrentAnswer);
  els.checkButton.addEventListener("click", checkCurrentQuestion);
  els.finishButton.addEventListener("click", finishSession);
  els.reviewWrongButton.addEventListener("click", reviewWrongQuestions);
  els.closeResultButton.addEventListener("click", () => els.resultDialog.close());
  els.redoWrongButton.addEventListener("click", () => {
    els.resultDialog.close();
    reviewWrongQuestions();
  });
  els.searchInput.addEventListener("input", renderBankMeta);
  els.noteInput.addEventListener("input", saveCurrentNote);
  els.themeButton.addEventListener("click", toggleTheme);
  els.sponsorButton.addEventListener("click", openSponsorDialog);
  els.closeSponsorButton.addEventListener("click", closeSponsorDialog);
  els.sponsorDialog.addEventListener("click", (event) => {
    if (event.target === els.sponsorDialog) closeSponsorDialog();
  });
  window.addEventListener("scroll", rememberScrollPosition, { passive: true });
  document.addEventListener("keydown", handleKeyboard);
  els.questionPanel.addEventListener("touchstart", handleTouchStart, { passive: true });
  els.questionPanel.addEventListener("touchend", handleTouchEnd, { passive: true });
}

function showLoadingState() {
  els.bankMeta.textContent = "正在加载加密题库";
  els.questionKicker.textContent = "题库加载中";
  els.questionStem.textContent = "题库文件仍为加密格式，网页正在自动解密并加载。";
  els.questionType.textContent = "加载中";
  els.optionsList.replaceChildren();
  els.noteInput.value = "";
  els.noteInput.disabled = true;
  els.noteStatus.textContent = "";
  els.questionNav.replaceChildren();
  els.progressText.textContent = "0 / 0";
  els.scoreText.textContent = "0";
  els.wrongText.textContent = "0";
  els.unansweredText.textContent = "0";
  els.streakText.textContent = "0";
  els.progressBar.style.width = "0%";
  renderActionState();
}

async function loadQuestionBankAutomatically() {
  showLoadingState();
  try {
    questionBank = await loadEncryptedQuestions(AUTO_UNLOCK_KEYS[SITE_CODE] || AUTO_UNLOCK_KEYS.MG);
    renderTypeControl();
    if (!restoreSessionSnapshot({ silent: true, restoreScroll: true })) startSession();
  } catch (error) {
    showLoadError(getLoadErrorMessage(error));
  }
}

function showLoadError(message) {
  els.bankMeta.textContent = "题库加载失败";
  els.questionKicker.textContent = "加载失败";
  els.questionStem.textContent = message;
  els.questionType.textContent = "错误";
  els.optionsList.replaceChildren();
  renderActionState();
}

async function loadEncryptedQuestions(unlockKey) {
  if (!window.crypto?.subtle) {
    throw new Error("WEB_CRYPTO_UNAVAILABLE");
  }

  let response;
  try {
    response = await fetch("data/questions.enc", { cache: "no-store" });
  } catch {
    throw new Error("QUESTION_FILE_FETCH_FAILED");
  }
  if (!response.ok) throw new Error(`QUESTION_FILE_HTTP_${response.status}`);

  const payload = await response.json();
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.data);
  const tag = base64ToBytes(payload.tag);
  const encrypted = concatBytes(ciphertext, tag);

  const importedUnlockKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(unlockKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: payload.iterations || 250000,
    },
    importedUnlockKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  } catch {
    throw new Error("DECRYPT_FAILED");
  }

  const questions = JSON.parse(new TextDecoder().decode(decrypted));
  if (!Array.isArray(questions) || !questions.length) throw new Error("invalid question bank");
  return questions;
}

function getLoadErrorMessage(error) {
  const message = error?.message || "";
  if (message === "QUESTION_FILE_FETCH_FAILED") {
    if (location.protocol === "file:") {
      return "本地不能直接双击打开，请用 python -m http.server 启动后访问 localhost";
    }
    return "题库文件没有加载成功，请确认 data/questions.enc 已上传并等待 GitHub Pages 部署完成";
  }
  if (message.startsWith("QUESTION_FILE_HTTP_")) {
    return "没有找到 data/questions.enc，请确认 GitHub 仓库里已经上传这个文件";
  }
  if (message === "WEB_CRYPTO_UNAVAILABLE") {
    return "当前浏览器不支持安全解密，请使用新版 Chrome/Edge 或通过 HTTPS 打开";
  }
  if (message === "DECRYPT_FAILED") {
    return "题库解密失败，请确认内置解密密钥和 data/questions.enc 匹配";
  }
  return "题库解锁失败，请检查 questions.enc 是否上传完整";
}

function getSiteCode() {
  const path = window.location.pathname.toUpperCase();
  if (path.includes("/MY")) return "MY";
  if (path.includes("/MG")) return "MG";
  if (document.title.includes("马原")) return "MY";
  return "MG";
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(left, right) {
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

function renderTypeControl() {
  const counts = getTypeCounts();
  const types = ["全部", "单选题", "多选题", "判断题"];
  els.typeControl.replaceChildren();

  types.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.type = type;
    button.textContent = `${type} ${type === "全部" ? questionBank.length : counts[type] || 0}`;
    if (type === settings.type) button.classList.add("active");
    button.addEventListener("click", () => {
      settings.type = type;
      setActiveButton(els.typeControl, button);
      renderBankMeta();
    });
    els.typeControl.append(button);
  });
}

function startSession(sourceQuestions) {
  if (!questionBank.length) {
    openUnlockDialog();
    return;
  }
  const base = Array.isArray(sourceQuestions) ? sourceQuestions : getFilteredQuestions();
  if (!base.length) {
    window.alert("没有可用题目");
    return;
  }

  let picked = [...base];
  if (settings.order === "random") picked = shuffle(picked);
  const count = readCount(picked.length);
  picked = picked.slice(0, count);

  session = {
    questions: picked,
    current: 0,
    mode: settings.mode,
    answers: {},
    checked: {},
    results: {},
    streak: 0,
    bestStreak: 0,
    completed: false,
  };
  store.scrollY = 0;
  render();
}

function startFromSaved(kind) {
  const ids = kind === "mistakes" ? store.mistakes : store.favorites;
  const source = ids.map((id) => questionBank.find((item) => item.id === id)).filter(Boolean);
  startSession(source);
}

function getFilteredQuestions() {
  const keyword = els.searchInput.value.trim();
  return questionBank.filter((question) => {
    const typeMatch = settings.type === "全部" || question.type === settings.type;
    if (!typeMatch) return false;
    if (!keyword) return true;
    const optionText = question.options.map((option) => option.text).join(" ");
    return `${question.stem} ${optionText} ${question.id}`.includes(keyword);
  });
}

function readCount(max) {
  const value = els.countSelect.value;
  if (value === "all") return max;
  if (value === "custom") {
    const count = Number.parseInt(els.customCount.value, 10);
    return Number.isFinite(count) ? Math.max(1, Math.min(max, count)) : Math.min(max, 20);
  }
  return Math.min(max, Number.parseInt(value, 10));
}

function render() {
  renderBankMeta();
  updateSavedCounts();
  renderQuestion();
  renderStats();
  renderNavigator();
  saveSessionSnapshot();
  renderActionState();
}

function renderBankMeta() {
  const available = getFilteredQuestions().length;
  els.bankMeta.textContent = `${questionBank.length} 题 · 当前 ${available} 题`;
}

function renderQuestion() {
  const question = getCurrentQuestion();
  els.feedbackBox.hidden = true;
  els.feedbackBox.textContent = "";
  els.feedbackBox.className = "feedback";

  if (!question) {
    els.optionsList.replaceChildren();
    els.questionKicker.textContent = "题库";
    els.questionStem.textContent = "没有题目";
    els.questionType.textContent = "空";
    els.noteInput.value = "";
    els.noteInput.disabled = true;
    els.noteStatus.textContent = "";
    return;
  }

  const selected = getSelected(question.id);
  const reveal = shouldReveal(question.id);
  const correctLabels = normalizeLabels(question.answer);
  const isCorrect = gradeQuestion(question);

  els.questionKicker.textContent = `第 ${session.current + 1} 题 · 原题号 ${question.id}`;
  els.questionStem.textContent = question.stem;
  els.questionType.textContent = question.type;

  const optionButtons = Array.from(els.optionsList.querySelectorAll(".option-button"));
  question.options.forEach((option, index) => {
    let button = optionButtons[index];
    if (!button) {
      button = document.createElement("button");
      button.type = "button";

      const label = document.createElement("span");
      label.className = "option-label";
      const text = document.createElement("span");
      text.className = "option-text";
      button.append(label, text);
      els.optionsList.append(button);
    }

    button.className = "option-button";
    button.dataset.label = option.label;

    if (selected.includes(option.label)) button.classList.add("selected");
    if (reveal && correctLabels.includes(option.label)) button.classList.add("correct");
    if (reveal && selected.includes(option.label) && !correctLabels.includes(option.label)) {
      button.classList.add("wrong");
    }

    const label = button.querySelector(".option-label");
    label.textContent = option.label;
    const text = button.querySelector(".option-text");
    text.textContent = option.text;
    button.onclick = () => selectOption(option.label);
  });
  optionButtons.slice(question.options.length).forEach((button) => button.remove());

  if (reveal) {
    els.feedbackBox.hidden = false;
    els.feedbackBox.classList.add(isCorrect ? "correct" : "wrong");
    els.feedbackBox.textContent = isCorrect
      ? `正确：${formatAnswer(question)}`
      : `正确答案：${formatAnswer(question)}`;
  }

  els.favoriteButton.classList.toggle("active", store.favorites.includes(question.id));
  els.favoriteButton.textContent = store.favorites.includes(question.id) ? "★" : "☆";
  renderNote(question);
}

function refreshCurrentQuestionState() {
  const question = getCurrentQuestion();
  if (!question) return;

  const selected = getSelected(question.id);
  const reveal = shouldReveal(question.id);
  const correctLabels = normalizeLabels(question.answer);

  els.optionsList.querySelectorAll(".option-button").forEach((button) => {
    const label = button.dataset.label;
    button.classList.toggle("selected", selected.includes(label));
    button.classList.toggle("correct", reveal && correctLabels.includes(label));
    button.classList.toggle("wrong", reveal && selected.includes(label) && !correctLabels.includes(label));
  });

  els.feedbackBox.hidden = !reveal;
  els.feedbackBox.textContent = "";
  els.feedbackBox.className = "feedback";
  if (reveal) {
    const isCorrect = gradeQuestion(question);
    els.feedbackBox.classList.add(isCorrect ? "correct" : "wrong");
    els.feedbackBox.textContent = isCorrect ? `正确：${formatAnswer(question)}` : `正确答案：${formatAnswer(question)}`;
  }

  els.favoriteButton.classList.toggle("active", store.favorites.includes(question.id));
  els.favoriteButton.textContent = store.favorites.includes(question.id) ? "★" : "☆";
  renderStats();
  renderNavigator();
  saveSessionSnapshot();
  renderActionState();
}

function renderStats() {
  if (!session) {
    els.progressText.textContent = "0 / 0";
    els.scoreText.textContent = "0";
    els.wrongText.textContent = "0";
    els.unansweredText.textContent = "0";
    els.streakText.textContent = "0";
    els.progressBar.style.width = "0%";
    return;
  }

  const total = session.questions.length;
  const answered = session.questions.filter((question) => getSelected(question.id).length).length;
  const correct = session.questions.filter((question) => session.results[question.id] === true).length;
  const wrong = session.questions.filter((question) => session.results[question.id] === false).length;

  els.progressText.textContent = `${session.current + 1} / ${total}`;
  els.scoreText.textContent = String(correct);
  els.wrongText.textContent = String(wrong);
  els.unansweredText.textContent = String(total - answered);
  els.streakText.textContent = String(session.streak || 0);
  els.progressBar.style.width = `${Math.round((answered / total) * 100)}%`;
}

function renderNavigator() {
  els.questionNav.replaceChildren();
  if (!session) return;

  session.questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-button";
    button.textContent = String(index + 1);
    if (index === session.current) button.classList.add("current");
    if (getSelected(question.id).length) button.classList.add("answered");
    if (session.results[question.id] === true) button.classList.add("correct");
    if (session.results[question.id] === false) button.classList.add("wrong");
    if (store.favorites.includes(question.id)) button.classList.add("favorite");
    button.addEventListener("click", () => {
      session.current = index;
      render();
    });
    els.questionNav.append(button);
  });
}

function renderActionState() {
  const question = getCurrentQuestion();
  const hasQuestion = Boolean(question);
  const checkedInPractice = Boolean(question && session?.mode === "practice" && session.checked[question.id]);
  els.prevButton.disabled = !hasQuestion || session?.current === 0;
  els.nextButton.disabled = !hasQuestion || session?.current === session?.questions.length - 1;
  els.clearAnswerButton.disabled = !hasQuestion || session?.completed;
  els.checkButton.disabled = !hasQuestion || session?.completed || checkedInPractice;
  els.favoriteButton.disabled = !hasQuestion;
  els.noteInput.disabled = !hasQuestion;
  els.finishButton.disabled = !hasQuestion || session?.completed;
  els.checkButton.textContent = session?.mode === "exam" ? "保存" : "确定";
  els.finishButton.classList.toggle("is-hidden", session?.mode !== "exam" && !session?.completed);
  els.redoWrongButton.disabled = !getCurrentWrongIds().length && !store.mistakes.length;
  els.resumeSessionButton.disabled = !questionBank.length || !store.session;
  els.exportStudyButton.disabled = !questionBank.length;
}

function renderNote(question) {
  const text = store.notes?.[question.id] || "";
  els.noteInput.value = text;
  els.noteInput.disabled = false;
  els.noteStatus.textContent = text ? "已保存本题笔记" : "";
}

function saveCurrentNote() {
  const question = getCurrentQuestion();
  if (!question) return;
  const value = els.noteInput.value.trim();
  if (!store.notes) store.notes = {};
  if (value) store.notes[question.id] = value;
  else delete store.notes[question.id];
  els.noteStatus.textContent = value ? "已保存" : "";
  saveStore();
}

function saveSessionSnapshot() {
  if (!session || !session.questions?.length) return;
  store.session = {
    ids: session.questions.map((question) => question.id),
    current: session.current,
    mode: session.mode,
    answers: session.answers,
    checked: session.checked,
    results: session.results,
    streak: session.streak,
    bestStreak: session.bestStreak,
    completed: session.completed,
    settings: {
      type: settings.type,
      order: settings.order,
      mode: settings.mode,
      autoNext: settings.autoNext,
      countValue: els.countSelect.value,
      customCount: els.customCount.value,
    },
    savedAt: Date.now(),
  };
  saveStore();
}

function resumeSession() {
  if (!questionBank.length) return;
  restoreSessionSnapshot({ restoreScroll: true });
}

function restoreSessionSnapshot({ silent = false, restoreScroll = false } = {}) {
  const snapshot = store.session;
  if (!snapshot?.ids?.length) {
    if (!silent) window.alert("暂无上次练习记录");
    return false;
  }
  const questions = snapshot.ids.map((id) => questionBank.find((item) => item.id === id)).filter(Boolean);
  if (!questions.length) {
    if (!silent) window.alert("上次练习记录里的题目已经找不到");
    return false;
  }

  applyStoredSettings(snapshot.settings || {});
  session = {
    questions,
    current: Math.min(snapshot.current || 0, questions.length - 1),
    mode: snapshot.mode || settings.mode,
    answers: snapshot.answers || {},
    checked: snapshot.checked || {},
    results: snapshot.results || {},
    streak: snapshot.streak || 0,
    bestStreak: snapshot.bestStreak || 0,
    completed: Boolean(snapshot.completed),
  };
  render();
  if (restoreScroll) restoreScrollPosition();
  return true;
}

function applyStoredSettings(savedSettings) {
  if (savedSettings.type) settings.type = savedSettings.type;
  if (savedSettings.order) settings.order = savedSettings.order;
  if (savedSettings.mode) settings.mode = savedSettings.mode;
  if (typeof savedSettings.autoNext === "boolean") settings.autoNext = savedSettings.autoNext;
  els.autoNextToggle.checked = settings.autoNext;
  if (savedSettings.countValue) els.countSelect.value = savedSettings.countValue;
  if (typeof savedSettings.customCount === "string") els.customCount.value = savedSettings.customCount;
  els.customCount.disabled = els.countSelect.value !== "custom";
  setActiveButtonByValue(els.typeControl, "type", settings.type);
  setActiveButtonByValue(els.orderControl, "order", settings.order);
  setActiveButtonByValue(els.modeControl, "mode", settings.mode);
  renderBankMeta();
}

function exportStudyPack() {
  if (!questionBank.length) {
    openUnlockDialog();
    return;
  }

  const parts = [
    `# ${document.title}复习资料`,
    "",
    `生成时间：${new Date().toLocaleString()}`,
    "",
  ];

  const currentQuestions = session?.questions || [];
  const mistakeQuestions = idsToQuestions(store.mistakes);
  const favoriteQuestions = idsToQuestions(store.favorites);
  const noteQuestions = idsToQuestions(Object.keys(store.notes || {}).map(Number));

  appendQuestionSection(parts, "当前练习", currentQuestions);
  appendQuestionSection(parts, "错题", mistakeQuestions);
  appendQuestionSection(parts, "收藏", favoriteQuestions);
  appendQuestionSection(parts, "我的笔记", noteQuestions, true);

  const content = parts.join("\n").trim() + "\n";
  downloadText(`${SITE_CODE}-复习资料-${formatDateForFile(new Date())}.md`, content);
}

function idsToQuestions(ids) {
  return [...new Set(ids)]
    .map((id) => questionBank.find((question) => question.id === Number(id)))
    .filter(Boolean);
}

function appendQuestionSection(parts, title, questions, notesOnly = false) {
  parts.push(`## ${title}`, "");
  if (!questions.length) {
    parts.push("暂无内容", "");
    return;
  }

  questions.forEach((question, index) => {
    const note = store.notes?.[question.id] || "";
    if (notesOnly && !note) return;
    parts.push(`### ${index + 1}. ${question.stem}`);
    parts.push("");
    parts.push(`- 题型：${question.type}`);
    parts.push(`- 原题号：${question.id}`);
    question.options.forEach((option) => {
      parts.push(`- ${option.label}. ${option.text}`);
    });
    parts.push(`- 正确答案：${formatAnswer(question)}`);
    if (note) parts.push(`- 我的笔记：${note}`);
    parts.push("");
  });
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10);
}

function selectOption(label) {
  const question = getCurrentQuestion();
  if (!question || session.completed) return;

  const selected = new Set(getSelected(question.id));
  if (question.type === "多选题") {
    if (selected.has(label)) selected.delete(label);
    else selected.add(label);
  } else {
    selected.clear();
    selected.add(label);
  }

  session.answers[question.id] = [...selected].sort();
  if (session.checked[question.id]) {
    delete session.checked[question.id];
    delete session.results[question.id];
  }

  if (session.mode === "practice" && question.type !== "多选题") {
    settleCurrentQuestion();
    return;
  }

  refreshCurrentQuestionState();
}

function checkCurrentQuestion() {
  const question = getCurrentQuestion();
  if (!question) return;
  if (!getSelected(question.id).length) {
    showFeedback("wrong", "未选择答案");
    return;
  }

  if (session.mode === "exam" && !session.completed) {
    if (session.current === session.questions.length - 1) {
      finishSession();
      return;
    }
    moveQuestion(1);
    return;
  }

  settleCurrentQuestion();
}

function settleCurrentQuestion() {
  const question = getCurrentQuestion();
  if (!question || !getSelected(question.id).length) return false;
  if (session.checked[question.id]) return session.results[question.id] === true;

  const correct = gradeQuestion(question);
  session.checked[question.id] = true;
  session.results[question.id] = correct;
  if (correct) {
    session.streak += 1;
    session.bestStreak = Math.max(session.bestStreak, session.streak);
  } else {
    session.streak = 0;
  }
  updateMistake(question.id, correct);
  refreshCurrentQuestionState();
  if (correct) {
    burstCelebration();
    bumpElement(els.scoreText.closest(".stat"));
    bumpElement(els.streakText.closest(".stat"));
    maybeAutoNextQuestion();
  } else {
    bumpElement(els.wrongText.closest(".stat"));
  }
  return correct;
}

function maybeAutoNextQuestion() {
  if (!settings.autoNext || session?.mode !== "practice" || session.completed) return;
  if (session.current >= session.questions.length - 1) return;
  window.setTimeout(() => {
    const question = getCurrentQuestion();
    if (!question || session.results[question.id] !== true) return;
    moveQuestion(1);
  }, 520);
}

function clearCurrentAnswer() {
  const question = getCurrentQuestion();
  if (!question || session.completed) return;
  delete session.answers[question.id];
  delete session.checked[question.id];
  delete session.results[question.id];
  render();
}

function finishSession() {
  if (!session) return;

  session.questions.forEach((question) => {
    const correct = getSelected(question.id).length > 0 && gradeQuestion(question);
    session.checked[question.id] = true;
    session.results[question.id] = correct;
    updateMistake(question.id, correct);
  });
  session.completed = true;
  session.streak = 0;
  render();
  showResultDialog();
}

function reviewWrongQuestions() {
  const ids = getCurrentWrongIds();
  const sourceIds = ids.length ? ids : store.mistakes;
  const source = sourceIds.map((id) => questionBank.find((item) => item.id === id)).filter(Boolean);
  if (!source.length) {
    window.alert("暂无错题");
    return;
  }
  startSession(source);
}

function showResultDialog() {
  const correct = session.questions.filter((question) => session.results[question.id] === true).length;
  const wrong = session.questions.length - correct;
  const rate = session.questions.length ? Math.round((correct / session.questions.length) * 100) : 0;
  els.resultCorrect.textContent = String(correct);
  els.resultWrong.textContent = String(wrong);
  els.resultRate.textContent = `${rate}%`;
  els.resultStreak.textContent = String(session.bestStreak || 0);
  if (typeof els.resultDialog.showModal === "function") els.resultDialog.showModal();
}

function showFeedback(kind, text) {
  els.feedbackBox.hidden = false;
  els.feedbackBox.className = `feedback ${kind}`;
  els.feedbackBox.textContent = text;
}

function moveQuestion(step) {
  if (!session) return;
  const next = session.current + step;
  if (next < 0 || next >= session.questions.length) return;
  blurActiveControl();
  session.current = next;
  render();
  playQuestionTransition(step);
}

function getCurrentQuestion() {
  if (!session || !session.questions.length) return null;
  return session.questions[session.current];
}

function getSelected(questionId) {
  return session?.answers[questionId] || [];
}

function shouldReveal(questionId) {
  return Boolean(session?.completed || session?.checked[questionId]);
}

function gradeQuestion(question) {
  return normalizeLabels(getSelected(question.id).join("")) === normalizeLabels(question.answer);
}

function normalizeLabels(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .split("")
    .sort()
    .join("");
}

function formatAnswer(question) {
  const labels = normalizeLabels(question.answer).split("").filter(Boolean);
  return labels
    .map((label) => {
      const option = question.options.find((item) => item.label === label);
      return option ? `${label}. ${option.text}` : label;
    })
    .join("；");
}

function getTypeCounts() {
  return questionBank.reduce((acc, question) => {
    acc[question.type] = (acc[question.type] || 0) + 1;
    return acc;
  }, {});
}

function getCurrentWrongIds() {
  if (!session) return [];
  return session.questions
    .filter((question) => session.results[question.id] === false)
    .map((question) => question.id);
}

function updateMistake(questionId, correct) {
  const set = new Set(store.mistakes);
  if (correct) set.delete(questionId);
  else set.add(questionId);
  store.mistakes = [...set].sort((a, b) => a - b);
  saveStore();
}

function toggleFavorite() {
  const question = getCurrentQuestion();
  if (!question) return;
  const set = new Set(store.favorites);
  if (set.has(question.id)) set.delete(question.id);
  else set.add(question.id);
  store.favorites = [...set].sort((a, b) => a - b);
  saveStore();
  render();
}

function updateSavedCounts() {
  els.mistakeCount.textContent = String(store.mistakes.length);
  els.favoriteCount.textContent = String(store.favorites.length);
}

function resetSavedData() {
  const ok = window.confirm("清空错题、收藏、笔记和上次进度？");
  if (!ok) return;
  store = { mistakes: [], favorites: [], notes: {}, session: null, autoNext: settings.autoNext, scrollY: 0, theme: store.theme || "light" };
  session = null;
  saveStore();
  render();
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      notes: parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {},
      session: parsed.session && typeof parsed.session === "object" ? parsed.session : null,
      autoNext: Boolean(parsed.autoNext),
      scrollY: Number.isFinite(parsed.scrollY) ? parsed.scrollY : 0,
      theme: parsed.theme === "dark" ? "dark" : "light",
    };
  } catch {
    return { mistakes: [], favorites: [], notes: {}, session: null, autoNext: false, scrollY: 0, theme: "light" };
  }
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  updateSavedCounts();
}

function rememberScrollPosition() {
  if (scrollSaveFrame) return;
  scrollSaveFrame = window.requestAnimationFrame(() => {
    scrollSaveFrame = 0;
    store.scrollY = Math.max(0, Math.round(window.scrollY || document.documentElement.scrollTop || 0));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  });
}

function restoreScrollPosition() {
  const scrollY = Number(store.scrollY);
  if (!Number.isFinite(scrollY) || scrollY <= 0) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    });
  });
}

function toggleTheme() {
  const next = store.theme === "dark" ? "light" : "dark";
  store.theme = next;
  applyTheme(next);
  saveStore();
}

function openSponsorDialog() {
  if (!els.sponsorDialog || els.sponsorDialog.open) return;
  if (typeof els.sponsorDialog.showModal === "function") {
    els.sponsorDialog.showModal();
  } else {
    els.sponsorDialog.setAttribute("open", "");
  }
}

function closeSponsorDialog() {
  if (!els.sponsorDialog?.open) return;
  if (typeof els.sponsorDialog.close === "function") {
    els.sponsorDialog.close();
  } else {
    els.sponsorDialog.removeAttribute("open");
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.themeButton.textContent = theme === "dark" ? "☼" : "◐";
}

function handleKeyboard(event) {
  const tag = event.target?.tagName?.toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;
  if (els.sponsorDialog?.open || els.resultDialog?.open) return;
  if (!session || !getCurrentQuestion()) return;

  if (/^[1-8]$/.test(event.key)) {
    const question = getCurrentQuestion();
    const option = question.options[Number(event.key) - 1];
    if (option) {
      event.preventDefault();
      selectOption(option.label);
    }
  }

  if (event.key === "Enter") {
    event.preventDefault();
    checkCurrentQuestion();
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveQuestion(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveQuestion(1);
  }

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleFavorite();
  }

  if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    toggleTheme();
  }
}

function handleTouchStart(event) {
  if (!session || !getCurrentQuestion()) return;
  if (isEditableTarget(event.target)) return;
  const touch = event.changedTouches[0];
  touchStart = {
    x: touch.clientX,
    y: touch.clientY,
    time: Date.now(),
  };
}

function handleTouchEnd(event) {
  if (!touchStart || !session || !getCurrentQuestion()) return;
  if (isEditableTarget(event.target)) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  const elapsed = Date.now() - touchStart.time;
  touchStart = null;

  if (elapsed > 700 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
  if (dx < 0) moveQuestion(1);
  else moveQuestion(-1);
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "select" || tag === "textarea" || target?.closest?.("button");
}

function blurActiveControl() {
  const active = document.activeElement;
  if (active && active instanceof HTMLElement) active.blur();
}

function playQuestionTransition(step) {
  if (!els.questionPanel) return;
  const className = step > 0 ? "transition-next" : "transition-prev";
  els.questionPanel.classList.remove("transition-next", "transition-prev");
  void els.questionPanel.offsetWidth;
  els.questionPanel.classList.add(className);
  window.setTimeout(() => els.questionPanel.classList.remove(className), 220);
}

function bumpElement(element) {
  if (!element) return;
  element.classList.remove("bump");
  void element.offsetWidth;
  element.classList.add("bump");
  window.setTimeout(() => element.classList.remove("bump"), 420);
}

function burstCelebration() {
  if (!els.celebrationLayer) return;
  const colors = ["#2f80ed", "#0f9f6e", "#f1b84b", "#35b8a6"];
  const originX = 82;
  const originY = 18;
  for (let i = 0; i < 18; i += 1) {
    const dot = document.createElement("span");
    dot.className = "celebration-dot";
    const angle = (Math.PI * 2 * i) / 18;
    const distance = 70 + Math.random() * 62;
    dot.style.setProperty("--x", `${originX}%`);
    dot.style.setProperty("--y", `${originY}%`);
    dot.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    dot.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    dot.style.setProperty("--c", colors[i % colors.length]);
    els.celebrationLayer.append(dot);
    window.setTimeout(() => dot.remove(), 760);
  }
}

function setActiveButton(container, activeButton) {
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button === activeButton);
  });
}

function setActiveButtonByValue(container, key, value) {
  container.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset[key] === value);
  });
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
