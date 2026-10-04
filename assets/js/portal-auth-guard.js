/* SCREENINGS4U — STRICT PORTAL AUTH GUARD */

(() => {
  "use strict";

  async function protectPortal({
    portal,
    loginPage = null
  } = {}) {

    if (!portal) {
      throw new Error(
        "Portal name is required."
      );
    }

    const destination =
      loginPage ||
      window.S4UAuth?.getLoginForPortal?.(
        portal
      ) ||
      `${portal}-login.html`;

    try {
      const state =
        await window.S4UAuth.requireAuth({
          portal,
          loginPage: destination
        });

      if (!state) {
        return null;
      }

      document.documentElement
        .classList
        .remove(
          "s4u-auth-pending"
        );

      document.documentElement
        .classList
        .add(
          "s4u-authenticated"
        );

      window.dispatchEvent(
        new CustomEvent(
          "s4u:authenticated",
          {
            detail: state
          }
        )
      );

      return state;

    } catch (error) {
      console.error(
        `[${portal} portal guard]`,
        error
      );

      /*
       * FAIL CLOSED:
       *
       * Do not remove s4u-auth-pending here.
       * An authorization/network/config failure must not reveal
       * protected page content.
       */

      document.documentElement
        .classList
        .add(
          "s4u-auth-error"
        );

      window.dispatchEvent(
        new CustomEvent(
          "s4u:auth-error",
          {
            detail: {
              portal,
              error
            }
          }
        )
      );

      return null;
    }
  }

  window.S4UPortalGuard =
    Object.freeze({
      protectPortal
    });

})();