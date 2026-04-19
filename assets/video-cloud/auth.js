const VideoCloudAuth = (() => {
  const CONFIG = {
    apiBase: ["https://api.", "eclipsesdev", ".top/authentication/video-auth"].join(""),
    loginPath: ["/projects/", "video-cloud", "/login/"].join(""),
    defaultRedirect: ["/projects/", "video-cloud", "/"].join("")
  };

  async function request(path, options = {}) {
    const response = await fetch(`${CONFIG.apiBase}${path}`, {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: options.body
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};

    if (!response.ok) {
      const error = new Error(payload.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function getReturnTarget() {
    const params = new URLSearchParams(window.location.search);
    const returnTarget = params.get("return");

    if (
      returnTarget &&
      returnTarget.startsWith("/projects/video-cloud/") &&
      !returnTarget.includes("/login")
    ) {
      return returnTarget;
    }

    return CONFIG.defaultRedirect;
  }

  function redirectToLogin() {
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const returnParam = encodeURIComponent(currentPath);
    window.location.href = `${CONFIG.loginPath}?return=${returnParam}`;
  }

  async function login(username, password) {
    return request("/login", {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    });
  }

  async function getSession() {
    try {
      return await request("/session");
    } catch {
      return { authenticated: false };
    }
  }

  async function isAuthenticated() {
    const session = await getSession();
    return session.authenticated === true;
  }

  async function requireAuth() {
    if (await isAuthenticated()) {
      return true;
    }

    redirectToLogin();
    return false;
  }

  async function logout() {
    try {
      await request("/logout", { method: "POST" });
    } catch {
      // Ignore response errors and force local navigation to login.
    }
    window.location.href = CONFIG.loginPath;
  }

  return {
    getReturnTarget,
    getSession,
    isAuthenticated,
    login,
    logout,
    requireAuth
  };
})();
