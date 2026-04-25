const EVENTS = {
  NAV: "popstate",
  LOAD: "DOMContentLoaded"
};
const API = ["https://api.", "eclipsesdev", ".top/changelog/"].join("");
const CACHE_KEY = "eclipsesdev_changelog_cache_v1";
let changelogLoaded = false;

function normalizePath(pathname) {
  if (!pathname) return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function syncActiveNavButton(id) {
  const nav = document.querySelector(".nav-bar");
  if (!nav) return;

  nav.querySelectorAll("button.active").forEach((button) => {
    button.classList.remove("active");
  });

  let targetButton = nav.querySelector(`[data-section="${id}"]`);

  if (!targetButton) {
    const currentPath = normalizePath(window.location.pathname);
    nav.querySelectorAll("a[href]").forEach((link) => {
      if (targetButton) return;
      const linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
      if (linkPath === currentPath) {
        const nestedButton = link.querySelector("button");
        if (nestedButton) targetButton = nestedButton;
      }
    });
  }

  if (!targetButton && id === "home") {
    targetButton = nav.querySelector('[data-section="home"]')
      || nav.querySelector('a[href="/"] button');
  }

  targetButton?.classList.add("active");
}

function activateSection(id) {
  const sections = document.querySelectorAll(".section");

  sections.forEach(sec => {
    sec.hidden = sec.id !== id;
  });

  syncActiveNavButton(id);

  if (id === "changelog" && !changelogLoaded) {
    loadChangelog();
    changelogLoaded = true;
  }
}

async function loadChangelog() {
  function getCached() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveCache({ logs, etag, lastModified }) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        logs,
        etag: etag || null,
        lastModified: lastModified || null,
        fetchedAt: Date.now()
      }));
    } catch (e) {}
  }

  function renderLogs(logs) {
    const container = document.getElementById("changelog-logs");
    if (!container) return;
    container.innerHTML = "";

    const fragment = document.createDocumentFragment();

    logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    logs.forEach(log => {
      const section = document.createElement("div");
      section.className = "log-section";

      const title = document.createElement("div");
      title.className = "log-title";
      title.textContent = `Dev Log ${log.date}`;

      const project = document.createElement("div");
      project.className = "log-project";
      project.textContent = log.project;

      const list = document.createElement("ul");

      (log.changes || []).forEach(change => {
        const li = document.createElement("li");
        li.textContent = change;
        list.appendChild(li);
      });

      section.append(title, project, list);
      fragment.appendChild(section);
    });

    container.appendChild(fragment);
  }

  const cache = getCached();

  if (cache && cache.logs) {
    renderLogs(cache.logs);
  }

  try {
    let needFetch = true;

    if (cache) {
      try {
        const headRes = await fetch(API, { method: "HEAD" });
        if (headRes.ok) {
          const etag = headRes.headers.get("ETag");
          const lastModified = headRes.headers.get("Last-Modified");
          if ((etag && cache.etag && etag === cache.etag) ||
              (lastModified && cache.lastModified && lastModified === cache.lastModified)) {
            needFetch = false;
          }
        }
      } catch (e) {}
    }

    if (!needFetch) return;

    const headers = {};
    if (cache && cache.etag) headers["If-None-Match"] = cache.etag;
    if (cache && cache.lastModified) headers["If-Modified-Since"] = cache.lastModified;

    const res = await fetch(API, { headers });

    if (res.status === 304) {
      return;
    }

    if (!res.ok) {
      throw new Error("Failed to fetch changelog");
    }

    const logs = await res.json();

    const newEtag = res.headers.get("ETag");
    const newLastModified = res.headers.get("Last-Modified");

    saveCache({ logs, etag: newEtag, lastModified: newLastModified });
    renderLogs(logs);
  } catch (err) {
    console.error("Changelog load error:", err);
    if (!cache || !cache.logs) {
      const container = document.getElementById("changelog-logs");
      if (container) container.innerHTML = "<p>Failed to load changelog</p>";
    }
  }
}

document.querySelectorAll(".nav-bar button[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.section;
    activateSection(target);
  });
});

window.addEventListener(EVENTS.NAV, () => {
  const section = window.location.pathname.split("/")[1] || "home";
  activateSection(section);
});

document.addEventListener(EVENTS.LOAD, () => {
  const section = window.location.pathname.split("/")[1] || "home";
  activateSection(section);
});