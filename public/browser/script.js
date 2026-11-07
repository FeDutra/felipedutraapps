/**
 * PULSO Browser · Desenho Integral v0.1
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
  const themeBtns = document.querySelectorAll("[data-theme-set]");
  const commandOverlay = document.getElementById("commandOverlay");
  const commandInput = document.getElementById("commandInput");
  const commandResults = document.getElementById("commandResults");
  const openCommandBtns = document.querySelectorAll("[data-action='open-command']");
  const sidePanel = document.getElementById("sidePanel");
  const togglePanelBtns = document.querySelectorAll("[data-action='toggle-panel']");

  // 1. Scene Switcher
  function switchScene(sceneId) {
    currentScene = sceneId;

    // Update active nav button
    sceneNavBtns.forEach((btn) => {
      if (btn.dataset.scene === sceneId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
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

    // Close command overlay on scene change
    hideCommandOverlay();
  }

  sceneNavBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const sceneId = btn.dataset.scene;
      if (sceneId) switchScene(sceneId);
    });
  });

  // 2. Theme Switcher
  themeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.themeSet;
      if (theme && macWindow) {
        macWindow.setAttribute("data-pulso-theme", theme);
        themeBtns.forEach((tb) => btn === tb ? tb.classList.add("active") : tb.classList.remove("active"));
      }
    });
  });

  // 3. Command Overlay (⌘K / ⌘L)
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
  }

  // 4. Keyboard Shortcuts (⌘K, ⌘L, Esc)
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

    // Esc -> Dismiss Overlays / Panels
    if (e.key === "Escape") {
      hideCommandOverlay();
    }
  });

  // 5. Collapsible Sidebar Groups
  const groupHeaders = document.querySelectorAll(".group-title");
  groupHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const itemsContainer = header.nextElementSibling;
      if (itemsContainer) {
        const isHidden = itemsContainer.style.display === "none";
        itemsContainer.style.display = isHidden ? "flex" : "none";
      }
    });
  });

  // 6. Lateral Panel Toggle (MESA / Lótus)
  togglePanelBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (sidePanel) {
        const isClosed = sidePanel.style.display === "none";
        sidePanel.style.display = isClosed ? "flex" : "none";
      }
    });
  });

  // Initialize scene 1
  switchScene("01-mapa");
});
