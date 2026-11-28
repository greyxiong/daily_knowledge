// Keep the verified public build available until the signed recorder edition ships.
async function showRecorderDownload() {
  const repo = 'greyxiong/daily_knowledge';
  const tag = 'desktop-v0.6.0';
  const name = 'Daily-Knowledge.dmg';
  const url = 'https://github.com/' + repo + '/releases/download/' + tag + '/' + name;
  try {
    const response = await fetch('https://api.github.com/repos/' + repo + '/releases/tags/' + tag, {credentials:'omit', referrerPolicy:'no-referrer'});
    if (!response.ok) return;
    const release = await response.json();
    if (release.tag_name !== tag || release.draft || release.prerelease) return;
    if (!release.assets.some(asset => asset.name === name && asset.state === 'uploaded' && asset.size > 0 && asset.browser_download_url === url)) return;
    document.querySelector('#mac-hero').href = url;
    document.querySelector('#mac-action').href = url;
    document.querySelector('#edition').textContent = 'v0.6.0 · 含双轨记录仪等五套外观。打开磁盘映像，把小书拖入「应用程序」。';
  } catch {
    // The static links still lead directly to the existing signed release.
  }
}
showRecorderDownload();
