const lightbox = document.getElementById("video-lightbox");
const player = document.getElementById("video-player");
const overlay = document.getElementById("video-overlay");
const playerShell = document.querySelector(".video-player-shell");
const playIcon = document.getElementById("video-play-icon");
const seekFeedback = document.getElementById("video-seek-feedback");
const seekFeedbackIcon = document.getElementById("video-seek-feedback-icon");
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
  forward: "/assets/img/forward.png",
  rewind: "/assets/img/rewind.png",
  muted: "/assets/img/Mute.png",
  unmuted: "/assets/svg/unmute.svg",
  maximize: "/assets/svg/maximize.svg",
  minimize: "/assets/svg/minimize.svg"
};

const PLAYER_IDLE_DELAY_MS = 2000;
const SURFACE_DOUBLE_CLICK_DELAY_MS = 250;
const DOUBLE_CLICK_SEEK_SECONDS = 5;
let idleTimer = null;
let fullscreenIconRafId = null;
let isNativeVideoFullscreenActive = false;
let surfaceClickTimer = null;
let isProgressDragging = false;
let seekFeedbackTimer = null;
let activeProgressPointerId = null;

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

function openVideoPlayer(url, options = {}) {
  const poster = typeof options.poster === "string" ? options.poster : "";
  player.poster = poster;
  player.src = url;
  lightbox.style.display = "flex";
  applyFullscreenLayoutState();
  player.pause();
  setIdleState(false);
  clearIdleTimer();
  updatePlayIcon();
}

window.openVideoPlayer = openVideoPlayer;

function togglePlayback() {
  if (player.paused) {
    const maybePromise = player.play();
    maybePromise?.catch(() => {});
  } else {
    player.pause();
  }
}

function updatePlaybackProgress() {
  const duration = player.duration;
  const percent = duration > 0 ? (player.currentTime / duration) * 100 : 0;
  progressBar.style.width = `${percent}%`;
  timeLabel.textContent = `${formatTime(player.currentTime)} / ${formatTime(duration)}`;
}

function seekBy(seconds) {
  const duration = player.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const nextTime = Math.min(Math.max(player.currentTime + seconds, 0), duration);
  player.currentTime = nextTime;
  updatePlaybackProgress();
}

function showSeekFeedback(direction) {
  if (!seekFeedback || !seekFeedbackIcon) return;
  const isForward = direction === "forward";
  setIcon(seekFeedbackIcon, isForward ? PLAYER_ICONS.forward : PLAYER_ICONS.rewind, isForward ? "Forward 5 seconds" : "Rewind 5 seconds");
  seekFeedback.classList.remove("seek-forward", "seek-backward", "is-visible");
  seekFeedback.classList.add(isForward ? "seek-forward" : "seek-backward");
  void seekFeedback.offsetWidth;
  seekFeedback.classList.add("is-visible");

  if (seekFeedbackTimer) {
    clearTimeout(seekFeedbackTimer);
  }
  seekFeedbackTimer = setTimeout(() => {
    seekFeedback.classList.remove("is-visible");
  }, 420);
}

function seekFromProgressClientX(clientX) {
  const duration = player.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const rect = progressContainer.getBoundingClientRect();
  if (rect.width <= 0) return;
  const clampedRatio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  player.currentTime = clampedRatio * duration;
  updatePlaybackProgress();
}

function setProgressDraggingState(isDragging) {
  isProgressDragging = isDragging;
  progressContainer.classList.toggle("is-dragging", isDragging);
}

function seekFromSurfaceSide(surface, clientX) {
  const rect = surface.getBoundingClientRect();
  const midpoint = rect.left + rect.width / 2;
  const isForward = clientX >= midpoint;
  const seekAmount = isForward ? DOUBLE_CLICK_SEEK_SECONDS : -DOUBLE_CLICK_SEEK_SECONDS;
  seekBy(seekAmount);
  showSeekFeedback(isForward ? "forward" : "backward");
  resetIdleTimer();
}

function handleSurfaceClick(event) {
  event.preventDefault();

  if (surfaceClickTimer) {
    clearTimeout(surfaceClickTimer);
    surfaceClickTimer = null;
    seekFromSurfaceSide(event.currentTarget, event.clientX);
    return;
  }

  surfaceClickTimer = setTimeout(() => {
    surfaceClickTimer = null;
    togglePlayback();
  }, SURFACE_DOUBLE_CLICK_DELAY_MS);
}

for (const surface of [overlay, player]) {
  surface.addEventListener("click", handleSurfaceClick);
}

if (window.PointerEvent) {
  const onProgressPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    activeProgressPointerId = event.pointerId;
    setProgressDraggingState(true);
    progressContainer.setPointerCapture?.(event.pointerId);
    seekFromProgressClientX(event.clientX);
    resetIdleTimer();
  };

  const onProgressPointerMove = (event) => {
    if (!isProgressDragging) return;
    if (activeProgressPointerId !== null && event.pointerId !== activeProgressPointerId) return;
    event.preventDefault();
    seekFromProgressClientX(event.clientX);
  };

  const stopProgressDrag = (event) => {
    if (!isProgressDragging) return;
    if (activeProgressPointerId !== null && event.pointerId !== activeProgressPointerId) return;
    setProgressDraggingState(false);
    progressContainer.releasePointerCapture?.(activeProgressPointerId);
    activeProgressPointerId = null;
  };

  progressContainer.addEventListener("pointerdown", onProgressPointerDown);
  progressContainer.addEventListener("pointermove", onProgressPointerMove);
  document.addEventListener("pointermove", onProgressPointerMove);
  progressContainer.addEventListener("pointerup", stopProgressDrag);
  document.addEventListener("pointerup", stopProgressDrag);
  progressContainer.addEventListener("pointercancel", stopProgressDrag);
  document.addEventListener("pointercancel", stopProgressDrag);
  progressContainer.addEventListener("lostpointercapture", () => {
    setProgressDraggingState(false);
    activeProgressPointerId = null;
  });
} else {
  let isTouchScrubbing = false;

  progressContainer.addEventListener("touchstart", (event) => {
    isTouchScrubbing = true;
    setProgressDraggingState(true);
    seekFromProgressClientX(event.touches[0].clientX);
  }, { passive: true });

  progressContainer.addEventListener("touchmove", (event) => {
    if (!isTouchScrubbing) return;
    seekFromProgressClientX(event.touches[0].clientX);
  }, { passive: true });

  const stopTouchScrub = () => {
    isTouchScrubbing = false;
    setProgressDraggingState(false);
  };

  progressContainer.addEventListener("touchend", stopTouchScrub);
  progressContainer.addEventListener("touchcancel", stopTouchScrub);

  progressContainer.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    setProgressDraggingState(true);
    seekFromProgressClientX(event.clientX);
  });

  document.addEventListener("mousemove", (event) => {
    if (!isProgressDragging) return;
    seekFromProgressClientX(event.clientX);
  });

  document.addEventListener("mouseup", () => {
    if (!isProgressDragging) return;
    setProgressDraggingState(false);
  });
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
  updatePlaybackProgress();
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
  if (surfaceClickTimer) {
    clearTimeout(surfaceClickTimer);
    surfaceClickTimer = null;
  }
  if (seekFeedbackTimer) {
    clearTimeout(seekFeedbackTimer);
    seekFeedbackTimer = null;
  }
  seekFeedback?.classList.remove("is-visible");
  setProgressDraggingState(false);
  activeProgressPointerId = null;
  exitFullscreenIfNeeded();
  player.pause();
  if (player.src.startsWith("blob:")) {
    URL.revokeObjectURL(player.src);
  }
  player.removeAttribute("poster");
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
