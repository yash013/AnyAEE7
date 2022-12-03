import "./index.css";

import { DAppProvider, Goerli, Mainnet, Polygon, Mumbai } from "@usedapp/core";
import React from "react";
import ReactDOM from "react-dom";

import App from "./App";

// IMPORTANT, PLEASE READ
// To avoid disruptions in your app, change this to your own Infura project id.
// https://infura.io/register
const INFURA_PROJECT_ID = "2a1a54c3aa374385ae4531da66fdf150";
const config = {
  readOnlyChainId: Mainnet.chainId,
  readOnlyUrls: {
    [Mainnet.chainId]: "https://mainnet.infura.io/v3/" + INFURA_PROJECT_ID,
    [Goerli.chainId]: "https://goerli.infura.io/v3/" + INFURA_PROJECT_ID,
    [Polygon.chainId]: "https://polygon-mainnet.infura.io/v3/" + INFURA_PROJECT_ID,
    [Mumbai.chainId]: "https://polygon-mumbai.infura.io/v3/" + INFURA_PROJECT_ID,
  },
};



ReactDOM.render(
  <React.StrictMode>
    <DAppProvider config={config}>
      <App />
    </DAppProvider>
  </React.StrictMode>,
  document.getElementById("root"),
);
