import { describe, expect, it } from 'vitest';
import { findNovelCards, parseNovelLink } from '../src/novels.js';

function renderPage() {
  document.body.innerHTML = `
    <div class="row">
      <div class="col-lg-3"><div class="card mb-30" title="作品甲">
        <a class="card-img-tiles" href="/detail/1234567890.html">封面</a>
        <h5 class="card-title"><a href="/detail/1234567890.html">作品甲</a></h5>
      </div></div>
    </div>
    <aside><a href="/detail/9999999999.html">侧栏作品</a></aside>`;
}

describe('novel card discovery', () => {
  it('按严格详情路径提取作品', () => {
    const link = document.createElement('a');
    link.href = '/detail/1234567890.html';
    link.textContent = '作品甲';
    expect(parseNovelLink(link, 'https://www.esjzone.cc')).toEqual({
      id: '1234567890', title: '作品甲', detailUrl: 'https://www.esjzone.cc/detail/1234567890.html'
    });
    link.href = '/forum/1234567890/10.html';
    expect(parseNovelLink(link, 'https://www.esjzone.cc')).toBeNull();
  });

  it('只返回正文小说卡，不误选封面重复项或侧栏链接', () => {
    renderPage();
    const results = findNovelCards();
    expect(results).toHaveLength(1);
    expect(results[0].novel.id).toBe('1234567890');
    expect(results[0].container.classList.contains('col-lg-3')).toBe(true);
  });
});
