const lightbox = document.getElementById("video-lightbox");
const player = document.getElementById("video-player");
const overlay = document.getElementById("video-overlay");
const playerShell = document.querySelector(".video-player-shell");
const playIcon = document.getElementById("video-play-icon");
const closeButton = document.getElementById("video-close");
const progressBar = document.getElementById("video-progress-bar");
const progressContainer = document.getElementById("video-progress");
const controls = document.getElementById("video-controls");
const muteButton = document.getElementById("video-mute");
const muteIcon = document.getElementById("video-mute-icon");
const timeLabel = document.getElementById("video-time");
const fullscreenButton = document.getElementById("video-fullscreen");
const fullscreenIcon = document.getElementById("video-fullscreen-icon");

const PLAYER_ICONS = {
  play: "/assets/img/Play.png",
  pause: "/assets/img/Pause.png",
  muted: "/assets/img/Mute.png",
  unmuted: "/assets/svg/unmute.svg",
  maximize: "/assets/svg/maximize.svg",
  minimize: "/assets/svg/minimize.svg"
};

const PLAYER_IDLE_DELAY_MS = 2000;
let idleTimer = null;
let fullscreenIconRafId = null;
let isNativeVideoFullscreenActive = false;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainderSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainderSeconds}`;
}

function setIcon(img, src, alt) {
  if (!img) return;
  const nextUrl = new URL(src, window.location.origin).href;
  const currentUrl = img.currentSrc || img.src || "";
  if (currentUrl !== nextUrl) {
    img.src = src;
  }
  if (img.alt !== alt) {
    img.alt = alt;
  }
}

function preloadIcon(src) {
  const image = new Image();
  image.src = src;
}

function preloadPlayerIcons() {
  Object.values(PLAYER_ICONS).forEach(preloadIcon);
}

function updatePlayIcon() {
  if (player.paused) {
    setIcon(playIcon, PLAYER_ICONS.play, "Play");
  } else {
    setIcon(playIcon, PLAYER_ICONS.pause, "Pause");
  }
}

function updateMuteIcon() {
  if (player.muted) {
    setIcon(muteIcon, PLAYER_ICONS.muted, "Muted");
  } else {
    setIcon(muteIcon, PLAYER_ICONS.unmuted, "Unmuted");
  }
}

function updateFullscreenIcon() {
  if (isFullscreenActive()) {
    setIcon(fullscreenIcon, PLAYER_ICONS.minimize, "Exit fullscreen");
  } else {
    setIcon(fullscreenIcon, PLAYER_ICONS.maximize, "Enter fullscreen");
  }
}

function applyFullscreenLayoutState() {
  lightbox.classList.toggle("is-fullscreen-active", isFullscreenActive());
}

function scheduleFullscreenIconUpdate() {
  if (fullscreenIconRafId !== null) return;
  fullscreenIconRafId = window.requestAnimationFrame(() => {
    fullscreenIconRafId = null;
    updateFullscreenIcon();
    applyFullscreenLayoutState();
  });
}

function setIdleState(isIdle) {
  playerShell.classList.toggle("is-idle", isIdle);
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function resetIdleTimer() {
  if (!playerShell.classList.contains("is-playing")) {
    setIdleState(false);
    return;
  }

  setIdleState(false);
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (playerShell.classList.contains("is-playing")) {
      setIdleState(true);
    }
  }, PLAYER_IDLE_DELAY_MS);
}

function isFullscreenActive() {
  return !!document.fullscreenElement || isNativeVideoFullscreenActive;
}

async function requestPlayerFullscreen() {
  if (lightbox.requestFullscreen) {
    try {
      await lightbox.requestFullscreen();
      return;
    } catch (lightboxError) {
      if (player.requestFullscreen) {
        await player.requestFullscreen();
        return;
      }
      throw lightboxError;
    }
  }

  if (lightbox.webkitRequestFullscreen) {
    lightbox.webkitRequestFullscreen();
    return;
  }

  if (player.requestFullscreen) {
    await player.requestFullscreen();
    return;
  }

  if (player.webkitEnterFullscreen) {
    player.webkitEnterFullscreen();
  }
}

async function exitFullscreenIfNeeded() {
  if (!document.fullscreenElement && !isNativeVideoFullscreenActive) return;

  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch (e) {
      console.error("Exit fullscreen failed:", e);
    }
  }

  if (isNativeVideoFullscreenActive && player.webkitExitFullscreen) {
    try {
      player.webkitExitFullscreen();
    } catch (e) {
      console.error("Native fullscreen exit failed:", e);
    }
  }
}

function openVideoPlayer(url) {
  player.src = url;
  lightbox.style.display = "flex";
  applyFullscreenLayoutState();
  player.pause();
  setIdleState(false);
  clearIdleTimer();
  updatePlayIcon();
}

function togglePlayback() {
  if (player.paused) {
    const maybePromise = player.play();
    maybePromise?.catch(() => {});
  } else {
    player.pause();
  }
}

if (window.PointerEvent) {
  overlay.addEventListener("pointerup", togglePlayback);
} else {
  overlay.addEventListener("click", togglePlayback);
}

player.addEventListener("play", () => {
  playerShell.classList.add("is-playing");
  updatePlayIcon();
  resetIdleTimer();
});

player.addEventListener("pause", () => {
  playerShell.classList.remove("is-playing");
  setIdleState(false);
  clearIdleTimer();
  updatePlayIcon();
});

player.addEventListener("timeupdate", () => {
  const duration = player.duration;
  const percent = duration > 0 ? (player.currentTime / duration) * 100 : 0;
  progressBar.style.width = `${percent}%`;
  timeLabel.textContent = `${formatTime(player.currentTime)} / ${formatTime(duration)}`;
});

progressContainer.addEventListener("click", (event) => {
  const duration = player.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const rect = progressContainer.getBoundingClientRect();
  player.currentTime = ((event.clientX - rect.left) / rect.width) * duration;
});

muteButton.addEventListener("click", () => {
  player.muted = !player.muted;
  updateMuteIcon();
});

fullscreenButton.addEventListener("click", async () => {
  if (!isFullscreenActive()) {
    try {
      await requestPlayerFullscreen();
    } catch (e) {
      console.error("Fullscreen failed:", e);
    }
  } else {
    exitFullscreenIfNeeded();
  }
});

function bindActivityEvents(element) {
  if (!element) return;
  element.addEventListener("pointermove", resetIdleTimer);
  element.addEventListener("pointerdown", resetIdleTimer);
  element.addEventListener("touchstart", resetIdleTimer, { passive: true });
  element.addEventListener("mousemove", resetIdleTimer);
}

bindActivityEvents(lightbox);
bindActivityEvents(player);
bindActivityEvents(overlay);
bindActivityEvents(controls);

function closeVideoPlayer() {
  exitFullscreenIfNeeded();
  player.pause();
  if (player.src.startsWith("blob:")) {
    URL.revokeObjectURL(player.src);
  }
  player.src = "";
  lightbox.style.display = "none";
  applyFullscreenLayoutState();
  progressBar.style.width = "0%";
  timeLabel.textContent = "0:00 / 0:00";
  setIdleState(false);
  clearIdleTimer();
  updatePlayIcon();
}

closeButton.addEventListener("click", closeVideoPlayer);

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeVideoPlayer();
});

document.addEventListener("fullscreenchange", scheduleFullscreenIconUpdate);
document.addEventListener("webkitfullscreenchange", scheduleFullscreenIconUpdate);
document.addEventListener("mozfullscreenchange", scheduleFullscreenIconUpdate);
player.addEventListener("webkitbeginfullscreen", () => {
  isNativeVideoFullscreenActive = true;
  scheduleFullscreenIconUpdate();
});

player.addEventListener("webkitendfullscreen", () => {
  isNativeVideoFullscreenActive = false;
  scheduleFullscreenIconUpdate();
});

updatePlayIcon();
updateMuteIcon();
updateFullscreenIcon();
applyFullscreenLayoutState();
preloadPlayerIcons();