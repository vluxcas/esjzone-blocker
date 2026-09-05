import { describe, expect, it, vi } from 'vitest';
import {
  createBlocklistStore,
  createPositionStore,
  POSITION_STORAGE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  validateBlocklist,
  validatePosition
} from '../src/store.js';

const novel = { id: '1772543244', title: '测试小说', detailUrl: 'https://www.esjzone.cc/detail/1772543244.html' };

function memoryStore(initial) {
  let value = initial;
  return {
    get: vi.fn(() => value),
    set: vi.fn((key, next) => { expect(key).toBe(STORAGE_KEY); value = next; })
  };
}

describe('blocklist store', () => {
  it('首次使用返回空的版本化名单', () => {
    const memory = memoryStore(undefined);
    expect(createBlocklistStore(memory.get, memory.set).load()).toEqual({ version: STORAGE_VERSION, novels: [] });
  });

  it('屏蔽去重并可恢复作品', () => {
    const memory = memoryStore(undefined);
    const store = createBlocklistStore(memory.get, memory.set);
    store.block([novel, novel]);
    expect(store.load().novels).toHaveLength(1);
    expect(store.load().novels[0]).toMatchObject(novel);
    expect(Date.parse(store.load().novels[0].blockedAt)).not.toBeNaN();
    store.unblock([novel.id]);
    expect(store.load()).toEqual({ version: STORAGE_VERSION, novels: [] });
  });

  it('拒绝损坏数据而不是静默重置', () => {
    expect(() => validateBlocklist({ version: 1, novels: [{ id: 'bad' }] })).toThrow('无效的小说记录');
  });

  it('接受两个 ESJ Zone 镜像域名的详情链接', () => {
    expect(validateBlocklist({
      version: STORAGE_VERSION,
      novels: [{ ...novel, detailUrl: 'https://www.esjzone.one/detail/1772543244.html', blockedAt: new Date().toISOString() }]
    }).novels[0].id).toBe(novel.id);
  });
});

describe('floating position store', () => {
  it('首次使用没有自定义位置', () => {
    const get = vi.fn(() => undefined);
    const set = vi.fn();
    expect(createPositionStore(get, set).load()).toBeNull();
    expect(set).not.toHaveBeenCalled();
  });

  it('保存并读取归一化位置', () => {
    let value;
    const store = createPositionStore(() => value, (key, next) => {
      expect(key).toBe(POSITION_STORAGE_KEY);
      value = next;
    });
    store.save({ x: 0.25, y: 0.75 });
    expect(store.load()).toEqual({ x: 0.25, y: 0.75 });
  });

  it('拒绝超出视口比例的损坏位置', () => {
    expect(() => validatePosition({ x: 1.2, y: 0.5 })).toThrow('浮动按钮位置无效');
  });
});
