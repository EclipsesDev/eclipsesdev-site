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

    window.location.href = VideoCloudAuth.getReturnTarget();
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
    window.location.href = VideoCloudAuth.getReturnTarget();
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
    container.innerHTML = "Loading videos...";

    const maxId = 50; // try video IDs 1 - 50
    container.innerHTML = "";

    for (let id = 1; id <= maxId; id++) {
        try {
            const res = await fetch(`/video-api/storage/video?id=${id}`, {
                method: "HEAD", // just check if it exists
                credentials: "include"
            });

            if (!res.ok) continue; // skip if video doesn't exist

            const card = document.createElement("div");
            card.className = "video-card";

            const img = document.createElement("img");
            img.src = `/assets/img/favicon.ico`; // fallback thumbnail
            card.appendChild(img);

            const title = document.createElement("h3");
            title.textContent = `Video #${id}`;
            card.appendChild(title);

            card.onclick = () => openVideo(id);
            container.appendChild(card);

        } catch (err) {
            // ignore network errors for this ID
            continue;
        }
    }

    if (!container.hasChildNodes()) {
        container.innerHTML = "No videos found.";
    }
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

document.addEventListener("DOMContentLoaded", () => {
    const isLoginPage = window.location.pathname.endsWith("/login") ||
        window.location.pathname.endsWith("/login/");

    if (!isLoginPage) {
        initPanelPage();
    }
});