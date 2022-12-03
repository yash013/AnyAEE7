import { Contract } from "@ethersproject/contracts";
import { shortenAddress, useCall, useEthers, useLookupAddress, useSendTransaction, useContractFunction } from "@usedapp/core";
import React, { useEffect, useState } from "react";
import EIP4337SmartWalletABI from "./EIP4337SmartWalletABI.json";


import { Body, Button, Container, Header, Image, Link, TextField, Text } from "./components";
import WalletConnect from "@walletconnect/client";
import jsQr from "jsqr";
import { blobToImageData } from "./utils";

import SmartAccount from "@biconomy/smart-account";

import { ethers } from "ethers";

const LOCAL_STORAGE_URI_KEY = 'safeAppWcUri';

function WalletButton() {
  const [rendered, setRendered] = useState("");

  const { ens } = useLookupAddress();
  const { account, activateBrowserWallet, deactivate, error, chainId } = useEthers();

  useEffect(() => {
    if (ens) {
      setRendered(ens);
    } else if (account) {
      setRendered(shortenAddress(account));
    } else {
      setRendered("");
    }
  }, [account, ens, setRendered]);

  useEffect(() => {
    if (error) {
      console.error("Error while connecting wallet:", error.message);
    }
  }, [error]);



  return (
    <Button
      onClick={() => {
        if (!account) {
          activateBrowserWallet();
        } else {
          deactivate();
        }
      }}
    >
      {rendered === "" && "Connect Wallet"}
      {rendered !== "" && rendered}
    </Button>
  );
}

function WalletConnectEIP4337SmartWallet() {
  const EIP4337SmartWalletInterface = new ethers.utils.Interface(EIP4337SmartWalletABI);

  const smartWalletContract = new Contract("0x4a2F2a0d936c0532175E8cc3E04467AD49dc706A", EIP4337SmartWalletInterface);
  const { send } = useContractFunction(smartWalletContract, 'exec', { transactionName: 'Exec' });

  const [smartWalletAddress, setSmartWalletAddress] = useState(undefined);
  // const [smartWallet, setSmartWallet] = useState(undefined);
  const [connector, setConnector] = useState(undefined);
  const [peerData, setPeerData] = useState(null);
  const [wcUri, setWcUri] = useState('');
  const { account, chainId, library } = useEthers();
  const { sendTransaction, state } = useSendTransaction();

  useEffect(() => {
    const listener = (event) => {
      const items = (event.clipboardData || event.originalEvent.clipboardData).items;

      for (const index in items) {
        var item = items[index];
        if (item.kind === 'file') {
          const blob = item.getAsFile();
          console.log({ blob });

          const reader = new FileReader();
          reader.onload = async (event) => {
            const imageData = await blobToImageData(event.target.result);
            const code = jsQr(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              wcConnect(code.data);
            }

          }; // data url!
          reader.readAsDataURL(blob);


          console.log({ reader });
        }
      }
      // jsQr(qrCode);
    };
    window.addEventListener("paste", listener);
    return () => { window.removeEventListener("paste", listener); };
  }, []);

  const wcDisconnect = React.useCallback(async () => {
    connector?.killSession();
    localStorage.removeItem(LOCAL_STORAGE_URI_KEY);
    setConnector(undefined);
  }, [connector]);

  const wcConnect = React.useCallback(async (uri) => {
    // Create Connector
    const connector = new WalletConnect(
      {
        uri,
        clientMeta: {
          description: "EIP4337 any",
          url: "http://localhost:3000/",
          icons: ["https://github.com/WalletConnect/walletconnect-assets/blob/master/Logo/Black/Logo.svg"],
          name: "EIP4337 Any",
        },
      });

    console.log(connector);
    setPeerData(connector.peerMeta);

    // Subscribe to session requests
    connector.on("session_request", async (error, payload) => {
      console.log({ payload });
      if (error) {
        throw error;
      }
      console.log("account", account);
      console.log("chainId", chainId);


      console.log("library", library);


      // const smartWallet1 = new SmartAccount(library, {
      //   activeNetworkId: chainId,
      //   supportedNetworksIds: [chainId],
      //   networkConfig: [{
      //     chainId: 5,
      //     dappAPIKey: 'gUv-7Xh-M.aa270a76-a1aa-4e79-bab5-8d857161c561',
      //   }]
      // });

      // await smartWallet1.init();
      // setSmartWallet(smartWallet1);


      // Auto-Approve Session
      connector.approveSession({
        accounts: ["0x4a2F2a0d936c0532175E8cc3E04467AD49dc706A"],
        chainId: chainId
      });

      setPeerData(payload.params[0].peerMeta);
    });

    // Subscribe to call requests
    connector.on("call_request", (error, payload) => {
      console.log({ payload });
      if (error) {
        throw error;
      }

      if (payload.method === "eth_sendTransaction") {
        const txInfo = payload.params[0];
        console.log(txInfo);



        send(txInfo.to, txInfo.value || "0x0", txInfo.data || "0x");

        // sendTransaction({
        //   to: txInfo.to,
        //   value: txInfo.value || "0x0",
        //   data: txInfo.data || "0x"
        // });
      }

      if (payload.method === "eth_call") {
        console.log(payload);
      }



    });

    connector.on("disconnect", (error, payload) => {
      if (error) {
        throw error;
      }
      wcDisconnect();
    });


    console.log({ connector });
    setConnector(connector);
    localStorage.setItem(LOCAL_STORAGE_URI_KEY, uri);
  }, [account, chainId]);

  useEffect(() => {
    const uri = localStorage.getItem(LOCAL_STORAGE_URI_KEY);

    if (uri) wcConnect(uri);
  }, [wcConnect]);

  useEffect(() => {

  }, [smartWalletAddress]);


  if (connector === undefined) {
    return (
      <>
        <div>
          <label>
            Smart Wallet Address
          </label>
          <div>
            <TextField
              id="sc-address"
              label="Smart Wallet Address"
              value={smartWalletAddress}
              onChange={(e) => setSmartWalletAddress(e.target.value)}
            />
          </div>
          <div>
            <label>
              Wallet Connect URI
            </label>
            <div>
              <TextField
                id="wc-uri"
                label="WalletConnect URI"
                value={wcUri}
                onChange={(e) => setWcUri(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div>
          <Button
            size="md"
            color="primary"
            variant="contained"
            onClick={() => wcConnect(wcUri)}>
            Connect
          </Button>
        </div>
      </>
    );
  }
  else {
    return (
      <>
        <Text size="lg">Bridge: {connector.bridge}</Text>
        <Text size="lg">Dapp name: {peerData?.name}</Text>
        <Text size="lg">Dapp url: {peerData?.url}</Text>
        <div>
          <Button
            size="md"
            color="primary"
            variant="contained"
            onClick={() => wcDisconnect()}>
            Disconnect
          </Button>
        </div>
      </>);
  }
};

function App() {



  return (
    <Container>
      <Header>
        <WalletButton />
      </Header>
      <Body>
        < WalletConnectEIP4337SmartWallet />
      </Body>

    </Container>


  );
}

export default App;