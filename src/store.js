export const STORAGE_KEY = 'esjzone-blocker:blocklist';
export const POSITION_STORAGE_KEY = 'esjzone-blocker:floating-position';
export const STORAGE_VERSION = 1;

function isNovel(value) {
  return value !== null
    && typeof value === 'object'
    && typeof value.id === 'string'
    && /^\d+$/.test(value.id)
    && typeof value.title === 'string'
    && value.title.length > 0
    && typeof value.detailUrl === 'string'
    && /^https:\/\/www\.esjzone\.(?:cc|one)\/detail\/\d+\.html$/.test(value.detailUrl)
    && typeof value.blockedAt === 'string'
    && !Number.isNaN(Date.parse(value.blockedAt));
}

export function validateBlocklist(value) {
  if (value === null || typeof value !== 'object' || value.version !== STORAGE_VERSION || !Array.isArray(value.novels)) {
    throw new Error('屏蔽名单格式无效，请通过篡改猴存储界面检查数据。');
  }
  if (!value.novels.every(isNovel)) {
    throw new Error('屏蔽名单包含无效的小说记录，请通过篡改猴存储界面检查数据。');
  }
  const ids = new Set(value.novels.map((novel) => novel.id));
  if (ids.size !== value.novels.length) {
    throw new Error('屏蔽名单包含重复的作品 ID。');
  }
  return value;
}

export function createBlocklistStore(getValue, setValue) {
  function load() {
    const stored = getValue(STORAGE_KEY);
    if (stored === undefined) {
      return { version: STORAGE_VERSION, novels: [] };
    }
    return validateBlocklist(stored);
  }

  function save(blocklist) {
    validateBlocklist(blocklist);
    setValue(STORAGE_KEY, blocklist);
    return blocklist;
  }

  return {
    load,
    block(novels) {
      const current = load();
      const byId = new Map(current.novels.map((novel) => [novel.id, novel]));
      for (const novel of novels) {
        if (!byId.has(novel.id)) {
          byId.set(novel.id, { ...novel, blockedAt: new Date().toISOString() });
        }
      }
      return save({ version: STORAGE_VERSION, novels: [...byId.values()] });
    },
    unblock(ids) {
      const idSet = new Set(ids);
      const current = load();
      return save({
        version: STORAGE_VERSION,
        novels: current.novels.filter((novel) => !idSet.has(novel.id))
      });
    },
    clear() {
      return save({ version: STORAGE_VERSION, novels: [] });
    }
  };
}

export function validatePosition(value) {
  if (value === null
    || typeof value !== 'object'
    || typeof value.x !== 'number'
    || typeof value.y !== 'number'
    || !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || value.x < 0
    || value.x > 1
    || value.y < 0
    || value.y > 1) {
    throw new Error('浮动按钮位置无效，请通过篡改猴存储界面检查数据。');
  }
  return value;
}

export function createPositionStore(getValue, setValue) {
  return {
    load() {
      const stored = getValue(POSITION_STORAGE_KEY);
      return stored === undefined ? null : validatePosition(stored);
    },
    save(position) {
      const validPosition = validatePosition(position);
      setValue(POSITION_STORAGE_KEY, validPosition);
      return validPosition;
    }
  };
}
