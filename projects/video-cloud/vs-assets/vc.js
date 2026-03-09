const vcLightbox = document.getElementById("vc-lightbox");
const vcPlayer = document.getElementById("vc-player");
const vcPlay = document.getElementById("vc-play-btn");
const vcClose = document.getElementById("vc-close-btn");
const vcProgress = document.getElementById("vc-progress-bar");
const vcProgressContainer = document.getElementById("vc-progress-container");
const vcMute = document.getElementById("vc-mute-btn");
const vcTime = document.getElementById("vc-time");
const vcFullscreen = document.getElementById("vc-fullscreen-btn");

function formatTime(t) {
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60).toString().padStart(2,'0');
  return `${mins}:${secs}`;
}

function openVcVideo(url) {
  vcPlayer.src = url;
  vcLightbox.style.display = "flex";
  vcPlayer.pause();
}

vcPlay.addEventListener("click", () => {
  if(vcPlayer.paused) vcPlayer.play();
  else vcPlayer.pause();
});

vcPlayer.addEventListener("play", () => vcPlay.style.display = "none");
vcPlayer.addEventListener("pause", () => vcPlay.style.display = "block");

vcPlayer.addEventListener("timeupdate", () => {
  const percent = (vcPlayer.currentTime / vcPlayer.duration) * 100;
  vcProgress.style.width = percent + "%";
  vcTime.textContent = `${formatTime(vcPlayer.currentTime)} / ${formatTime(vcPlayer.duration)}`;
});

vcProgressContainer.addEventListener("click", e => {
  const rect = vcProgressContainer.getBoundingClientRect();
  vcPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * vcPlayer.duration;
});

vcMute.addEventListener("click", () => {
  vcPlayer.muted = !vcPlayer.muted;
  vcMute.textContent = vcPlayer.muted ? "🔇" : "🔊";
});

vcFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    vcLightbox.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
});

function closeVc() {
  vcPlayer.pause();
  vcPlayer.src = "";
  vcLightbox.style.display = "none";
}

vcClose.addEventListener("click", closeVc);

vcLightbox.addEventListener("click", e => {
  if(e.target === vcLightbox) closeVc();
});