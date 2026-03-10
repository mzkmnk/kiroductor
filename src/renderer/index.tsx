import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";
import "./types/ipc.js";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
