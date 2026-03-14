/**
 * Client-side analytics helpers.
 * - useTracking(page) — call at page component top-level; fires page_view + time_on_page
 * - Returns a track(event, data?) function for manual event recording
 */
import { useRef, useEffect, useCallback } from "react";

export type TrackFn = (
  event: string,
  data?: Record<string, string | number | boolean>,
) => void;

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return "ssr";
  let id = sessionStorage.getItem("dh_sid");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("dh_sid", id);
  }
  return id;
}

function post(event: string, page: string, data?: Record<string, string | number | boolean>) {
  const payload = JSON.stringify({
    event,
    page,
    sessionId: getSessionId(),
    data,
    ts: Date.now(),
  });
  // sendBeacon is fire-and-forget; fall back to fetch
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics/track",
      new Blob([payload], { type: "application/json" }),
    );
  } else {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }).catch(() => {});
  }
}

export function useTracking(page: string): TrackFn {
  const startRef = useRef(Date.now());
  const pageRef  = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    // fire page_view on mount (use fetch so we can set Content-Type)
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "page_view",
        page,
        sessionId: getSessionId(),
        ts: Date.now(),
      }),
    }).catch(() => {});

    startRef.current = Date.now();

    const sendExit = () => {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      post("time_on_page", pageRef.current, { seconds });
    };

    window.addEventListener("beforeunload", sendExit);
    return () => {
      window.removeEventListener("beforeunload", sendExit);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const track = useCallback<TrackFn>((event, data) => {
    post(event, pageRef.current, data);
  }, []);

  return track;
}
