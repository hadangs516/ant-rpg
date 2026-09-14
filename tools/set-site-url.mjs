import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Use the public game directory, including a GitHub Pages repository path. */
export function normalizeSiteUrl(input) {
  let url;
  try { url = new URL(String(input || '').trim()); }
  catch { throw new Error('올바른 공개 게임 주소를 입력해 주세요.'); }
  if (url.protocol !== 'https:') throw new Error('게임 주소는 https://로 시작해야 합니다.');
  if (url.username || url.password) throw new Error('로그인 정보가 포함된 주소는 사용할 수 없습니다.');
  if (url.search || url.hash) throw new Error('물음표나 우물정자 뒤의 값을 제외한 기본 게임 주소를 입력해 주세요.');
  url.pathname = url.pathname.replace(/\/index\.html?$/i, '/');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

const attribute = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function setMeta(html, kind, key, value) {
  const matchKey = new RegExp(`\\b${kind}\\s*=\\s*(["'])${key.replaceAll(':', '\\:')}\\1`, 'i');
  const replacement = `<meta ${kind}="${key}" content="${attribute(value)}">`;
  let found = false;
  const updated = html.replace(/<meta\b[^>]*>/gi, tag => {
    if (!matchKey.test(tag)) return tag;
    if (found) return '';
    found = true;
    return replacement;
  });
  return found ? updated : updated.replace(/<\/head\s*>/i, `${replacement}\n</head>`);
}

/** Pure transformation; importing this module never edits the website. */
export function updateSiteMetadata(html, input) {
  if (typeof html !== 'string' || !/<\/head\s*>/i.test(html)) throw new Error('index.html의 머리말 영역을 찾을 수 없습니다.');
  const site = normalizeSiteUrl(input);
  let updated = setMeta(html, 'property', 'og:url', site);
  updated = setMeta(updated, 'property', 'og:image', new URL('assets/kakao-preview.png', site).href);
  return setMeta(updated, 'name', 'twitter:image', new URL('assets/share-preview.png', site).href);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 3) throw new Error('사용법: node tools/set-site-url.mjs "https://계정이름.github.io/저장소이름/"');
    const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
    const source = await readFile(indexPath, 'utf8');
    const site = normalizeSiteUrl(process.argv[2]);
    await writeFile(indexPath, updateSiteMetadata(source, site), 'utf8');
    console.log(`공유 이미지 주소 설정 완료: ${site}\n변경된 index.html을 GitHub 저장소에 올려 주세요.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
