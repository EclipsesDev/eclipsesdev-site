const EVENTS = {
  NAV: "popstate",
  LOAD: "DOMContentLoaded"
};

async function hasVideoCloudSession() {
  try {
    const response = await fetch("/video-auth/session", {
      method: "GET",
      credentials: "include"
    });

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload?.authenticated === true;
  } catch {
    return false;
  }
}

async function openProject(project) {
  if (project === "video-cloud") {
    const isAuthenticated = await hasVideoCloudSession();
    window.location.href = isAuthenticated
      ? "/projects/video-cloud/"
      : "/projects/video-cloud/login";
    return;
  }

  window.location.href = `/projects/${project}/`;
}

document.addEventListener(EVENTS.LOAD, function() {
  document.querySelectorAll('.project-card[data-project]').forEach(card => {
    card.addEventListener('click', function() {
      openProject(this.getAttribute('data-project'));
    });
  });
});