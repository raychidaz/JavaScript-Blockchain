import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

import Blockchain from './blockchain.js';

const app = express();
const PORT = process.argv[2];
const bitcoin = new Blockchain();
const nodeAddress = uuidv4().split('-').join('');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// get entire block
app.get('/blockchain', (req, res) => {
  res.send(bitcoin);
});

// create new transaction
app.post('/transaction', (req, res) => {
  const blockIndex = bitcoin.createNewTransaction(
    req.body.amount,
    req.body.sender,
    req.body.recipient,
  );
  res.json({ note: `Transaction will be addded to block ${blockIndex}.` });
});

//  mine/create new block
app.get('/mine', (req, res) => {
  const lastBlock = bitcoin.getLastBlock();
  const previousBlockHash = lastBlock['hash'];
  const currentBlockData = {
    transactions: bitcoin.pendingTransactions,
    index: lastBlock['index'] + 1,
  };

  const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);
  const blockHash = bitcoin.hashBlock(
    previousBlockHash,
    currentBlockData,
    nonce,
  );

  bitcoin.createNewTransaction(12.5, '00', nodeAddress);

  const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);
  res.json({
    note: 'New Block mined successfully',
    block: newBlock,
  });
});

// register a new node to own server  and broadcast it to the rest of the network
// creates decentralised blockchain network
app.post('/register-and-broadcast-node', (req, res) => {
  const newNodeUrl = req.body.newNodeUrl;
  if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) {
    bitcoin.networkNodes.push(newNodeUrl);
  }

  const regNodesPromises = [];

  //broadcast the node to the entire network...
  bitcoin.networkNodes.forEach((networkNodeUrl) => {
    // register-node
    const requestOptions = {
      method: 'post',
      url: networkNodeUrl + '/register-node',
      data: { newNodeUrl: newNodeUrl },
      json: true,
    };

    regNodesPromises.push(axios(requestOptions));
  });
  Promise.all(regNodesPromises)
    .then((data) => {
      // registering all current nodes with new node....
      const bulkRegisterOptions = {
        method: 'post',
        url: newNodeUrl + '/register-nodes-bulk',
        data: {
          allNetworkNodes: [...bitcoin.networkNodes, bitcoin.currentNodeUrl],
        },
        json: true,
      };
      return axios(bulkRegisterOptions);
    })
    .then((data) => {
      res.json({ note: 'New node registered with network successfully' });
    });
});

// register/accept a new node to the  network
app.post('/register-node', (req, res) => {
  const newNodeUrl = req.body.newNodeUrl;
  const nodeNotAlreadyPresent = bitcoin.networkNodes.indexOf(newNodeUrl) == -1;
  const notCurrentNode = bitcoin.currentNodeUrl !== newNodeUrl;
  if (nodeNotAlreadyPresent && notCurrentNode)
    bitcoin.networkNodes.push(newNodeUrl);

  res.json({ note: 'New node registered successfully.' });
});

// register all current nodes with the new node at once
app.post('/register-nodes-bulk', (req, res) => {
  const allNetworkNodes = req.body.allNetworkNodes;
  allNetworkNodes.forEach((networkNodeUrl) => {
    const nodeNotAlreadyPresent =
      bitcoin.networkNodes.indexOf(networkNodeUrl) == -1;
    const notCurrentNode = bitcoin.currentNodeUrl !== networkNodeUrl;
    if (nodeNotAlreadyPresent && notCurrentNode)
      bitcoin.networkNodes.push(networkNodeUrl);
  });
  res.json({ note: 'Bulk registration successful' });
});

app.listen(PORT, (err) => {
  if (err) {
    console.log('There was an error', err);
  }
  console.log(`Server listening on port: ${PORT}....`);
});
