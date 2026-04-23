import { useEffect } from "react";

const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds (TPV-friendly)

/**
 * Silent auto-updater for kiosk/TPV scenarios.
 * No UI: as soon as a new SW is installed it activates and the page reloads.
 */
const UpdateBanner = () => {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const activateWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    };

    navigator.serviceWorker.ready.then((registration) => {
      // Activate any worker already waiting from a previous visit
      activateWaiting(registration);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // New version installed → activate immediately
            activateWaiting(registration);
          }
        });
      });
    });

    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => {});
      });
    };

    // Periodic + event-driven checks
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);
    const onFocus = () => checkForUpdate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    const onOnline = () => checkForUpdate();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return null;
};

export default UpdateBanner;
