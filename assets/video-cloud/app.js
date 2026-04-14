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

            card.onclick = () => openVideoFromId(video.id);

            container.appendChild(card);
            return { video, img };
        });

        await runWithConcurrency(cards, 2, async ({ video, img }) => {
            try {
                // const thumbnail = await getThumbnailFromVideo(`/video-api/storage/video?id=${video.id}`, 1);
                const thumbnail = await getThumbnailFromVideo(`/video-api/storage/video?id=${video.id}`);
                img.src = thumbnail || img.src;
            } catch {}
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = "Failed to load videos.";
    }
}

async function runWithConcurrency(items, concurrency, worker) {
    const queue = [...items];
    const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
        while (queue.length) {
            const item = queue.shift();
            if (!item) return;
            await worker(item);
        }
    });
    await Promise.allSettled(runners);
}

async function openVideoFromId(id) {
    try {
        const url = `/video-api/storage/video?id=${id}`;
        openVideoPlayer(url);
    } catch (err) {
        console.error("Video load error:", err);

        const container = document.getElementById("video-grid");
        if (container) {
            const debug = document.createElement("pre");
            debug.style.color = "red";
            debug.style.whiteSpace = "pre-wrap";
            debug.textContent = "Video error:\n" + err.message;
            container.prepend(debug);
        }

        alert("Video failed to load.\n\n" + err.message);
    }
}

// async function getThumbnailFromVideo(videoUrl) {
//   return new Promise((resolve, reject) => {
//     const video = document.createElement("video");
//     video.crossOrigin = "anonymous";
//     video.src = videoUrl;
//     video.muted = true;
//     video.playsInline = true;

//     video.addEventListener("loadeddata", () => {
//       video.currentTime = Math.min(1, video.duration / 2);
//     });

//     video.addEventListener("seeked", () => {
//       const canvas = document.createElement("canvas");
//       canvas.width = 320;
//       canvas.height = 180;

//       const ctx = canvas.getContext("2d");
//       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//       canvas.toBlob((blob) => {
//         if (!blob) return reject("Thumbnail failed");

//         resolve(blob);
//       }, "image/jpeg", 0.8);
//     });

//     video.onerror = reject;
//   });
// }

// function captureThumbnail(videoSrc, seekTime = 1, useCrossOrigin = false) {
//     return new Promise((resolve, reject) => {
//         const video = document.createElement("video");
//         video.preload = "auto";
//         video.muted = true;
//         video.playsInline = true;
//         video.setAttribute("playsinline", "");
//         video.style.position = "fixed";
//         video.style.left = "-9999px";
//         video.style.top = "-9999px";
//         video.style.width = "1px";
//         video.style.height = "1px";
//         document.body.appendChild(video);

//         if (useCrossOrigin) {
//             video.crossOrigin = "anonymous";
//         }

//         let settled = false;
//         let targetTime = 0;
//         let shouldSeek = false;
//         const timeout = window.setTimeout(() => {
//             fail(new Error("Thumbnail capture timed out"));
//         }, 12000);
//         let seekFallbackTimer = null;

//         const cleanup = () => {
//             window.clearTimeout(timeout);
//             if (seekFallbackTimer) {
//                 window.clearTimeout(seekFallbackTimer);
//                 seekFallbackTimer = null;
//             }
//             video.pause();
//             video.removeAttribute("src");
//             video.load();
//             video.remove();
//         };

//         const done = (result) => {
//             if (settled) return;
//             settled = true;
//             cleanup();
//             resolve(result);
//         };

//         const fail = (err) => {
//             if (settled) return;
//             settled = true;
//             cleanup();
//             reject(err instanceof Error ? err : new Error("Thumbnail capture failed"));
//         };

//         const drawFrame = () => {
//             if (video.readyState < 2) return;
//             const canvas = document.createElement("canvas");
//             const sourceWidth = video.videoWidth || 320;
//             const sourceHeight = video.videoHeight || 180;
//             const maxWidth = 480;
//             const maxHeight = 270;
//             const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
//             canvas.width = Math.max(1, Math.round(sourceWidth * scale));
//             canvas.height = Math.max(1, Math.round(sourceHeight * scale));
//             const ctx = canvas.getContext("2d");
//             if (!ctx) {
//                 fail(new Error("Canvas not supported"));
//                 return;
//             }

//             try {
//                 ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
//                 done(canvas.toDataURL("image/jpeg", 0.78));
//             } catch (err) {
//                 fail(err);
//             }
//         };

//         video.addEventListener("error", () => fail(new Error("Video load error")), { once: true });
//         video.addEventListener("loadedmetadata", () => {
//             const duration = Number.isFinite(video.duration) ? video.duration : 0;
//             const safeTime = duration > 0 ? Math.min(seekTime, Math.max(0, duration - 0.1)) : 0;
//             targetTime = safeTime;
//             if (safeTime <= 0) {
//                 shouldSeek = false;
//                 drawFrame();
//                 return;
//             }
//             shouldSeek = true;
//             video.currentTime = safeTime;
//             seekFallbackTimer = window.setTimeout(drawFrame, 1500);
//         }, { once: true });
//         video.addEventListener("seeked", drawFrame, { once: true });
//         video.addEventListener("loadeddata", () => {
//             if (!shouldSeek) {
//                 drawFrame();
//                 return;
//             }
//             if (Math.abs((video.currentTime || 0) - targetTime) <= 0.2) {
//                 drawFrame();
//             }
//         }, { once: true });
//         video.addEventListener("canplay", () => {
//             if (!shouldSeek && video.currentTime === 0) {
//                 drawFrame();
//             }
//         }, { once: true });

//         video.src = videoSrc;
//         video.load();
//     });
// }

// async function getThumbnailFromVideo(videoUrl, seekTime = 1) {
//     try {
//         const isSameOrigin =
//             videoUrl.startsWith("/") || videoUrl.startsWith(window.location.origin);
//         return await captureThumbnail(videoUrl, seekTime, !isSameOrigin);
//     } catch (directErr) {
//         try {
//             const res = await fetch(videoUrl, { credentials: "include" });
//             if (!res.ok) throw new Error(`Thumbnail fetch failed (${res.status})`);
//             const blob = await res.blob();
//             const blobUrl = URL.createObjectURL(blob);
//             try {
//                 return await captureThumbnail(blobUrl, seekTime, false);
//             } finally {
//                 URL.revokeObjectURL(blobUrl);
//             }
//         } catch (blobErr) {
//             console.warn("Thumbnail generation failed:", directErr, blobErr);
//             return null;
//         }
//     }
// }

async function getThumbnailFromVideo(videoUrl) {
  let sourceUrl = "";
  let sourceObjectUrl = "";
  let settled = false;

  return new Promise(async (resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    };

    const done = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error("Thumbnail failed"));
    };

    try {
      const res = await fetch(videoUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`Thumbnail fetch failed (${res.status})`);
      const blob = await res.blob();
      sourceObjectUrl = URL.createObjectURL(blob);
      sourceUrl = sourceObjectUrl;
    } catch (err) {
      fail(err);
      return;
    }

    const timeout = window.setTimeout(() => {
      fail(new Error("Thumbnail capture timed out"));
    }, 12000);

    const finishWithFrame = () => {
      if (video.readyState < 2) return;
      const canvas = document.createElement("canvas");
      const sw = video.videoWidth || 320;
      const sh = video.videoHeight || 180;
      const scale = Math.min(1, 480 / sw, 270 / sh);
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        window.clearTimeout(timeout);
        fail(new Error("Canvas not supported"));
        return;
      }
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        window.clearTimeout(timeout);
        done(canvas.toDataURL("image/jpeg", 0.8));
      } catch (err) {
        window.clearTimeout(timeout);
        fail(err);
      }
    };

    let targetTime = 1;
    video.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      targetTime = duration > 0 ? Math.min(1, Math.max(0, duration - 0.1)) : 0;
      if (targetTime <= 0) {
        finishWithFrame();
        return;
      }
      video.currentTime = targetTime;
      window.setTimeout(finishWithFrame, 1400);
    }, { once: true });

    video.addEventListener("seeked", finishWithFrame, { once: true });
    video.addEventListener("loadeddata", () => {
      if (Math.abs((video.currentTime || 0) - targetTime) <= 0.2) {
        finishWithFrame();
      }
    }, { once: true });
    video.addEventListener("error", () => {
      window.clearTimeout(timeout);
      fail(new Error("Video load error"));
    }, { once: true });

    video.src = sourceUrl;
    video.load();
  });
}

// async function openVideo(id) {
//     const lightbox = document.getElementById("video-lightbox");
//     const video = document.getElementById("video-player");

//     try {
//         const res = await fetch(`/video-api/storage/video?id=${id}`, {
//             credentials: "include"
//         });

//         if (!res.ok) {
//             alert("Video failed to load");
//             return;
//         }

//         const blob = await res.blob();
//         const url = URL.createObjectURL(blob);

//         video.src = url;
//         lightbox.style.display = "flex";
//         video.play();

//         function close() {
//             video.pause();
//             video.src = "";
//             URL.revokeObjectURL(url);
//             lightbox.style.display = "none";
//         }

//         document.getElementById("close-video").onclick = close;

//         lightbox.onclick = e => {
//             if (e.target === lightbox) close();
//         };
//     } catch (err) {
//         alert("Video failed to load");
//     }
// }

document.addEventListener("DOMContentLoaded", async () => { 
  const isLoginPage = window.location.pathname.endsWith("/login/") || window.location.pathname.endsWith("/login"); 

  if (isLoginPage) { 
    await initLoginPage(); 
  } else { 
    await initPanelPage(); 
  } 
});
