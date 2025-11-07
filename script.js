document.addEventListener("DOMContentLoaded", () => {
  const sites = [
    "https://dash.nylz.xyz",
    "https://dash.nylz.eu.cc",
    "https://dash.nylz-service.eu.cc",
    "https://dash.nylz.netlib.re",
    "https://dash.nylz-services.ggff.net",
    "https://dash.nylz-services.netlib.re"
  ];

  const PING_TIMES = 3;
  const REDIRECT_DELAY = 2000;
  const RETRY_DELAY = 3000;
  const TIMEOUT = 5000; // 添加超時設置

  /** 測試節點延遲 */
  async function pingSite(url) {
    let total = 0, successCount = 0;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    for (let i = 0; i < PING_TIMES; i++) {
      const start = performance.now();
      try {
        const response = await fetch(url + "/?ping=" + Date.now(), {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-cache",
          signal: controller.signal
        });
        const end = performance.now();
        total += end - start;
        successCount++;
      } catch(e) {
        if (e.name === 'AbortError') {
          clearTimeout(timeoutId);
          return Infinity;
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
    if (latency === Infinity) {
      latencyEl.textContent = "无法连接";
      latencyEl.classList.add("error");
    } else {
      latencyEl.textContent = `${Math.round(latency)} ms`;
      latencyEl.classList.remove("error");
      if (latency < 100) {
        el.classList.add("excellent");
        latencyEl.classList.add("excellent");
      } else if (latency < 200) {
        el.classList.add("good");
        latencyEl.classList.add("good");
      } else {
        el.classList.add("normal");
        latencyEl.classList.add("normal");
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
    const results = [];
    updateLoadingStatus('正在检测服务可用性...');
    
    for (let i = 0; i < sites.length; i++) {
      const latency = await pingSite(sites[i]);
      updateResult(i + 1, latency);
      if (latency !== Infinity) {
        results.push({ site: sites[i], latency, index: i + 1 });
      }
    }

    if (results.length === 0) {
      updateLoadingStatus('无法连接到任何节点，正在重试...');
      setTimeout(checkAllSites, RETRY_DELAY);
      return;
    }

    // 選擇延遲最低的可用節點
    const fastest = results.reduce((a, b) => a.latency < b.latency ? a : b);
    markAsFastest(fastest.index);
    redirect(fastest.site, fastest.latency);
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
