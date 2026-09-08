import { createRoot } from "react-dom/client";
import { LocalApp } from "./components/LocalApp";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Local app is missing its root element");

createRoot(root).render(<LocalApp />);
