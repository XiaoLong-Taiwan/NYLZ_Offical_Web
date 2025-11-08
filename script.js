document.addEventListener("DOMContentLoaded", () => {
  const mainSites = [
    "https://dash-main.nylz.xyz",
    "https://dash-main.netlib.re"
  ];
  
  const backupSites = [
    "https://dash-alt.nylz.xyz",
    "https://dash-alt.netlib.re"
  ];

  const PING_TIMES = 3;
  const REDIRECT_DELAY = 1000;  // 縮短跳轉時間
  const TIMEOUT = 5000; // 添加超時設置
  const LATENCY_THRESHOLD = 50; // 延遲差異閾值 (ms)
  const MAIN_NODE_WEIGHT = 0.8; // 主要節點權重

  /** 測試節點延遲 */
  async function pingSite(url) {
    let total = 0, successCount = 0;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    for (let i = 0; i < PING_TIMES; i++) {
      const start = performance.now();
      try {
        const response = await fetch(url + "/#/landing?ping=" + Date.now(), {
          method: "GET",
          mode: "no-cors",
          cache: "no-cache",
          signal: controller.signal
        });
        
        // 只要能收到回應就視為可用
        const end = performance.now();
        total += end - start;
        successCount++;
      } catch(e) {
        // 忽略 no-cors 模式下的錯誤，因為我們只需要知道能否連接
        if (e.name !== 'TypeError') {
          if (e.name === 'AbortError') {
            clearTimeout(timeoutId);
            return Infinity;
          }
        } else {
          // TypeError 通常代表跨域錯誤，但實際上請求已送達
          const end = performance.now();
          total += end - start;
          successCount++;
        }
      }
    }
    
    clearTimeout(timeoutId);
    return successCount === 0 ? Infinity : total / successCount;
  }

  function updateLoadingStatus(message, isRedirect = false) {
    const loadingEl = document.querySelector('.loading');
    loadingEl.textContent = message;
    if (isRedirect) {
      loadingEl.classList.add('redirect');
    } else {
      loadingEl.classList.remove('redirect');
    }
  }

  /** 更新結果 */
  function updateResult(id, latency) {
    const el = document.getElementById(`result${id}`);
    const latencyEl = el.querySelector(".latency");
    
    // 移除所有可能的狀態類
    latencyEl.classList.remove("excellent", "good", "normal", "slow", "very-slow", "error");
    
    if (latency === Infinity) {
      latencyEl.textContent = "无法连接";
      latencyEl.classList.add("error");
    } else {
      latencyEl.textContent = `${Math.round(latency)} ms`;
      
      // 根據延遲值添加對應的類
      if (latency < 100) {
        latencyEl.classList.add("excellent");
      } else if (latency < 200) {
        latencyEl.classList.add("good");
      } else if (latency < 500) {
        latencyEl.classList.add("normal");
      } else if (latency < 1000) {
        latencyEl.classList.add("slow");
      } else {
        latencyEl.classList.add("very-slow");
      }
    }
  }

  function markAsFastest(id) {
    document.getElementById(`result${id}`).classList.add("fastest");
  }

  function redirect(url, latency) {
    const fullUrl = url + window.location.search + window.location.hash;
    updateLoadingStatus(`找到最快节点 (${Math.round(latency)} ms)，即将跳转...`, true);
    setTimeout(() => { window.location.href = fullUrl; }, REDIRECT_DELAY);
  }

  /** 檢查所有節點 */
  async function checkAllSites() {
    updateLoadingStatus('正在检测服务可用性...');
    
    // 同時檢測所有節點
    const checkSite = async (url, index, isMain) => {
      const latency = await pingSite(url);
      updateResult(index + 1, latency);
      // 計算加權分數：延遲越低分數越高，主節點有額外加權
      const score = latency === Infinity ? -Infinity : 
        (1000 / latency) * (isMain ? MAIN_NODE_WEIGHT : 1);
      return { site: url, latency, index: index + 1, isMain, score };
    };

    // 同時檢測所有節點
    const allChecks = [
      ...mainSites.map((url, i) => checkSite(url, i, true)),
      ...backupSites.map((url, i) => checkSite(url, i + mainSites.length, false))
    ];

    try {
      const results = await Promise.all(allChecks);
      const availableResults = results.filter(r => r.latency !== Infinity);

      if (availableResults.length === 0) {
        updateLoadingStatus('无法连接到任何节点，正在重试...');
        setTimeout(checkAllSites, RETRY_DELAY);
        return;
      }

      // 找出最低延遲和最高分數的節點
      const lowestLatency = Math.min(...availableResults.map(r => r.latency));
      const bestScore = Math.max(...availableResults.map(r => r.score));
      
      // 選擇節點的邏輯
      let selectedNode = availableResults.reduce((best, current) => {
        // 如果當前節點是主節點且延遲接近最低延遲，優先選擇
        if (current.isMain && 
            current.latency <= lowestLatency + LATENCY_THRESHOLD) {
          return current;
        }
        // 如果當前節點分數更高且不是明顯較慢，選擇當前節點
        if (current.score > best.score && 
            current.latency <= lowestLatency + LATENCY_THRESHOLD) {
          return current;
        }
        return best;
      }, availableResults[0]);

      markAsFastest(selectedNode.index);
      redirect(selectedNode.site, selectedNode.latency);

    } catch (error) {
      console.error('Error during site checking:', error);
      updateLoadingStatus('检测出错，正在重试...');
      setTimeout(checkAllSites, RETRY_DELAY);
    }
  }

  /** 重設 UI */
  function resetUI() {
    updateLoadingStatus('正在检测服务可用性...');
    document.querySelectorAll(".latency").forEach(el => el.textContent = "检测中...");
    document.querySelectorAll(".result").forEach(el => el.classList.remove("fastest"));
    document.getElementById("redirect-message").textContent = "";
  }

  checkAllSites();
});
