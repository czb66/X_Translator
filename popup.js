// Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const defaultLangSelect = document.getElementById('defaultLang');
  
  // 加载保存的设置
  chrome.storage.sync.get(['defaultTargetLanguage'], (result) => {
    if (result.defaultTargetLanguage) {
      defaultLangSelect.value = result.defaultTargetLanguage;
    }
  });
  
  // 保存设置
  defaultLangSelect.addEventListener('change', (e) => {
    chrome.storage.sync.set({
      defaultTargetLanguage: e.target.value
    });
  });
});
