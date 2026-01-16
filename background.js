// X Translator Background Service Worker

// 扩展程序安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('X Translator 已安装');
  
  // 设置默认配置
  chrome.storage.sync.set({
    defaultTargetLanguage: 'en',
    autoDetectLanguage: true,
    showReplaceButton: true
  });
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    // 可以在这里处理翻译请求
    sendResponse({ success: true });
  }
  return true;
});
