const vcLightbox = document.getElementById("vc-lightbox");
const vcPlayer = document.getElementById("vc-player");
const vcOverlay = document.getElementById("vc-overlay");
const vcContainer = document.querySelector(".vc-video-container");
const vcPlayIcon = document.getElementById("vc-play-icon");
const vcClose = document.getElementById("vc-close-btn");
const vcProgress = document.getElementById("vc-progress-bar");
const vcProgressContainer = document.getElementById("vc-progress-container");
const vcMute = document.getElementById("vc-mute-btn");
const vcMuteIcon = document.getElementById("vc-mute-icon");
const vcTime = document.getElementById("vc-time");
const vcFullscreen = document.getElementById("vc-fullscreen-btn");
const vcFullscreenIcon = document.getElementById("vc-fullscreen-icon");

const VC_ICONS = {
  play: "/assets/img/Play.png",
  pause: "/assets/img/Pause.png",
  muted: "/assets/img/Mute.png",
  unmuted: "/assets/svg/unmute.svg",
  maximize: "/assets/svg/maximize.svg",
  minimize: "/assets/svg/minimize.svg"
};

function formatTime(t) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function setIcon(img, src, alt) {
  if (!img) return;
  img.src = src;
  img.alt = alt;
}

function updatePlayIcon() {
  if (vcPlayer.paused) {
    setIcon(vcPlayIcon, VC_ICONS.play, "Play");
  } else {
    setIcon(vcPlayIcon, VC_ICONS.pause, "Pause");
  }
}

function updateMuteIcon() {
  if (vcPlayer.muted) {
    setIcon(vcMuteIcon, VC_ICONS.muted, "Muted");
  } else {
    setIcon(vcMuteIcon, VC_ICONS.unmuted, "Unmuted");
  }
}

function updateFullscreenIcon() {
  if (isFullscreenActive()) {
    setIcon(vcFullscreenIcon, VC_ICONS.minimize, "Exit fullscreen");
  } else {
    setIcon(vcFullscreenIcon, VC_ICONS.maximize, "Enter fullscreen");
  }
}

function isFullscreenActive() {
  return Boolean(
    document.fullscreenElement ||
      document.webkitFullscreenElement ||
      vcPlayer.webkitDisplayingFullscreen
  );
}

function openVcVideo(url) {
  vcPlayer.src = url;
  vcLightbox.style.display = "flex";
  vcPlayer.pause();
  updatePlayIcon();
}

function togglePlay() {
  if (vcPlayer.paused) {
    const maybePromise = vcPlayer.play();
    maybePromise?.catch(() => {});
  } else {
    vcPlayer.pause();
  }
}

if (window.PointerEvent) {
  vcOverlay.addEventListener("pointerup", togglePlay);
} else {
  vcOverlay.addEventListener("click", togglePlay);
}

vcPlayer.addEventListener("play", () => {
  vcContainer.classList.add("playing");
  updatePlayIcon();
});

vcPlayer.addEventListener("pause", () => {
  vcContainer.classList.remove("playing");
  updatePlayIcon();
});

vcPlayer.addEventListener("timeupdate", () => {
  const duration = vcPlayer.duration;
  const percent = duration > 0 ? (vcPlayer.currentTime / duration) * 100 : 0;
  vcProgress.style.width = `${percent}%`;
  vcTime.textContent = `${formatTime(vcPlayer.currentTime)} / ${formatTime(duration)}`;
});

vcProgressContainer.addEventListener("click", (e) => {
  const duration = vcPlayer.duration;
  if (!Number.isFinite(duration) || duration <= 0) return;
  const rect = vcProgressContainer.getBoundingClientRect();
  vcPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
});

vcMute.addEventListener("click", () => {
  vcPlayer.muted = !vcPlayer.muted;
  updateMuteIcon();
});

vcFullscreen.addEventListener("click", () => {
  if (!isFullscreenActive()) {
    if (vcLightbox.requestFullscreen) {
      vcLightbox.requestFullscreen();
    } else if (vcLightbox.webkitRequestFullscreen) {
      vcLightbox.webkitRequestFullscreen();
    } else {
      vcPlayer.webkitEnterFullscreen?.();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else {
      vcPlayer.webkitExitFullscreen?.();
    }
  }
});

function closeVc() {
  vcPlayer.pause();
  if (vcPlayer.src.startsWith("blob:")) {
    URL.revokeObjectURL(vcPlayer.src);
  }
  vcPlayer.src = "";
  vcLightbox.style.display = "none";
  vcProgress.style.width = "0%";
  vcTime.textContent = "0:00 / 0:00";
  updatePlayIcon();
}

vcClose.addEventListener("click", closeVc);

vcLightbox.addEventListener("click", (e) => {
  if (e.target === vcLightbox) closeVc();
});

document.addEventListener("fullscreenchange", updateFullscreenIcon);
document.addEventListener("webkitfullscreenchange", updateFullscreenIcon);
vcPlayer.addEventListener("webkitbeginfullscreen", updateFullscreenIcon);
vcPlayer.addEventListener("webkitendfullscreen", updateFullscreenIcon);

updatePlayIcon();
updateMuteIcon();
updateFullscreenIcon();