/* ============================================================
   screenings4u — TRAINING RESET PASSWORD
   Supabase training recovery-session password update
   ============================================================ */

(() => {
  "use strict";

  const LOGIN_PAGE = "training-login.html";

  const $ = id => document.getElementById(id);

  let recoveryReady = false;

  function getClient() {
    return (
      window.supabaseClient ||
      window.screenings4uSupabase ||
      window.S4USupabase?.client ||
      null
    );
  }

  function setStatus(message = "", type = "") {
    const el = $("resetStatus");

    if (!el) return;

    el.textContent = message;
    el.className = "login-status";

    if (type) {
      el.classList.add(type);
    }
  }

  function setLoading(loading) {
    const btn = $("resetButton");

    if (!btn) return;

    btn.disabled = loading || !recoveryReady;

    btn.innerHTML = loading
      ? '<span class="s4u-inline-spinner" aria-hidden="true"></span><span>Updating Password…</span>'
      : "Update Password";
  }

  async function finishAndReturnToLogin() {
    try {
      const client = getClient();

      if (client?.auth) {
        await client.auth.signOut({
          scope: "local"
        });
      }
    } catch (error) {
      console.warn(
        "[Training Reset Password] Sign-out failed:",
        error
      );
    }

    window.location.replace(LOGIN_PAGE);
  }

  function bindToggles() {
    document
      .querySelectorAll("[data-toggle]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const input = $(button.dataset.toggle);

          if (!input) return;

          const showing = input.type === "text";

          input.type = showing
            ? "password"
            : "text";

          button.setAttribute(
            "aria-label",
            showing
              ? "Show password"
              : "Hide password"
          );
        });
      });
  }

  function cleanCodeFromUrl(url) {
    url.searchParams.delete("code");

    history.replaceState(
      {},
      document.title,
      url.pathname +
        url.search +
        url.hash
    );
  }

  async function establishRecoverySession() {
    const client = getClient();

    if (!client?.auth) {
      recoveryReady = false;

      setStatus(
        "The secure Training password service is unavailable. Please request a new recovery link and try again.",
        "error"
      );

      setLoading(false);
      return;
    }

    try {
      const url =
        new URL(window.location.href);

      const code =
        url.searchParams.get("code");

      /*
       * PKCE flow
       */
      if (
        code &&
        typeof client.auth.exchangeCodeForSession === "function"
      ) {
        const { error } =
          await client.auth.exchangeCodeForSession(code);

        if (error) {
          throw error;
        }

        cleanCodeFromUrl(url);
      }

      /*
       * Verify session exists.
       */
      const {
        data: sessionData,
        error: sessionError
      } = await client.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!sessionData?.session?.user) {
        recoveryReady = false;

        setStatus(
          "This Training password recovery link is invalid or has expired. Please request a new password reset link.",
          "error"
        );

        setLoading(false);
        return;
      }

      /*
       * Verify against Supabase Auth.
       */
      const {
        data: userData,
        error: userError
      } = await client.auth.getUser();

      if (
        userError ||
        !userData?.user
      ) {
        throw (
          userError ||
          new Error(
            "The Training account could not be verified."
          )
        );
      }

      recoveryReady = true;

      setStatus(
        "Recovery link verified. You can now choose a new Training Portal password.",
        "success"
      );

      setLoading(false);

    } catch (error) {
      console.error(
        "[Training Reset Password] Recovery verification failed:",
        error
      );

      recoveryReady = false;

      setStatus(
        "This Training password recovery link is invalid or has expired. Please request a new password reset link.",
        "error"
      );

      setLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();

    if (!recoveryReady) {
      setStatus(
        "Please request a new Training password recovery link before changing your password.",
        "error"
      );

      return;
    }

    const password =
      $("newPassword")?.value || "";

    const confirm =
      $("confirmPassword")?.value || "";

    if (password.length < 8) {
      setStatus(
        "Your new password must contain at least 8 characters.",
        "error"
      );

      $("newPassword")?.focus();
      return;
    }

    if (password !== confirm) {
      setStatus(
        "The passwords do not match. Please enter them again.",
        "error"
      );

      $("confirmPassword")?.focus();
      return;
    }

    const client = getClient();

    if (!client?.auth) {
      setStatus(
        "The secure Training password service is unavailable. Please try again.",
        "error"
      );

      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const {
        data,
        error
      } = await client.auth.updateUser({
        password
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          "Supabase did not confirm the password update."
        );
      }

      recoveryReady = false;

      $("newPassword").value = "";
      $("confirmPassword").value = "";

      setStatus(
        "Password updated successfully. Returning you to Training Sign In...",
        "success"
      );

      setTimeout(() => {
        finishAndReturnToLogin();
      }, 900);

    } catch (error) {
      console.error(
        "[Training Reset Password] Password update failed:",
        error
      );

      setStatus(
        error?.message ||
          "We could not update your Training password. Please request a new recovery link and try again.",
        "error"
      );

      recoveryReady = true;
      setLoading(false);
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      if ($("currentYear")) {
        $("currentYear").textContent =
          new Date().getFullYear();
      }

      bindToggles();

      $("resetPasswordForm")
        ?.addEventListener(
          "submit",
          handleReset
        );

      setLoading(false);

      await establishRecoverySession();
    }
  );
})();