import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createBlocklistStore } from '../src/store.js';

function setup() {
  document.body.innerHTML = `<main><div class="row"><div class="col-lg-3"><div class="card mb-30">
    <h5 class="card-title"><a href="https://www.esjzone.cc/detail/1234567890.html">作品甲</a></h5>
  </div></div></div></main>`;
  let data;
  const store = createBlocklistStore(() => data, (_key, value) => { data = value; });
  let position = null;
  const positionStore = {
    load: vi.fn(() => position),
    save: vi.fn((value) => { position = value; })
  };
  const controller = createApp(store, positionStore).start();
  return { store, positionStore, controller };
}

function findButton(label) {
  return [...document.querySelectorAll('button')].find((item) => item.textContent === label);
}

function pointerEvent(type, x, y) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

describe('application', () => {
  it('批量选择后隐藏作品，临时显示后可恢复', () => {
    const { store, controller } = setup();
    document.querySelector('.eznb-fab').click();
    [...document.querySelectorAll('button')].find((item) => item.textContent === '选择屏蔽').click();
    const checkbox = document.querySelector('.eznb-checkbox');
    document.querySelector('.card').click();
    expect(checkbox.checked).toBe(true);
    findButton('确认屏蔽 (1)').click();
    expect(store.load().novels.map((item) => item.id)).toEqual(['1234567890']);
    expect(document.querySelector('.col-lg-3').classList.contains('eznb-hidden')).toBe(true);
    [...document.querySelectorAll('button')].find((item) => item.textContent.startsWith('显示已屏蔽')).click();
    expect(document.querySelector('.col-lg-3').classList.contains('eznb-hidden')).toBe(false);
    document.querySelector('.eznb-restore').click();
    expect(store.load().novels).toEqual([]);
    controller.disconnect();
  });

  it('选择模式点击卡片链接只切换选择，不执行导航', () => {
    const { controller } = setup();
    document.querySelector('.eznb-fab').click();
    [...document.querySelectorAll('button')].find((item) => item.textContent === '选择屏蔽').click();
    const link = document.querySelector('.card-title a');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('.eznb-checkbox').checked).toBe(true);
    controller.disconnect();
  });

  it('浮动入口控制操作面板显隐', () => {
    const { controller } = setup();
    const trigger = document.querySelector('.eznb-fab');
    const panel = document.querySelector('.eznb-popover');
    expect(trigger).not.toBeNull();
    expect(panel.hidden).toBe(true);
    trigger.click();
    expect(panel.hidden).toBe(false);
    trigger.click();
    expect(panel.hidden).toBe(true);
    controller.disconnect();
  });

  it('浮动面板展示标题与本页状态摘要', () => {
    const { controller } = setup();
    document.querySelector('.eznb-fab').click();
    expect(document.querySelector('.eznb-popover-title').textContent).toBe('小说屏蔽');
    expect(document.querySelector('.eznb-popover-meta').textContent).toBe('本页 1 本 · 已屏蔽 0 本');
    expect(document.querySelector('.eznb-fab-label').textContent).toBe('屏蔽');
    controller.disconnect();
  });

  it('拖动浮动按钮后保存位置并抑制紧随其后的点击', () => {
    const { positionStore, controller } = setup();
    const trigger = document.querySelector('.eznb-fab');
    trigger.dispatchEvent(pointerEvent('pointerdown', 20, 20));
    document.dispatchEvent(pointerEvent('pointermove', 220, 120));
    document.dispatchEvent(pointerEvent('pointerup', 220, 120));
    expect(positionStore.save).toHaveBeenCalledTimes(1);
    expect(positionStore.save.mock.calls[0][0].x).toBeGreaterThan(0);
    expect(positionStore.save.mock.calls[0][0].y).toBeGreaterThan(0);
    trigger.click();
    expect(document.querySelector('.eznb-popover').hidden).toBe(true);
    trigger.click();
    expect(document.querySelector('.eznb-popover').hidden).toBe(false);
    controller.disconnect();
  });

  it('拖动后没有合成点击时会自动解除点击抑制', async () => {
    const { controller } = setup();
    const trigger = document.querySelector('.eznb-fab');
    trigger.dispatchEvent(pointerEvent('pointerdown', 20, 20));
    document.dispatchEvent(pointerEvent('pointermove', 220, 120));
    document.dispatchEvent(pointerEvent('pointerup', 220, 120));
    await new Promise((resolve) => setTimeout(resolve, 300));
    trigger.click();
    expect(document.querySelector('.eznb-popover').hidden).toBe(false);
    controller.disconnect();
  });

  it('加载已保存位置并限制在视口内', () => {
    document.body.innerHTML = `<main><div class="row"><div class="col-lg-3"><div class="card mb-30">
      <h5 class="card-title"><a href="https://www.esjzone.cc/detail/1234567890.html">作品甲</a></h5>
    </div></div></div></main>`;
    const store = createBlocklistStore(() => undefined, () => {});
    const positionStore = { load: () => ({ x: 1, y: 1 }), save: vi.fn() };
    const controller = createApp(store, positionStore).start();
    const controls = document.querySelector('.eznb-controls');
    expect(controls.style.right).toBe('auto');
    expect(controls.style.bottom).toBe('auto');
    expect(Number.parseFloat(controls.style.left)).toBeLessThanOrEqual(window.innerWidth);
    expect(Number.parseFloat(controls.style.top)).toBeLessThanOrEqual(window.innerHeight);
    controller.disconnect();
  });

  it('没有小说卡片时不显示浮动入口', () => {
    document.body.innerHTML = '<main><p>章节正文</p></main>';
    const store = createBlocklistStore(() => undefined, () => {});
    const positionStore = { load: () => null, save: () => {} };
    const controller = createApp(store, positionStore).start();
    expect(document.querySelector('.eznb-fab')).toBeNull();
    controller.disconnect();
  });

  it('选择面板显示数量并支持全选和清空', () => {
    const { controller } = setup();
    document.querySelector('.eznb-fab').click();
    findButton('选择屏蔽').click();
    expect(findButton('确认屏蔽 (0)').disabled).toBe(true);
    findButton('本页全选').click();
    expect(document.querySelector('.eznb-checkbox').checked).toBe(true);
    expect(findButton('确认屏蔽 (1)').disabled).toBe(false);
    findButton('清空选择').click();
    expect(document.querySelector('.eznb-checkbox').checked).toBe(false);
    expect(findButton('确认屏蔽 (0)').disabled).toBe(true);
    controller.disconnect();
  });

  it('点击面板外部或按 Escape 会关闭浮层', () => {
    const { controller } = setup();
    const trigger = document.querySelector('.eznb-fab');
    const panel = document.querySelector('.eznb-popover');
    trigger.click();
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.hidden).toBe(true);
    trigger.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.hidden).toBe(true);
    controller.openManager();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.eznb-overlay')).toBeNull();
    controller.disconnect();
  });

  it('同一作品的重复卡片都会隐藏', () => {
    const { store, controller } = setup();
    document.querySelector('.row').insertAdjacentHTML('beforeend', `<div class="col-lg-3"><div class="card mb-30">
      <h5 class="card-title"><a href="https://www.esjzone.cc/detail/1234567890.html">作品甲</a></h5>
    </div></div>`);
    controller.scan();
    store.block([{ id: '1234567890', title: '作品甲', detailUrl: 'https://www.esjzone.cc/detail/1234567890.html' }]);
    controller.scan();
    expect([...document.querySelectorAll('.col-lg-3')].every((item) => item.classList.contains('eznb-hidden'))).toBe(true);
    controller.disconnect();
  });

  it('选择模式不会显示恢复按钮或把恢复操作重新选中', () => {
    const { store, controller } = setup();
    store.block([{ id: '1234567890', title: '作品甲', detailUrl: 'https://www.esjzone.cc/detail/1234567890.html' }]);
    controller.scan();
    document.querySelector('.eznb-fab').click();
    findButton('显示已屏蔽 (1)').click();
    findButton('选择屏蔽').click();
    const restore = document.querySelector('.eznb-restore');
    expect(restore.hidden).toBe(true);
    restore.click();
    expect(document.querySelector('.eznb-checkbox').checked).toBe(false);
    controller.disconnect();
  });

  it('动态移除卡片后不保留旧选择或浮动入口', async () => {
    const { controller } = setup();
    document.querySelector('.eznb-fab').click();
    findButton('选择屏蔽').click();
    document.querySelector('.card').click();
    document.querySelector('.row').replaceChildren();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.eznb-fab')).toBeNull();
    controller.disconnect();
  });

  it('卡片键盘处理不拦截复选框自身事件', () => {
    const { controller } = setup();
    document.querySelector('.eznb-fab').click();
    findButton('选择屏蔽').click();
    const checkbox = document.querySelector('.eznb-checkbox');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    checkbox.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    controller.disconnect();
  });

  it('动态加入的作品卡会被扫描', async () => {
    const { controller } = setup();
    document.querySelector('.row').insertAdjacentHTML('beforeend', `<div class="col-lg-3"><div class="card mb-30">
      <h5 class="card-title"><a href="https://www.esjzone.cc/detail/2222222222.html">作品乙</a></h5>
    </div></div>`);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelectorAll('.eznb-checkbox')).toHaveLength(2);
    controller.disconnect();
  });

  it('清空全部前要求确认', () => {
    const { store, controller } = setup();
    store.block([{ id: '1234567890', title: '作品甲', detailUrl: 'https://www.esjzone.cc/detail/1234567890.html' }]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    controller.openManager();
    [...document.querySelectorAll('button')].find((item) => item.textContent === '清空全部').click();
    expect(store.load().novels).toHaveLength(1);
    controller.disconnect();
  });

  it('名单弹窗展示总数、屏蔽日期与独立关闭按钮', () => {
    const { store, controller } = setup();
    store.block([{ id: '1234567890', title: '作品甲', detailUrl: 'https://www.esjzone.cc/detail/1234567890.html' }]);
    controller.openManager();
    expect(document.querySelector('.eznb-manager-count').textContent).toBe('1 本');
    expect(document.querySelector('.eznb-manager-date').textContent).toMatch(/^屏蔽于 \d{4}\/\d{1,2}\/\d{1,2}$/);
    expect(document.querySelector('.eznb-dialog-close').getAttribute('aria-label')).toBe('关闭屏蔽名单');
    controller.disconnect();
  });

  it('位置数据损坏时不留下半初始化界面', () => {
    document.body.innerHTML = `<main><div class="row"><div class="col-lg-3"><div class="card mb-30">
      <h5 class="card-title"><a href="https://www.esjzone.cc/detail/1234567890.html">作品甲</a></h5>
    </div></div></div></main>`;
    const store = createBlocklistStore(() => undefined, () => {});
    const positionStore = {
      load: () => { throw new Error('浮动按钮位置无效'); },
      save: vi.fn()
    };

    const controller = createApp(store, positionStore).start();

    expect(controller).toBeNull();
    expect(document.querySelector('.eznb-fatal').textContent).toContain('浮动按钮位置无效');
    expect(document.querySelector('.eznb-controls')).toBeNull();
    expect(document.querySelector('.eznb-checkbox')).toBeNull();
    expect(document.querySelector('.eznb-restore')).toBeNull();
  });

  it('没有小说卡片时也会在启动阶段校验位置数据', () => {
    document.body.innerHTML = '<main><p>章节正文</p></main>';
    const store = createBlocklistStore(() => undefined, () => {});
    const positionStore = {
      load: vi.fn(() => { throw new Error('浮动按钮位置无效'); }),
      save: vi.fn()
    };

    const controller = createApp(store, positionStore).start();

    expect(controller).toBeNull();
    expect(positionStore.load).toHaveBeenCalledOnce();
    expect(document.querySelector('.eznb-fatal').textContent).toContain('浮动按钮位置无效');
    expect(document.querySelector('.eznb-controls')).toBeNull();
  });
});
