function showError(message) {
  const errorText = document.getElementById("login-error");
  if (!errorText) {
    return;
  }
  errorText.textContent = message;
}

function formatRemainingSeconds(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours <= 0) {
    return `${restMinutes}m`;
  }

  return `${hours}h ${restMinutes}m`;
}

function renderSessionInfo(session) {
  const sessionInfo = document.getElementById("session-info");
  if (!sessionInfo || !session?.authenticated) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(session.expiresAt || 0) - now;
  const remainingText = remaining > 0 ? ` (${formatRemainingSeconds(remaining)} left)` : "";
  const username = session.username || "user";

  sessionInfo.textContent = `Signed in as ${username}${remainingText}`;
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  if (!usernameInput || !passwordInput) {
    return;
  }

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
}

async function playVideo(videoId) {
  const isAuthed = await VideoCloudAuth.isAuthenticated();
  if (!isAuthed) {
    await VideoCloudAuth.requireAuth();
    return;
  }

  alert(`Video ${videoId} playback is not connected yet.`);
}

window.playVideo = playVideo;

document.addEventListener("DOMContentLoaded", async () => {
  const isLoginPage = window.location.pathname.endsWith("/login/") || window.location.pathname.endsWith("/login");
  if (isLoginPage) {
    await initLoginPage();
  } else {
    await initPanelPage();
  }
});
