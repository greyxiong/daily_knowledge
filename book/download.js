const releaseTag = 'desktop-v0.5.2';
const repository = 'greyxiong/daily_knowledge';
const assetName = 'Daily-Knowledge.dmg';
const releasesPage = 'https://github.com/' + repository + '/releases';

async function showMacDownload() {
  const action = document.getElementById('mac-action');
  const status = document.getElementById('mac-status');
  try {
    const response = await fetch('https://api.github.com/repos/' + repository + '/releases/tags/' + releaseTag, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer'
    });
    if (response.status === 404) return;
    if (!response.ok) throw new Error('Release lookup unavailable');
    const release = await response.json();
    const url = releasesPage + '/download/' + releaseTag + '/' + assetName;
    if (release.tag_name !== releaseTag || release.draft || release.prerelease) return;
    const asset = release.assets.find(file => file.name === assetName && file.state === 'uploaded'
      && file.size > 0 && file.browser_download_url === url);
    if (!asset) return;

    for (const link of [action, document.getElementById('mac-hero')]) {
      link.href = url;
      link.textContent = '下载 Mac 版 (.dmg)';
    }
    status.textContent = '适用于 macOS 13 及以上，支持 Apple 芯片和 Intel。打开磁盘映像，将 Daily Knowledge 拖入「应用程序」，再从那里打开。';
  } catch {
    status.textContent = '暂时无法检查安装包状态。可以前往发布页查看可下载的版本。';
    action.textContent = '查看 Mac 发布记录';
    action.href = releasesPage;
  }
}

showMacDownload();
