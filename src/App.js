import { Contract } from "@ethersproject/contracts";
import { shortenAddress, useEthers, useLookupAddress, useContractFunction } from "@usedapp/core";
import React, { useEffect, useState } from "react";
import EIP4337SmartWalletABI from "./EIP4337SmartWalletABI.json";
import Toggle from 'react-toggle';
import "react-toggle/style.css";



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


  const [smartWalletAddress, setSmartWalletAddress] = useState(undefined);
  // const [smartWalletContract, setSmartWalletContract] = useState(new Contract("0x4a2F2a0d936c0532175E8cc3E04467AD49dc706A", EIP4337SmartWalletInterface));
  const [martWalletSendFunction, setSmartWalletSendFunction] = useState(undefined);
  const [smartWallet, setSmartWallet] = useState(null);
  const [connector, setConnector] = useState(undefined);
  const [peerData, setPeerData] = useState(null);
  const [wcUri, setWcUri] = useState('');
  const [isGasLess, setIsGasLess] = useState(false);
  const { account, chainId, library } = useEthers();
  const [tx, setTx] = useState({ "to": null });

  const { send } = useContractFunction(smartWalletContract, 'exec', { transactionName: 'Exec' });


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




      // Auto-Approve Session
      connector.approveSession({
        accounts: ["0x4a2F2a0d936c0532175E8cc3E04467AD49dc706A"],
        chainId: chainId
      });

      setPeerData(payload.params[0].peerMeta);
    });

    // Subscribe to call requests
    connector.on("call_request", async (error, payload) => {
      console.log({ payload });
      if (error) {
        throw error;
      }

      if (payload.method === "eth_sendTransaction") {
        const txInfo = payload.params[0];
        console.log("txInfo", txInfo);
        setTx({
          to: txInfo.to,
          value: txInfo.value,
          data: txInfo.data
        });
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
    const smartWallet1 = new SmartAccount(library, {
      activeNetworkId: chainId,
      supportedNetworksIds: [chainId],
      networkConfig: [{
        chainId: chainId,
        dappAPIKey: chainId === 5 ? 'gUv-7Xh-M.aa270a76-a1aa-4e79-bab5-8d857161c561' : '59fRCMXvk.8a1652f0-b522-4ea7-b296-98628499aee3'//mumbai,
      }]
    });
    smartWallet1.init().then(
      res => { console.log(res); }
    ).catch(error => {
      console.log(error);
    });
    setSmartWallet(smartWallet1);
  }, [chainId, library]);

  const toggleIsGasLess = () => setIsGasLess(!isGasLess);

  useEffect(() => {
    async function handleTx() {
      if (tx.to !== null) {
        if (isGasLess) {
          console.log("in gasless mode");
          const tx1 = {
            to: tx.to,
            data: tx.data,
            value: tx.value
          };

          smartWallet.on('txHashGenerated', (response) => {
            console.log('txHashGenerated event received via emitter', response);
          });

          smartWallet.on('txMined', (response) => {
            console.log('txMined event received via emitter', response);
          });

          smartWallet.on('error', (response) => {
            console.log('error event received via emitter', response);
          });

          const feeQuotes = await smartWallet.prepareRefundTransaction(
            { transaction: tx1 }
          );

          console.log("feeQuotes", feeQuotes);

          const transaction = await smartWallet.createRefundTransaction({
            transaction: tx1,
            feeQuote: feeQuotes[0],
          });

          console.log("transaction", transaction);

          // transaction.targetTxGas = transaction.targetTxGas * 10;
          const gasLimit = 6207500;


          const txId = await smartWallet.sendTransaction({
            tx: transaction, // temp
            gasLimit: gasLimit,
          });

        } else {
          send(tx.to, tx.value || "0x0", tx.data || "0x");
        }
        setTx({ "to": null });

      }
    }
    handleTx();
  }, [tx, isGasLess, send, smartWallet]);



  if (connector === undefined) {
    return (
      <>
        <div>
          <label htmlFor='cheese-status'>GasLess Mode</label>
          <Toggle
            id='cheese-status'
            defaultChecked={isGasLess}
            onChange={toggleIsGasLess} />

        </div>
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
