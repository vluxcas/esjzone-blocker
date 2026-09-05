import { findNovelCards } from './novels.js';

const PREFIX = 'eznb';
const NOVEL_LINK_SELECTOR = '.card.mb-30 .card-title > a[href*="/detail/"]';
const DRAG_THRESHOLD = 5;

function button(label, action, className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `${PREFIX}-button ${className}`.trim();
  element.textContent = label;
  element.addEventListener('click', action);
  return element;
}

function createPopoverHeader(title, meta) {
  const header = document.createElement('div');
  header.className = `${PREFIX}-popover-header`;
  const titleElement = document.createElement('strong');
  titleElement.className = `${PREFIX}-popover-title`;
  titleElement.textContent = title;
  const metaElement = document.createElement('span');
  metaElement.className = `${PREFIX}-popover-meta`;
  metaElement.textContent = meta;
  header.append(titleElement, metaElement);
  return header;
}

export function createApp(store, positionStore, root = document) {
  let selecting = false;
  let revealBlocked = false;
  let popover;
  let floatingButton;
  let controls;
  let observer;
  let managerReturnFocus;
  let savedPosition;
  let dragState;
  let suppressNextClick = false;
  let suppressClickTimeout;
  const records = new Map();
  const view = root.defaultView;

  function blockedIds() {
    return new Set(store.load().novels.map((novel) => novel.id));
  }

  function renderCards() {
    for (const [card] of records) {
      if (!card.isConnected) records.delete(card);
    }
    if (records.size === 0) {
      unmountControls();
      return;
    }
    const blocked = blockedIds();
    for (const { novel, card, container } of records.values()) {
      const isBlocked = blocked.has(novel.id);
      container.classList.toggle(`${PREFIX}-hidden`, isBlocked && !revealBlocked);
      card.classList.toggle(`${PREFIX}-blocked`, isBlocked && revealBlocked);
      card.classList.toggle(`${PREFIX}-selecting`, selecting && !isBlocked);
      if (selecting && !isBlocked) {
        card.tabIndex = 0;
        card.setAttribute('role', 'checkbox');
        card.setAttribute('aria-label', `选择屏蔽《${novel.title}》`);
      } else {
        card.removeAttribute('tabindex');
        card.removeAttribute('role');
        card.removeAttribute('aria-label');
        card.removeAttribute('aria-checked');
      }
      const checkbox = card.querySelector(`.${PREFIX}-checkbox`);
      if (checkbox) {
        checkbox.hidden = !selecting || isBlocked;
        if (!selecting) checkbox.checked = false;
        card.classList.toggle(`${PREFIX}-selected`, selecting && checkbox.checked);
        if (selecting && !isBlocked) card.setAttribute('aria-checked', String(checkbox.checked));
      }
      const restore = card.querySelector(`.${PREFIX}-restore`);
      if (restore) restore.hidden = !(isBlocked && revealBlocked && !selecting);
    }
    renderControls();
  }

  function setNovelSelected(id, selected, shouldRender = true) {
    for (const { novel, card } of records.values()) {
      if (novel.id !== id) continue;
      const checkbox = card.querySelector(`.${PREFIX}-checkbox`);
      checkbox.checked = selected;
      card.classList.toggle(`${PREFIX}-selected`, selected);
      card.setAttribute('aria-checked', String(selected));
    }
    if (shouldRender) renderControls();
  }

  function toggleCardSelection(record, event) {
    if (!selecting || blockedIds().has(record.novel.id)) return;
    event.preventDefault();
    event.stopPropagation();
    const checkbox = record.card.querySelector(`.${PREFIX}-checkbox`);
    const selected = event.target === checkbox ? checkbox.checked : !checkbox.checked;
    setNovelSelected(record.novel.id, selected);
  }

  function addCard(record) {
    if (records.has(record.card)) return;
    records.set(record.card, record);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = `${PREFIX}-checkbox`;
    checkbox.setAttribute('aria-label', `选择屏蔽《${record.novel.title}》`);
    checkbox.tabIndex = -1;
    checkbox.hidden = true;
    record.card.prepend(checkbox);
    record.card.addEventListener('click', (event) => toggleCardSelection(record, event));
    record.card.addEventListener('keydown', (event) => {
      if (event.target === record.card && (event.key === 'Enter' || event.key === ' ')) {
        toggleCardSelection(record, event);
      }
    });

    const restore = button('解除屏蔽', (event) => {
      event.stopPropagation();
      store.unblock([record.novel.id]);
      renderCards();
    }, `${PREFIX}-restore`);
    restore.hidden = true;
    record.card.append(restore);
  }

  function scan(scanRoot = root) {
    for (const record of findNovelCards(scanRoot)) addCard(record);
    if (records.size > 0 && !controls) mountControls();
    renderCards();
  }

  function selectedNovelIds() {
    return new Set([...records.values()]
      .filter(({ card }) => card.querySelector(`.${PREFIX}-checkbox`).checked)
      .map(({ novel }) => novel.id));
  }

  function setAllSelections(selected) {
    const blocked = blockedIds();
    const ids = new Set([...records.values()].map(({ novel }) => novel.id));
    for (const id of ids) {
      if (!blocked.has(id)) setNovelSelected(id, selected, false);
    }
    renderControls();
  }

  function confirmSelection() {
    const selectedIds = selectedNovelIds();
    const selected = new Map();
    for (const { novel } of records.values()) {
      if (selectedIds.has(novel.id)) selected.set(novel.id, novel);
    }
    if (selected.size === 0) return;
    store.block([...selected.values()]);
    selecting = false;
    closePopover();
    renderCards();
  }

  function renderControls() {
    if (!popover) return;
    popover.replaceChildren();
    if (selecting) {
      const selectedCount = selectedNovelIds().size;
      renderFloatingButton('选择中', selectedCount);
      const confirm = button(`确认屏蔽 (${selectedCount})`, confirmSelection, `${PREFIX}-primary`);
      confirm.disabled = selectedCount === 0;
      popover.append(
        createPopoverHeader('批量选择', `已选择 ${selectedCount} 本`),
        confirm,
        button('本页全选', () => setAllSelections(true), `${PREFIX}-secondary`),
        button('清空选择', () => setAllSelections(false), `${PREFIX}-secondary`),
        button('取消', () => {
          selecting = false;
          closePopover();
          renderCards();
        }, `${PREFIX}-quiet`)
      );
    } else {
      const count = store.load().novels.length;
      const pageCount = new Set([...records.values()].map(({ novel }) => novel.id)).size;
      renderFloatingButton('屏蔽', count);
      popover.append(
        createPopoverHeader('小说屏蔽', `本页 ${pageCount} 本 · 已屏蔽 ${count} 本`),
        button('选择屏蔽', () => {
          selecting = true;
          renderCards();
        }, `${PREFIX}-primary`),
        button(revealBlocked ? '隐藏已屏蔽' : `显示已屏蔽 (${count})`, () => {
          revealBlocked = !revealBlocked;
          renderCards();
        }, `${PREFIX}-secondary`),
        button('管理名单', openManager, `${PREFIX}-secondary`)
      );
    }
    applySavedPosition();
    if (!popover.hidden) positionPopover();
  }

  function renderFloatingButton(label, count) {
    if (!floatingButton) return;
    const mark = document.createElement('span');
    mark.className = `${PREFIX}-fab-mark`;
    mark.textContent = '⊘';
    mark.setAttribute('aria-hidden', 'true');
    const labelElement = document.createElement('span');
    labelElement.className = `${PREFIX}-fab-label`;
    labelElement.textContent = label;
    floatingButton.replaceChildren(mark, labelElement);
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = `${PREFIX}-fab-count`;
      badge.textContent = String(count);
      floatingButton.append(badge);
    }
    floatingButton.setAttribute('aria-label', `${label}${count > 0 ? `，${count} 本` : ''}`);
  }

  function closePopover() {
    if (!popover) return;
    popover.hidden = true;
    floatingButton.setAttribute('aria-expanded', 'false');
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function setControlsPosition(left, top) {
    const maxLeft = Math.max(0, view.innerWidth - floatingButton.offsetWidth);
    const maxTop = Math.max(0, view.innerHeight - floatingButton.offsetHeight);
    controls.style.left = `${clamp(left, 0, maxLeft)}px`;
    controls.style.top = `${clamp(top, 0, maxTop)}px`;
    controls.style.right = 'auto';
    controls.style.bottom = 'auto';
  }

  function applySavedPosition() {
    if (!controls || !savedPosition || dragState?.dragging) return;
    const maxLeft = Math.max(0, view.innerWidth - floatingButton.offsetWidth);
    const maxTop = Math.max(0, view.innerHeight - floatingButton.offsetHeight);
    setControlsPosition(savedPosition.x * maxLeft, savedPosition.y * maxTop);
  }

  function saveControlsPosition() {
    const left = Number.parseFloat(controls.style.left);
    const top = Number.parseFloat(controls.style.top);
    const maxLeft = Math.max(0, view.innerWidth - floatingButton.offsetWidth);
    const maxTop = Math.max(0, view.innerHeight - floatingButton.offsetHeight);
    savedPosition = {
      x: maxLeft === 0 ? 0 : clamp(left / maxLeft, 0, 1),
      y: maxTop === 0 ? 0 : clamp(top / maxTop, 0, 1)
    };
    positionStore.save(savedPosition);
  }

  function positionPopover() {
    if (!popover || popover.hidden) return;
    popover.classList.remove(`${PREFIX}-popover-below`, `${PREFIX}-popover-from-left`);
    const triggerRect = floatingButton.getBoundingClientRect();
    const popoverHeight = popover.offsetHeight;
    const popoverWidth = popover.offsetWidth;
    if (triggerRect.top < popoverHeight + 12) {
      popover.classList.add(`${PREFIX}-popover-below`);
    }
    if (triggerRect.right < popoverWidth) {
      popover.classList.add(`${PREFIX}-popover-from-left`);
    }
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    const rect = floatingButton.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      dragging: false
    };
    floatingButton.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.dragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    if (!dragState.dragging) {
      dragState.dragging = true;
      closePopover();
      controls.classList.add(`${PREFIX}-dragging`);
    }
    event.preventDefault();
    setControlsPosition(dragState.startLeft + deltaX, dragState.startTop + deltaY);
  }

  function handlePointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (dragState.dragging) {
      event.preventDefault();
      suppressNextClick = true;
      view.clearTimeout(suppressClickTimeout);
      suppressClickTimeout = view.setTimeout(() => {
        suppressNextClick = false;
        suppressClickTimeout = undefined;
      }, 250);
      controls.classList.remove(`${PREFIX}-dragging`);
      saveControlsPosition();
    }
    if (floatingButton.hasPointerCapture?.(event.pointerId)) {
      floatingButton.releasePointerCapture(event.pointerId);
    }
    dragState = undefined;
  }

  function handleResize() {
    applySavedPosition();
    positionPopover();
  }

  function mountControls() {
    controls = document.createElement('div');
    controls.className = `${PREFIX}-controls`;
    popover = document.createElement('div');
    popover.className = `${PREFIX}-popover`;
    popover.hidden = true;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', '小说屏蔽选项');
    floatingButton = button('屏蔽', () => {
      if (suppressNextClick) {
        suppressNextClick = false;
        view.clearTimeout(suppressClickTimeout);
        suppressClickTimeout = undefined;
        return;
      }
      popover.hidden = !popover.hidden;
      floatingButton.setAttribute('aria-expanded', String(!popover.hidden));
      positionPopover();
    }, `${PREFIX}-fab`);
    floatingButton.title = '小说屏蔽选项';
    floatingButton.setAttribute('aria-haspopup', 'menu');
    floatingButton.setAttribute('aria-expanded', 'false');
    floatingButton.addEventListener('pointerdown', handlePointerDown);
    controls.append(popover, floatingButton);
    root.body.append(controls);
    renderControls();
    applySavedPosition();
  }

  function unmountControls() {
    if (!controls) return;
    controls.remove();
    controls = undefined;
    popover = undefined;
    floatingButton = undefined;
    selecting = false;
    dragState = undefined;
    view.clearTimeout(suppressClickTimeout);
    suppressClickTimeout = undefined;
    suppressNextClick = false;
  }

  function closeManager() {
    const overlay = root.querySelector(`.${PREFIX}-overlay`);
    if (!overlay) return;
    overlay.remove();
    if (managerReturnFocus?.isConnected) managerReturnFocus.focus();
    managerReturnFocus = undefined;
  }

  function handleDocumentClick(event) {
    if (popover && !popover.hidden && !event.composedPath().includes(controls)) closePopover();
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape') return;
    if (root.querySelector(`.${PREFIX}-overlay`)) {
      closeManager();
      return;
    }
    if (selecting) {
      selecting = false;
      renderCards();
    }
    closePopover();
  }

  function openManager() {
    closeManager();
    closePopover();
    managerReturnFocus = root.activeElement;
    const overlay = document.createElement('div');
    overlay.className = `${PREFIX}-overlay`;
    const dialog = document.createElement('section');
    dialog.className = `${PREFIX}-dialog`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', `${PREFIX}-manager-title`);
    const heading = document.createElement('h2');
    heading.id = `${PREFIX}-manager-title`;
    heading.textContent = '屏蔽名单';
    const managerCount = document.createElement('span');
    managerCount.className = `${PREFIX}-manager-count`;
    const headingGroup = document.createElement('div');
    headingGroup.className = `${PREFIX}-dialog-heading`;
    headingGroup.append(heading, managerCount);
    const close = button('关闭', closeManager, `${PREFIX}-dialog-close`);
    close.setAttribute('aria-label', '关闭屏蔽名单');
    close.title = '关闭';
    const header = document.createElement('header');
    header.className = `${PREFIX}-dialog-header`;
    header.append(headingGroup, close);
    const search = document.createElement('input');
    search.className = `${PREFIX}-search`;
    search.type = 'search';
    search.placeholder = '搜索书名';
    search.setAttribute('aria-label', '搜索屏蔽名单');
    const list = document.createElement('div');
    list.className = `${PREFIX}-manager-list`;

    function renderList() {
      const query = search.value.trim().toLocaleLowerCase();
      const blocklist = store.load().novels;
      managerCount.textContent = `${blocklist.length} 本`;
      const novels = blocklist.filter((novel) => novel.title.toLocaleLowerCase().includes(query));
      list.replaceChildren();
      if (novels.length === 0) {
        const empty = document.createElement('p');
        empty.className = `${PREFIX}-empty`;
        const emptyMark = document.createElement('span');
        emptyMark.className = `${PREFIX}-empty-mark`;
        emptyMark.textContent = '⊘';
        emptyMark.setAttribute('aria-hidden', 'true');
        const emptyText = document.createElement('span');
        emptyText.textContent = query ? '没有匹配的小说' : '屏蔽名单为空';
        empty.append(emptyMark, emptyText);
        list.append(empty);
        return;
      }
      for (const novel of novels) {
        const row = document.createElement('div');
        row.className = `${PREFIX}-manager-row`;
        const info = document.createElement('div');
        info.className = `${PREFIX}-manager-info`;
        const link = document.createElement('a');
        link.href = novel.detailUrl;
        link.textContent = novel.title;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const date = document.createElement('span');
        date.className = `${PREFIX}-manager-date`;
        date.textContent = `屏蔽于 ${new Date(novel.blockedAt).toLocaleDateString('zh-CN')}`;
        info.append(link, date);
        row.append(info, button('恢复', () => {
          store.unblock([novel.id]);
          renderList();
          renderCards();
        }, `${PREFIX}-restore-action`));
        list.append(row);
      }
    }

    search.addEventListener('input', renderList);
    const actions = document.createElement('div');
    actions.className = `${PREFIX}-dialog-actions`;
    actions.append(
      button('清空全部', () => {
        if (!window.confirm('确定解除全部小说的屏蔽吗？')) return;
        store.clear();
        renderList();
        renderCards();
      }, `${PREFIX}-danger`)
    );
    dialog.append(header, search, list, actions);
    overlay.append(dialog);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeManager();
    });
    root.body.append(overlay);
    renderList();
    search.focus();
  }

  function showFatalError(error) {
    const alert = document.createElement('div');
    alert.className = `${PREFIX}-fatal`;
    alert.setAttribute('role', 'alert');
    alert.textContent = `esjzone-blocker 无法启动：${error instanceof Error ? error.message : String(error)}`;
    root.body.prepend(alert);
  }

  function start() {
    try {
      store.load();
      savedPosition = positionStore.load();
      scan();
      root.addEventListener('click', handleDocumentClick);
      root.addEventListener('keydown', handleKeydown);
      root.addEventListener('pointermove', handlePointerMove);
      root.addEventListener('pointerup', handlePointerEnd);
      root.addEventListener('pointercancel', handlePointerEnd);
      view.addEventListener('resize', handleResize);
      observer = new MutationObserver((mutations) => {
        let removedNovelCard = false;
        for (const mutation of mutations) {
          for (const node of mutation.removedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches('.card.mb-30') || node.querySelector(NOVEL_LINK_SELECTOR)) {
              removedNovelCard = true;
            }
          }
          for (const node of mutation.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches(NOVEL_LINK_SELECTOR)) {
              scan(node.closest('.card.mb-30') ?? node);
            } else if (node.querySelector(NOVEL_LINK_SELECTOR)) {
              scan(node);
            }
          }
        }
        if (removedNovelCard) renderCards();
      });
      observer.observe(root.body, { childList: true, subtree: true });
      return {
        scan,
        openManager,
        disconnect: () => {
          observer.disconnect();
          root.removeEventListener('click', handleDocumentClick);
          root.removeEventListener('keydown', handleKeydown);
          root.removeEventListener('pointermove', handlePointerMove);
          root.removeEventListener('pointerup', handlePointerEnd);
          root.removeEventListener('pointercancel', handlePointerEnd);
          view.removeEventListener('resize', handleResize);
          view.clearTimeout(suppressClickTimeout);
        }
      };
    } catch (error) {
      showFatalError(error);
      return null;
    }
  }

  return { start, scan, openManager };
}
