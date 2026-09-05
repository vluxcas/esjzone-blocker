import { GM_addStyle, GM_getValue, GM_registerMenuCommand, GM_setValue } from '$';
import styles from './styles.css?inline';
import { createApp } from './app.js';
import { createBlocklistStore, createPositionStore } from './store.js';

GM_addStyle(styles);

const store = createBlocklistStore(GM_getValue, GM_setValue);
const positionStore = createPositionStore(GM_getValue, GM_setValue);
const app = createApp(store, positionStore);
const controller = app.start();

if (controller) {
  GM_registerMenuCommand('管理小说屏蔽名单', controller.openManager);
}
