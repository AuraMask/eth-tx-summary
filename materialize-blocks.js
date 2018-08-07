'use strict';
const Block = require('icjs-block');
const Transaction = require('icjs-tx');
const ircUtil = require('icjs-util');

module.exports = blockFromRpc;

/**
 * Creates a new block object from IrChain JSON RPC.
 * @param {Object} blockParams - IrChain JSON RPC of block (irc_getBlockByNumber)
 * @param {Array.<Object>} uncles Optional list of IrChain JSON RPC of uncles (irc_getUncleByBlockHashAndIndex)
 */
function blockFromRpc(blockParams, uncles) {
  uncles = uncles || [];
  let block = new Block({
    transactions: [],
    uncleHeaders: [],
  });
  let blockHeader = block.header;
  blockHeader.parentHash = blockParams.parentHash;
  blockHeader.uncleHash = blockParams.sha3Uncles;
  blockHeader.coinbase = blockParams.miner;
  blockHeader.stateRoot = blockParams.stateRoot;
  blockHeader.transactionsTrie = blockParams.transactionsRoot;
  blockHeader.receiptTrie = blockParams.receiptRoot || blockParams.receiptsRoot || ircUtil.SHA3_NULL;
  blockHeader.bloom = blockParams.logsBloom;
  blockHeader.difficulty = blockParams.difficulty;
  blockHeader.number = blockParams.number;
  blockHeader.gasLimit = blockParams.gasLimit;
  blockHeader.gasUsed = blockParams.gasUsed;
  blockHeader.timestamp = blockParams.timestamp;
  blockHeader.extraData = blockParams.extraData;
  blockHeader.mixHash = blockParams.mixHash;
  blockHeader.nonce = blockParams.nonce;

  // override hash incase something was missing
  blockHeader.hash = function() {
    return ircUtil.toBuffer(blockParams.hash);
  };

  block.transactions = (blockParams.transactions || []).map(function(_txParams) {
    let txParams = Object.assign({}, _txParams);
    normalizeTxParams(txParams);
    // override from address
    let fromAddress = ircUtil.toBuffer(txParams.from);
    delete txParams.from;
    let tx = new Transaction(txParams);
    tx._from = fromAddress;
    tx.getSenderAddress = function() { return fromAddress; };
    // override hash
    let txHash = ircUtil.toBuffer(txParams.hash);
    tx.hash = function() { return txHash; };
    return tx;
  });
  block.uncleHeaders = uncles.map(function(uncleParams) {
    return blockFromRpc(uncleParams).header;
  });

  return block;
}

function normalizeTxParams(txParams) {
  // hot fix for https://github.com/icjs/icjs-util/issues/40
  txParams.gasLimit = (txParams.gasLimit === undefined) ? txParams.gas : txParams.gasLimit;
  txParams.data = (txParams.data === undefined) ? txParams.input : txParams.data;
  // strict byte length checking
  txParams.to = txParams.to ? ircUtil.setLengthLeft(ircUtil.toBuffer(txParams.to), 20) : null;
  // v as raw signature value {0,1}
  txParams.v = txParams.v < 27 ? txParams.v + 27 : txParams.v;
}