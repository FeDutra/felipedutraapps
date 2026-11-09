/**
 * PULSO Browser · Desenho Integral v0.2
 * Interactive Script
 */

document.addEventListener("DOMContentLoaded", () => {
  const updateReviewScale = () => {
    const stage = document.querySelector(".stage-container");
    if (!stage) return;
    const scale = window.innerWidth <= 767
      ? Math.max(0.2, (window.innerWidth - 16) / 1440)
      : 1;
    stage.style.setProperty("--review-scale", String(scale));
  };

  updateReviewScale();
  window.addEventListener("resize", updateReviewScale, { passive: true });

  // State
  let currentScene = "01-mapa";

  // Elements
  const macWindow = document.getElementById("macWindow");
  const sceneNavBtns = document.querySelectorAll(".scene-nav-btn");
  const scenes = document.querySelectorAll(".scene-stage");
  const commandOverlay = document.getElementById("commandOverlay");
  const commandInput = document.getElementById("commandInput");
  const commandResults = document.getElementById("commandResults");
  const openCommandBtns = document.querySelectorAll("[data-action='open-command']");
  const sidePanelMesa = document.getElementById("sidePanelMesa");
  const sidePanelLotus = document.getElementById("sidePanelLotus");
  const toggleMesaBtns = document.querySelectorAll("[data-action='toggle-mesa']");
  const toggleLotusBtns = document.querySelectorAll("[data-action='toggle-lotus']");

  // 1. Scene Switcher
  function switchScene(sceneId) {
    currentScene = sceneId;

    // Update active nav button
    sceneNavBtns.forEach((btn) => {
      if (btn.dataset.scene === sceneId) {
        btn.classList.add("active");
        btn.setAttribute("aria-current", "page");
      } else {
        btn.classList.remove("active");
        btn.removeAttribute("aria-current");
      }
    });

    // Update active scene container
    scenes.forEach((stage) => {
      if (stage.id === `scene-${sceneId}`) {
        stage.style.display = "flex";
        stage.classList.add("active");
      } else {
        stage.style.display = "none";
        stage.classList.remove("active");
      }
    });

    // Close command overlay on scene switch
    hideCommandOverlay();
  }

  sceneNavBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const sceneId = btn.dataset.scene;
      if (sceneId) switchScene(sceneId);
    });
  });

  // 2. Command Overlay (⌘K / ⌘L)
  function showCommandOverlay() {
    if (commandOverlay) {
      commandOverlay.style.display = "flex";
      if (commandInput) {
        commandInput.focus();
        commandInput.value = "";
      }
    }
  }

  function hideCommandOverlay() {
    if (commandOverlay) {
      commandOverlay.style.display = "none";
    }
  }

  openCommandBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showCommandOverlay();
    });
  });

  // Simulated Command Filter
  if (commandInput && commandResults) {
    const items = commandResults.querySelectorAll(".command-item");
    commandInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = "flex";
        } else {
          item.style.display = "none";
        }
      });
    });

    items.forEach((item) => {
      item.addEventListener("click", () => {
        const targetScene = item.dataset.targetScene;
        const targetAction = item.dataset.action;
        if (targetScene) {
          switchScene(targetScene);
        } else if (targetAction === "toggle-mesa" && sidePanelMesa) {
          switchScene("10-mesa");
        } else if (targetAction === "toggle-lotus" && sidePanelLotus) {
          switchScene("11-lotus");
        } else {
          hideCommandOverlay();
        }
      });
    });
  }

  // 3. Keyboard Shortcuts (⌘K, ⌘L, Esc)
  document.addEventListener("keydown", (e) => {
    // ⌘K or Ctrl+K -> Command Overlay
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (commandOverlay && commandOverlay.style.display === "flex") {
        hideCommandOverlay();
      } else {
        showCommandOverlay();
      }
    }

    // ⌘L or Ctrl+L -> Focus Command / URL
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      showCommandOverlay();
    }

    // Esc -> Dismiss Overlays
    if (e.key === "Escape") {
      hideCommandOverlay();
    }
  });

  // 4. Collapsible Sidebar Groups
  const groupHeaders = document.querySelectorAll(".group-title");
  groupHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const itemsContainer = header.nextElementSibling;
      if (itemsContainer) {
        const isHidden = itemsContainer.style.display === "none";
        itemsContainer.style.display = isHidden ? "flex" : "none";
        const symbolSpan = header.querySelector(".toggle-symbol");
        if (symbolSpan) {
          symbolSpan.textContent = isHidden ? "−" : "+";
        }
      }
    });
  });

  // 5. Lateral Panel Toggle (MESA / Lótus)
  toggleMesaBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      switchScene("10-mesa");
    });
  });

  toggleLotusBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      switchScene("11-lotus");
    });
  });

  // Initialize scene 01-mapa
  switchScene("01-mapa");
});
