"use client";

import { createElement, useEffect } from "react";

export function RingLoader() {
  useEffect(() => {
    void import("ldrs").then(({ ring }) => {
      ring.register();
    });
  }, []);

  return createElement("l-ring", {
    size: "40",
    stroke: "5",
    "bg-opacity": "0",
    speed: "2",
    color: "black",
  });
}
