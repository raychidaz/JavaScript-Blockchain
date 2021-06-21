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
  const newTransaction = req.body;
  const blockIndex =
    bitcoin.addTransactionToPendingTransactions(newTransaction);
  res.json({ note: `Transaction will be added to blockL ${blockIndex}` });
});

// 1. creates a new transaction
//2. broadcasts new transaction to all the other nodes in the network
app.post('/transaction/broadcast', (req, res) => {
  // create transaction
  const { amount, sender, recipient } = req.body;
  const newTransaction = bitcoin.createNewTransaction(
    amount,
    sender,
    recipient,
  );
  bitcoin.addTransactionToPendingTransactions(newTransaction);

  const requestPromises = [];
  // broadcast
  bitcoin.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      method: 'post',
      url: networkNodeUrl + '/transaction',
      data: newTransaction,
      json: true,
    };
    requestPromises.push(axios(requestOptions));
  });
  Promise.all(requestPromises).then((data) => {
    res.json({ note: 'Transaction created and broadcast successfully' });
  });
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

  const newBlock = bitcoin.createNewBlock(nonce, previousBlockHash, blockHash);

  // broadcast to  other nework nodes
  const requestPromises = [];
  bitcoin.networkNodes.forEach((networkNodeUrl) => {
    const requestOptions = {
      method: 'post',
      url: networkNodeUrl + '/receive-new-block',
      data: { newBlock: newBlock },
      json: true,
    };
    requestPromises.push(axios(requestOptions));
  });

  Promise.all(requestPromises)
    .then((data) => {
      // broadcast mining reward request to entire network
      const requestOptions = {
        method: 'post',
        url: bitcoin.currentNodeUrl + '/transaction/broadcast',
        data: {
          amount: 12.5,
          sender: '00',
          recipient: nodeAddress,
        },
        json: true,
      };
      return axios(requestOptions);
    })
    .then((data) => {
      res.json({
        note: 'New Block mined and broadcast successfully',
        block: newBlock,
      });
    });
});

// accept new block onto the chain
app.post('/receive-new-block', (req, res) => {
  const newBlock = req.body.newBlock;
  const lastBlock = bitcoin.getLastBlock();
  const correctHash = lastBlock.hash === newBlock.previousBlockHash;
  const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

  if (correctHash && correctIndex) {
    bitcoin.chain.push(newBlock);
    // clear  out pending transactions cos they  are now in this current mined block
    bitcoin.pendingTransactions = [];
    res.json({
      note: 'New block  received and accepted',
      newBlock: newBlock,
    });
  } else {
    res.json({
      note: 'New  Block rejected',
      newBlock: newBlock,
    });
  }
});

// 1. register a new node to own server  and broadcast it to the rest of the network
// 2. creates decentralised blockchain network
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
