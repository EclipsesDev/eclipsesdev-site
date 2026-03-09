function showError(message) {
  const errorText = document.getElementById("login-error");
  if (!errorText) return;
  errorText.textContent = message;
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  if (!usernameInput || !passwordInput) return;

  showError("");

  try {
    const loginResult = await VideoCloudAuth.login(
      usernameInput.value.trim(),
      passwordInput.value
    );

    if (!loginResult?.authenticated) {
      showError("Invalid username or password.");
      return;
    }

    const target = VideoCloudAuth.getReturnTarget() || "/projects/video-cloud/";
    window.location.replace(target);

  } catch (error) {
    if (error?.status === 401) {
      showError("Invalid username or password.");
      return;
    }
    showError("Login service unreachable. Check your Worker route.");
  }
}

async function initLoginPage() {
  const session = await VideoCloudAuth.getSession();
  if (session.authenticated) {
      const target = VideoCloudAuth.getReturnTarget() || "/projects/video-cloud/";
      window.location.replace(target); 
      return;
  }

  const form = document.getElementById("login-form");
  form?.addEventListener("submit", handleLoginSubmit);
}

function formatRemainingSeconds(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours <= 0) return `${restMinutes}m`;
  return `${hours}h ${restMinutes}m`;
}

function renderSessionInfo(session) {
  const sessionInfo = document.getElementById("session-info");
  if (!sessionInfo || !session?.authenticated) return;

  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(session.expiresAt || 0) - now;
  const remainingText = remaining > 0 ? ` (${formatRemainingSeconds(remaining)} left)` : "";
  const username = session.username || "user";

  sessionInfo.textContent = `Signed in as ${username}${remainingText}`;
}

async function initPanelPage() {
  const session = await VideoCloudAuth.getSession();
  if (!session.authenticated) {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const returnParam = encodeURIComponent(currentPath);
    window.location.href = `/projects/video-cloud/login?return=${returnParam}`;
    return;
  }

  const logoutButton = document.getElementById("logout-btn");
  logoutButton?.addEventListener("click", VideoCloudAuth.logout);

  renderSessionInfo(session);
  loadVideos();
}

async function loadVideos() {
    const container = document.getElementById("video-grid");
    if (!container) return;

    container.innerHTML = "Loading videos...";

    try {
        const res = await fetch("/video-api/storage/list", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch video list");

        const videos = await res.json();
        container.innerHTML = "";

        if (!videos.length) {
            container.innerHTML = "No videos found.";
            return;
        }

        const cards = videos.map(video => {
            const card = document.createElement("div");
            card.className = "video-card";

            const img = document.createElement("img");
            img.src = '/assets/img/favicon.ico';
            card.appendChild(img);

            const title = document.createElement("h3");
            title.textContent = video.title || `Video #${video.id}`;
            card.appendChild(title);

            card.onclick = () => openVcVideoFromId(video.id);

            container.appendChild(card);
            return { video, img };
        });

        await Promise.allSettled(cards.map(async ({ video, img }) => {
            try {
                const thumbnail = await getThumbnailFromVideo(`/video-api/storage/video?id=${video.id}`, 2);
                img.src = thumbnail || img.src;
            } catch {}
        }));

    } catch (err) {
        console.error(err);
        container.innerHTML = "Failed to load videos.";
    }
}

async function openVcVideoFromId(id) {
    try {
        const res = await fetch(`/video-api/storage/video?id=${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Video failed to load");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        openVcVideo(url);
    } catch (err) {
        alert("Video failed to load");
        console.error(err);
    }
}

async function getThumbnailFromVideo(videoUrl, seekTime = 1) {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.src = videoUrl;
        video.crossOrigin = "anonymous";
        video.muted = true;

        video.addEventListener("loadeddata", () => {
            video.currentTime = seekTime;
        });

        video.addEventListener("seeked", () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL("image/png");
            resolve(thumbnail);
        });

        video.addEventListener("error", (e) => reject(e));
    });
}

async function openVideo(id) {
    const lightbox = document.getElementById("video-lightbox");
    const video = document.getElementById("video-player");

    try {
        const res = await fetch(`/video-api/storage/video?id=${id}`, {
            credentials: "include"
        });

        if (!res.ok) {
            alert("Video failed to load");
            return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        video.src = url;
        lightbox.style.display = "flex";
        video.play();

        function close() {
            video.pause();
            video.src = "";
            URL.revokeObjectURL(url);
            lightbox.style.display = "none";
        }

        document.getElementById("close-video").onclick = close;

        lightbox.onclick = e => {
            if (e.target === lightbox) close();
        };
    } catch (err) {
        alert("Video failed to load");
    }
}

document.addEventListener("DOMContentLoaded", async () => { 
  const isLoginPage = window.location.pathname.endsWith("/login/") || window.location.pathname.endsWith("/login"); 

  if (isLoginPage) { 
    await initLoginPage(); 
  } else { 
    await initPanelPage(); 
  } 
});