// X Translator Content Script
// 自动识别输入场景，智能翻译，支持一键替换

class XTranslator {
  constructor() {
    this.selectedText = '';
    this.isInInput = false;
    this.currentInputElement = null;
    this.translationCard = null;
    this.targetLanguage = 'en'; // 默认英语
    this.savedRange = null; // 保存的选择范围
    this.keyboardHandler = null; // 键盘事件处理器
    this.userSelectedLanguage = null; // 用户手动选择的目标语言
    this.init();
  }

  init() {
    // 监听文本选择事件
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    document.addEventListener('keyup', this.handleTextSelection.bind(this));
    
    // 监听输入框焦点事件
    document.addEventListener('focusin', this.handleFocusIn.bind(this));
    document.addEventListener('focusout', this.handleFocusOut.bind(this));
    
    // 检测当前页面的推文语言
    this.detectTweetLanguage();
    
    // 加载用户保存的语言偏好
    this.loadUserLanguagePreference();
  }

  // 加载用户保存的语言偏好
  async loadUserLanguagePreference() {
    try {
      const result = await chrome.storage.sync.get(['defaultTargetLanguage', 'userSelectedLanguage']);
      if (result.userSelectedLanguage) {
        this.userSelectedLanguage = result.userSelectedLanguage;
      } else if (result.defaultTargetLanguage) {
        this.userSelectedLanguage = result.defaultTargetLanguage;
      }
    } catch (error) {
      console.log('无法加载语言偏好:', error);
    }
  }

  // 保存用户选择的语言
  async saveUserLanguagePreference(lang) {
    try {
      await chrome.storage.sync.set({ userSelectedLanguage: lang });
      this.userSelectedLanguage = lang;
    } catch (error) {
      console.log('无法保存语言偏好:', error);
    }
  }

  // 检测当前推文的语言
  detectTweetLanguage() {
    // 如果用户已经手动选择了语言，优先使用用户选择
    if (this.userSelectedLanguage) {
      this.targetLanguage = this.userSelectedLanguage;
      return;
    }
    
    // 查找当前可见的推文
    const tweets = document.querySelectorAll('[data-testid="tweetText"]');
    if (tweets.length > 0) {
      const tweetText = tweets[0].textContent;
      // 使用简单的语言检测（实际可以使用更复杂的API）
      const detectedLang = this.detectLanguage(tweetText);
      this.targetLanguage = detectedLang || 'en';
      console.log('检测到推文语言:', this.targetLanguage);
    } else {
      // 如果没有推文，使用默认语言
      this.targetLanguage = this.userSelectedLanguage || 'en';
    }
  }

  // 简单的语言检测（可以后续集成更准确的API）
  detectLanguage(text) {
    // 检测中文
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return 'zh';
    }
    // 检测日语
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return 'ja';
    }
    // 检测韩语
    if (/[\uac00-\ud7a3]/.test(text)) {
      return 'ko';
    }
    // 默认英语
    return 'en';
  }

  // 处理输入框获得焦点
  handleFocusIn(event) {
    const target = event.target;
    // 检查是否是输入框（推文回复框、推文输入框等）
    if (this.isInputElement(target)) {
      this.isInInput = true;
      this.currentInputElement = target;
      console.log('检测到输入框焦点');
    }
  }

  // 处理输入框失去焦点
  handleFocusOut(event) {
    // 延迟检查，避免立即清除状态
    // 注意：不要清除 currentInputElement，因为替换功能需要它
    setTimeout(() => {
      if (!document.activeElement || !this.isInputElement(document.activeElement)) {
        this.isInInput = false;
        // 只有在没有翻译卡片显示时才清除 currentInputElement
        // 这样可以确保替换功能正常工作
        if (!this.translationCard || !this.translationCard.isConnected) {
          this.currentInputElement = null;
        }
      }
    }, 100);
  }

  // 判断是否是输入元素
  isInputElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const isEditable = element.isContentEditable;
    
    // 检查是否是输入框、文本域或可编辑元素
    // 特别检查 X (Twitter) 的输入框
    const isTwitterInput = 
      element.closest('[data-testid="tweetTextarea_0"]') !== null ||
      element.closest('[data-testid="tweetTextarea_0"]') !== null ||
      element.closest('div[contenteditable="true"]') !== null ||
      element.closest('.DraftEditor-root') !== null ||
      element.closest('.public-DraftEditor-content') !== null ||
      element.closest('[aria-label*="推文"]') !== null ||
      element.closest('[aria-label*="Tweet"]') !== null ||
      element.closest('[aria-label*="Post"]') !== null;
    
    return (
      tagName === 'textarea' ||
      tagName === 'input' ||
      isEditable ||
      role === 'textbox' ||
      element.hasAttribute('contenteditable') ||
      element.classList.contains('DraftEditor-root') ||
      element.classList.contains('public-DraftEditor-content') ||
      isTwitterInput
    );
  }

  // 处理文本选择
  handleTextSelection(event) {
    // 如果点击在翻译卡片内，不处理（避免干扰下拉菜单等交互）
    if (event && event.target) {
      const clickedElement = event.target;
      if (this.translationCard && this.translationCard.contains(clickedElement)) {
        return;
      }
    }
    
    // 延迟处理，确保选择完成
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      // 如果点击在翻译卡片内，不隐藏卡片
      if (event && event.target) {
        const clickedElement = event.target;
        if (this.translationCard && this.translationCard.contains(clickedElement)) {
          return;
        }
      }
      
      if (!selectedText) {
        // 只有在点击不在卡片内时才隐藏
        if (!event || !event.target || !this.translationCard || !this.translationCard.contains(event.target)) {
          this.hideTranslationCard();
        }
        return;
      }

      // 检查选择是否在输入框中
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (!range) return;

      const container = range.commonAncestorContainer;
      const isInInputContext = this.isInInputElement(container);

      if (isInInputContext && selectedText.length > 0) {
        // 在输入框中选择了文字 - "写字"场景
        this.selectedText = selectedText;
        this.isInInput = true;
        
        // 找到对应的输入元素
        this.currentInputElement = this.findInputElement(container);
        
        // 保存当前选择范围（用于替换）
        this.savedRange = range.cloneRange();
        
        // 检测目标语言（如果用户没有手动选择，则使用检测到的语言）
        if (!this.userSelectedLanguage) {
          this.detectTweetLanguage();
        } else {
          this.targetLanguage = this.userSelectedLanguage;
        }
        
        // 显示翻译卡片
        this.showTranslationCard(selectedText, event);
      } else if (!isInInputContext && selectedText.length > 0) {
        // 在非输入框中选择文字 - "看书"场景，翻译成中文
        this.selectedText = selectedText;
        this.isInInput = false;
        this.targetLanguage = 'zh'; // 看书时翻译成中文
        this.showTranslationCard(selectedText, event);
      }
    }, 10);
  }

  // 检查节点是否在输入框中
  isInInputElement(node) {
    let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    
    while (element && element !== document.body) {
      if (this.isInputElement(element)) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  }

  // 找到输入元素
  findInputElement(node) {
    let element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    
    while (element && element !== document.body) {
      if (this.isInputElement(element)) {
        return element;
      }
      element = element.parentElement;
    }
    return null;
  }

  // 显示翻译卡片
  async showTranslationCard(text, event) {
    // 移除旧的卡片
    this.hideTranslationCard();

    // 确保有选中的文本
    if (!text || !text.trim()) {
      console.warn('没有文本可翻译');
      return;
    }

    // 获取选择位置
    const selection = window.getSelection();
    if (selection.rangeCount === 0) {
      console.warn('没有有效的选择范围');
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 保存当前选择范围（用于替换）
    try {
      this.savedRange = range.cloneRange();
    } catch (e) {
      console.warn('无法保存选择范围:', e);
      this.savedRange = null;
    }
    
    // 确保 currentInputElement 和 selectedText 已设置
    if (this.isInInput && !this.currentInputElement) {
      console.warn('在输入模式下但缺少输入元素，尝试重新查找');
      // 尝试重新查找输入元素
      const container = range.commonAncestorContainer;
      this.currentInputElement = this.findInputElement(container);
    }
    
    // 确保 selectedText 已设置
    if (!this.selectedText) {
      this.selectedText = text;
    }

    // 创建翻译卡片
    this.translationCard = document.createElement('div');
    this.translationCard.className = 'xt-translator-card';
    
    // 根据场景显示不同的标签
    const modeLabel = this.isInInput ? '写字模式' : '看书模式';
    const targetLangLabel = this.getLanguageLabel(this.targetLanguage);
    
    // 生成语言选择器（仅在写字模式下显示）
    const languageSelector = this.isInInput ? this.generateLanguageSelector() : '';
    
    this.translationCard.innerHTML = `
      <div class="xt-translator-header">
        <span class="xt-translator-label">${modeLabel} → ${targetLangLabel}</span>
        <button class="xt-translator-close" aria-label="关闭">×</button>
      </div>
      ${languageSelector}
      <div class="xt-translator-content">
        <div class="xt-translator-original">
          <strong>原文:</strong> ${this.escapeHtml(text)}
        </div>
        <div class="xt-translator-result">
          <strong>译文:</strong> <span class="xt-translator-text">翻译中...</span>
        </div>
      </div>
      <div class="xt-translator-actions">
        ${this.isInInput ? '<button class="xt-translator-replace-btn" title="按 Enter 键快速替换">替换 (Enter)</button>' : ''}
        <button class="xt-translator-copy-btn">复制</button>
      </div>
    `;

    document.body.appendChild(this.translationCard);

    // 阻止卡片内的事件冒泡到文档级别（避免干扰下拉菜单等交互）
    this.translationCard.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    
    this.translationCard.addEventListener('click', (e) => {
      // 允许内部元素的事件，但阻止冒泡到文档
      if (e.target.closest('.xt-translator-lang-select')) {
        e.stopPropagation();
      }
    });

    // 定位卡片
    this.positionCard(rect);

    // 绑定事件
    this.translationCard.querySelector('.xt-translator-close').addEventListener('click', () => {
      this.hideTranslationCard();
    });

    // 绑定语言选择器事件（仅在写字模式下）
    if (this.isInInput) {
      const langSelect = this.translationCard.querySelector('.xt-translator-lang-select');
      if (langSelect) {
        langSelect.value = this.targetLanguage;
        
        // 阻止事件冒泡，避免触发其他事件处理器
        langSelect.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
        
        langSelect.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        
        langSelect.addEventListener('change', async (e) => {
          e.stopPropagation();
          const newLang = e.target.value;
          this.targetLanguage = newLang;
          await this.saveUserLanguagePreference(newLang);
          
          // 更新标签
          const label = this.translationCard.querySelector('.xt-translator-label');
          if (label) {
            label.textContent = `写字模式 → ${this.getLanguageLabel(newLang)}`;
          }
          
          // 重新翻译
          const resultElement = this.translationCard.querySelector('.xt-translator-text');
          if (resultElement) {
            resultElement.textContent = '翻译中...';
            const translatedText = await this.translateText(text, newLang);
            resultElement.textContent = translatedText;
            
            // 更新替换按钮状态
            const replaceBtn = this.translationCard.querySelector('.xt-translator-replace-btn');
            if (replaceBtn) {
              if (translatedText === '翻译失败' || translatedText.startsWith('翻译失败:')) {
                replaceBtn.disabled = true;
                replaceBtn.textContent = '无法替换';
              } else {
                replaceBtn.disabled = false;
                replaceBtn.textContent = '替换 (Enter)';
              }
            }
          }
        });
      }
    }

    if (this.isInInput) {
      const replaceBtn = this.translationCard.querySelector('.xt-translator-replace-btn');
      replaceBtn.addEventListener('click', () => {
        this.replaceText();
      });
      
      // 添加键盘快捷键：Enter 键快速替换
      replaceBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.replaceText();
        }
      });
    }

    const copyBtn = this.translationCard.querySelector('.xt-translator-copy-btn');
    copyBtn.addEventListener('click', () => {
      this.copyToClipboard();
    });

    // 添加全局键盘事件：在输入框中按 Enter 键快速替换
    if (this.isInInput) {
      this.keyboardHandler = (e) => {
        // Enter 键且没有按 Shift（避免换行）
        if (e.key === 'Enter' && !e.shiftKey && this.translationCard) {
          const replaceBtn = this.translationCard.querySelector('.xt-translator-replace-btn');
          if (replaceBtn && !replaceBtn.disabled) {
            e.preventDefault();
            e.stopPropagation();
            this.replaceText();
          }
        }
      };
      
      // 添加键盘监听（使用 capture 确保优先处理）
      document.addEventListener('keydown', this.keyboardHandler, { capture: true });
    }

    // 执行翻译
    const translatedText = await this.translateText(text, this.targetLanguage);
    
    // 检查卡片是否仍然存在（可能在翻译过程中被关闭）
    if (!this.translationCard || !this.translationCard.isConnected) {
      console.log('翻译卡片已被关闭，跳过更新');
      return;
    }
    
    const resultElement = this.translationCard.querySelector('.xt-translator-text');
    if (resultElement) {
      resultElement.textContent = translatedText;
      // 更新替换按钮状态
      if (this.isInInput) {
        const replaceBtn = this.translationCard.querySelector('.xt-translator-replace-btn');
        if (replaceBtn) {
          if (translatedText === '翻译失败' || translatedText.startsWith('翻译失败:')) {
            replaceBtn.disabled = true;
            replaceBtn.textContent = '无法替换';
          } else {
            replaceBtn.disabled = false;
            replaceBtn.textContent = '替换 (Enter)';
          }
        }
      }
    }
  }

  // 生成语言选择器HTML
  generateLanguageSelector() {
    const languages = [
      { code: 'en', name: '英语' },
      { code: 'zh', name: '中文' },
      { code: 'ja', name: '日语' },
      { code: 'ko', name: '韩语' },
      { code: 'es', name: '西班牙语' },
      { code: 'fr', name: '法语' },
      { code: 'de', name: '德语' },
      { code: 'ru', name: '俄语' },
      { code: 'pt', name: '葡萄牙语' },
      { code: 'it', name: '意大利语' },
      { code: 'ar', name: '阿拉伯语' },
      { code: 'hi', name: '印地语' }
    ];
    
    const options = languages.map(lang => 
      `<option value="${lang.code}">${lang.name}</option>`
    ).join('');
    
    return `
      <div class="xt-translator-lang-selector">
        <label for="xt-lang-select">目标语言:</label>
        <select id="xt-lang-select" class="xt-translator-lang-select">
          ${options}
        </select>
      </div>
    `;
  }

  // 获取语言标签
  getLanguageLabel(langCode) {
    const labels = {
      'zh': '中文',
      'en': '英语',
      'ja': '日语',
      'ko': '韩语',
      'es': '西班牙语',
      'fr': '法语',
      'de': '德语',
      'ru': '俄语',
      'pt': '葡萄牙语',
      'it': '意大利语',
      'ar': '阿拉伯语',
      'hi': '印地语'
    };
    return labels[langCode] || langCode.toUpperCase();
  }

  // 复制到剪贴板
  async copyToClipboard() {
    const translatedText = this.translationCard.querySelector('.xt-translator-text').textContent;
    try {
      await navigator.clipboard.writeText(translatedText);
      const copyBtn = this.translationCard.querySelector('.xt-translator-copy-btn');
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '已复制！';
      copyBtn.style.background = '#1da1f2';
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = '';
      }, 2000);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动选择复制');
    }
  }

  // 定位卡片
  positionCard(rect) {
    const card = this.translationCard;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    // 计算位置：在选择文本下方
    let top = rect.bottom + scrollY + 10;
    let left = rect.left + scrollX;

    // 确保不超出视窗
    const cardWidth = 320;
    const cardHeight = 200;
    
    if (left + cardWidth > window.innerWidth + scrollX) {
      left = window.innerWidth + scrollX - cardWidth - 10;
    }
    
    if (top + cardHeight > window.innerHeight + scrollY) {
      top = rect.top + scrollY - cardHeight - 10;
    }

    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  // 翻译文本
  async translateText(text, targetLang) {
    try {
      // 使用 Google Translate API（免费版本）
      // 注意：实际使用时需要配置API密钥或使用其他翻译服务
      const sourceLang = this.detectLanguage(text);
      
      // 如果源语言和目标语言相同，返回原文
      if (sourceLang === targetLang) {
        return text;
      }

      // 使用 Google Translate 免费API
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        return data[0][0][0];
      }
      
      return '翻译失败';
    } catch (error) {
      console.error('翻译错误:', error);
      return '翻译失败: ' + error.message;
    }
  }

  // 替换文本
  async replaceText() {
    // 检查必要元素
    if (!this.currentInputElement || !this.selectedText) {
      console.warn('无法替换：缺少输入元素或选中文本', {
        hasInputElement: !!this.currentInputElement,
        hasSelectedText: !!this.selectedText
      });
      return;
    }

    // 检查翻译卡片是否存在
    if (!this.translationCard || !this.translationCard.isConnected) {
      console.warn('无法替换：翻译卡片不存在或已被关闭');
      return;
    }

    const textElement = this.translationCard.querySelector('.xt-translator-text');
    if (!textElement) {
      console.warn('无法替换：找不到翻译结果元素');
      return;
    }

    const translatedText = textElement.textContent;
    if (!translatedText || translatedText === '翻译失败' || translatedText.startsWith('翻译失败:') || translatedText === '翻译中...') {
      console.warn('无法替换：翻译失败或未完成', translatedText);
      return;
    }
    
    console.log('开始替换文本:', {
      selectedText: this.selectedText,
      translatedText: translatedText,
      element: this.currentInputElement,
      isContentEditable: this.currentInputElement.isContentEditable,
      tagName: this.currentInputElement.tagName
    });
    
    try {
      // 先聚焦到输入元素
      if (this.currentInputElement.focus) {
        this.currentInputElement.focus();
      }
      
      // 等待焦点设置完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 执行替换
      await this.performReplace(translatedText);
    } catch (error) {
      console.error('替换文本时出错:', error);
      this.replaceViaClipboard(translatedText);
    }
  }

  // 执行实际的替换操作
  async performReplace(translatedText) {
    try {
      // 确保输入元素仍然有效
      if (!this.currentInputElement || !this.currentInputElement.isConnected) {
        console.warn('输入元素已失效');
        this.replaceViaClipboard(translatedText);
        return;
      }
      
      // 先尝试聚焦
      if (this.currentInputElement.focus) {
        this.currentInputElement.focus();
        // 等待焦点设置
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (this.currentInputElement.isContentEditable) {
        // 处理可编辑元素（包括 X 的 Draft.js 编辑器）
        this.replaceInEditableElement(translatedText);
      } else if (this.currentInputElement.tagName === 'TEXTAREA' || this.currentInputElement.tagName === 'INPUT') {
        // 处理普通输入框
        this.replaceInInputElement(translatedText);
        // 普通输入框替换后可以立即隐藏卡片
        setTimeout(() => {
          this.hideTranslationCard();
        }, 100);
      } else {
        // 尝试作为可编辑元素处理
        this.replaceInEditableElement(translatedText);
      }
      
      // 对于可编辑元素，延迟隐藏卡片（等待替换完成）
      if (this.currentInputElement.isContentEditable) {
        setTimeout(() => {
          this.hideTranslationCard();
        }, 300);
      }
    } catch (error) {
      console.error('执行替换时出错:', error);
      // 尝试备用方法：使用剪贴板
      this.replaceViaClipboard(translatedText);
    }
  }

  // 在可编辑元素中替换
  async replaceInEditableElement(translatedText) {
    console.log('在可编辑元素中替换');
    
    // 方法1: 尝试使用键盘模拟输入（最可靠）
    if (await this.tryKeyboardInput(translatedText)) {
      console.log('键盘输入方法成功');
      return;
    }
    
    // 方法2: 尝试使用 execCommand
    if (await this.tryExecCommandReplace(translatedText)) {
      console.log('execCommand 方法成功');
      return;
    }
    
    // 方法3: 尝试使用剪贴板方法
    if (await this.tryClipboardReplace(translatedText)) {
      console.log('剪贴板方法成功');
      return;
    }
    
    // 方法4: 直接操作DOM
    console.log('尝试直接DOM操作');
    const selection = window.getSelection();
    
    // 尝试使用保存的范围
    let range = null;
    if (this.savedRange) {
      try {
        const container = this.savedRange.commonAncestorContainer;
        if (container && container.isConnected) {
          range = this.savedRange.cloneRange();
          console.log('使用保存的范围');
        }
      } catch (e) {
        console.log('保存的范围无效');
      }
    }
    
    // 如果没有有效的保存范围，尝试使用当前选择
    if (!range && selection.rangeCount > 0) {
      range = selection.getRangeAt(0);
      console.log('使用当前选择');
    }
    
    // 如果还是没有范围，尝试在输入元素中创建新范围
    if (!range && this.currentInputElement) {
      range = this.findTextRange(this.currentInputElement, this.selectedText);
      if (range) {
        console.log('通过查找文本找到范围');
      }
    }
    
    if (range) {
      try {
        // 选中范围
        selection.removeAllRanges();
        selection.addRange(range);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 删除选中的内容
        range.deleteContents();
        
        // 插入翻译后的文本
        const textNode = document.createTextNode(translatedText);
        range.insertNode(textNode);
        
        // 移动光标到文本末尾
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 触发各种事件
        this.triggerInputEvents(translatedText);
        console.log('DOM操作完成');
      } catch (error) {
        console.error('DOM操作失败:', error);
        this.replaceViaClipboard(translatedText);
      }
    } else {
      console.warn('无法找到要替换的文本范围');
      this.replaceViaClipboard(translatedText);
    }
  }

  // 使用键盘模拟输入（最可靠的方法）
  async tryKeyboardInput(translatedText) {
    try {
      const element = this.currentInputElement;
      if (!element) return false;
      
      // 确保聚焦
      element.focus();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 找到要替换的文本并选中
      const selection = window.getSelection();
      let range = null;
      
      if (this.savedRange) {
        try {
          const container = this.savedRange.commonAncestorContainer;
          if (container && container.isConnected) {
            range = this.savedRange.cloneRange();
          }
        } catch (e) {
          // 忽略
        }
      }
      
      if (!range) {
        range = this.findTextRange(element, this.selectedText);
      }
      
      if (!range && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }
      
      if (!range) {
        console.log('无法找到要替换的范围');
        return false;
      }
      
      // 选中文本
      selection.removeAllRanges();
      selection.addRange(range);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 方法1: 尝试使用 insertText（最简单直接）
      try {
        if (document.execCommand && document.execCommand('insertText', false, translatedText)) {
          this.triggerInputEvents(translatedText);
          return true;
        }
      } catch (e) {
        console.log('insertText 命令不支持');
      }
      
      // 方法2: 删除选中文本，然后插入新文本
      // 先删除
      range.deleteContents();
      
      // 插入新文本
      const textNode = document.createTextNode(translatedText);
      range.insertNode(textNode);
      
      // 移动光标
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // 触发输入事件
      this.triggerInputEvents(translatedText);
      
      return true;
    } catch (error) {
      console.error('键盘输入方法失败:', error);
      return false;
    }
  }

  // 尝试使用 execCommand 替换（已废弃但某些编辑器仍支持）
  async tryExecCommandReplace(translatedText) {
    try {
      const selection = window.getSelection();
      let range = null;
      
      if (this.savedRange) {
        try {
          const container = this.savedRange.commonAncestorContainer;
          if (container && container.isConnected) {
            range = this.savedRange.cloneRange();
          }
        } catch (e) {
          // 忽略
        }
      }
      
      if (!range && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }
      
      if (!range) {
        range = this.findTextRange(this.currentInputElement, this.selectedText);
      }
      
      if (range) {
        selection.removeAllRanges();
        selection.addRange(range);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 尝试使用 insertText 命令（现代浏览器）
        if (document.execCommand) {
          // 先删除选中文本
          document.execCommand('delete', false);
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // 插入新文本
          if (document.execCommand('insertText', false, translatedText)) {
            this.triggerInputEvents(translatedText);
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.log('execCommand 方法失败:', error);
      return false;
    }
  }

  // 查找文本范围
  findTextRange(element, searchText) {
    const range = document.createRange();
    const textNodes = this.getTextNodes(element);
    
    if (textNodes.length > 0) {
      // 尝试找到包含选中文本的节点
      for (let node of textNodes) {
        const text = node.textContent;
        const index = text.indexOf(searchText);
        if (index !== -1) {
          range.setStart(node, index);
          range.setEnd(node, index + searchText.length);
          return range;
        }
      }
    }
    
    return null;
  }

  // 尝试使用剪贴板替换
  async tryClipboardReplace(translatedText) {
    try {
      // 复制翻译文本到剪贴板
      await navigator.clipboard.writeText(translatedText);
      console.log('文本已复制到剪贴板');
      
      // 聚焦到输入元素
      if (this.currentInputElement && this.currentInputElement.focus) {
        this.currentInputElement.focus();
      }
      
      // 等待焦点设置
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 选中要替换的文本
      const selection = window.getSelection();
      let range = null;
      
      if (this.savedRange) {
        try {
          const container = this.savedRange.commonAncestorContainer;
          if (container && container.isConnected) {
            range = this.savedRange.cloneRange();
          }
        } catch (e) {
          // 忽略
        }
      }
      
      if (!range) {
        range = this.findTextRange(this.currentInputElement, this.selectedText);
      }
      
      if (!range && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      }
      
      if (range) {
        // 选中文本
        selection.removeAllRanges();
        selection.addRange(range);
        console.log('文本已选中，准备粘贴');
        
        // 等待一下
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 模拟 Ctrl+V 或 Cmd+V
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        
        // 触发 keydown 事件
        const keydownEvent = new KeyboardEvent('keydown', {
          key: 'v',
          code: 'KeyV',
          ctrlKey: !isMac,
          metaKey: isMac,
          bubbles: true,
          cancelable: true
        });
        
        // 触发 keyup 事件
        const keyupEvent = new KeyboardEvent('keyup', {
          key: 'v',
          code: 'KeyV',
          ctrlKey: !isMac,
          metaKey: isMac,
          bubbles: true,
          cancelable: true
        });
        
        // 触发 paste 事件
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true
        });
        
        // 按顺序触发事件
        this.currentInputElement.dispatchEvent(keydownEvent);
        this.currentInputElement.dispatchEvent(pasteEvent);
        this.currentInputElement.dispatchEvent(keyupEvent);
        
        // 等待粘贴完成
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('粘贴事件已触发');
        return true;
      } else {
        console.warn('无法找到要替换的范围');
      }
      
      return false;
    } catch (error) {
      console.error('剪贴板替换失败:', error);
      return false;
    }
  }

  // 在普通输入框中替换
  replaceInInputElement(translatedText) {
    const element = this.currentInputElement;
    
    // 确保聚焦
    if (element.focus) {
      element.focus();
    }
    
    // 获取选择范围
    let start = element.selectionStart;
    let end = element.selectionEnd;
    
    // 如果没有选择，尝试找到选中文本的位置
    if (start === end && this.selectedText) {
      const value = element.value;
      const index = value.indexOf(this.selectedText);
      if (index !== -1) {
        start = index;
        end = index + this.selectedText.length;
      }
    }
    
    // 如果还是没有找到，使用当前光标位置
    if (start === end) {
      start = element.selectionStart || 0;
      end = element.selectionEnd || element.value.length;
    }
    
    const value = element.value;
    element.value = value.substring(0, start) + translatedText + value.substring(end);
    
    // 设置光标位置
    const newPosition = start + translatedText.length;
    element.setSelectionRange(newPosition, newPosition);
    
    // 触发输入事件（按正确顺序）
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    
    // 触发 focus 事件确保状态更新
    element.dispatchEvent(new Event('focus', { bubbles: true }));
  }

  // 通过剪贴板替换（备用方法）
  async replaceViaClipboard(translatedText) {
    try {
      // 复制翻译文本到剪贴板
      await navigator.clipboard.writeText(translatedText);
      
      // 聚焦到输入元素
      if (this.currentInputElement && this.currentInputElement.focus) {
        this.currentInputElement.focus();
      }
      
      // 尝试自动选中文本以便粘贴
      if (this.currentInputElement) {
        const selection = window.getSelection();
        let range = null;
        
        if (this.savedRange) {
          try {
            const container = this.savedRange.commonAncestorContainer;
            if (container && container.isConnected) {
              range = this.savedRange.cloneRange();
            }
          } catch (e) {
            // 忽略
          }
        }
        
        if (!range && this.currentInputElement.isContentEditable) {
          range = this.findTextRange(this.currentInputElement, this.selectedText);
        }
        
        if (range) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      
      // 显示提示（但先尝试自动粘贴）
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const shortcut = isMac ? 'Cmd+V' : 'Ctrl+V';
      
      // 延迟显示提示，给自动粘贴一些时间
      setTimeout(() => {
        // 检查是否已经粘贴成功
        const currentText = this.currentInputElement.isContentEditable 
          ? this.currentInputElement.textContent 
          : this.currentInputElement.value;
        
        if (!currentText.includes(translatedText)) {
          // 如果还没有粘贴，显示提示
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1da1f2;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            max-width: 300px;
          `;
          notification.textContent = `翻译已复制，请按 ${shortcut} 粘贴`;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.remove();
          }, 3000);
        }
      }, 500);
      
      // 隐藏翻译卡片
      this.hideTranslationCard();
    } catch (error) {
      console.error('剪贴板方法失败:', error);
      alert('自动替换失败，翻译结果：' + translatedText);
      this.hideTranslationCard();
    }
  }

  // 获取元素中的所有文本节点
  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    return textNodes;
  }

  // 触发输入事件
  triggerInputEvents(text) {
    const events = [
      new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }),
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }),
      new Event('input', { bubbles: true }),
      new Event('textInput', { bubbles: true })
    ];
    
    events.forEach(event => {
      try {
        this.currentInputElement.dispatchEvent(event);
      } catch (e) {
        // 忽略不支持的事件类型
      }
    });
  }

  // 隐藏翻译卡片
  hideTranslationCard() {
    // 移除键盘事件监听
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler, { capture: true });
      this.keyboardHandler = null;
    }
    
    if (this.translationCard) {
      this.translationCard.remove();
      this.translationCard = null;
    }
  }

  // HTML转义
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// 初始化翻译器
let translator = null;

// 等待页面加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    translator = new XTranslator();
  });
} else {
  translator = new XTranslator();
}

// 监听页面变化（SPA应用）
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // 重新初始化（如果需要）
    if (!translator) {
      translator = new XTranslator();
    } else {
      translator.detectTweetLanguage();
    }
  }
}).observe(document, { subtree: true, childList: true });
