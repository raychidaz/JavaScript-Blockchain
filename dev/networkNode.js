import express from 'express';
import { v4 as uuidv4 } from 'uuid';

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

app.listen(PORT, (err) => {
  if (err) {
    console.log('There was an error', err);
  }
  console.log(`Server listening on port: ${PORT}....`);
});
